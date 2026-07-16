# 认证路由：注册、登录。自用场景，用户名+密码即可。
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.core.ratelimit import check_rate_limit
from app.models.user import User
from app.schemas import RegisterIn, LoginIn, TokenOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _client_ip(request: Request) -> str:
    # nginx 反代后真实 IP 在 X-Forwarded-For 首段；无则回退到直连地址。
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/register", response_model=TokenOut)
def register(body: RegisterIn, request: Request, db: Session = Depends(get_db)):
    # 限流：同一 IP 每小时最多 10 次注册，防批量刷号。
    if not check_rate_limit(f"reg:{_client_ip(request)}", max_hits=10, window_seconds=3600):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "操作过于频繁，请稍后再试")
    exists = db.query(User).filter(User.username == body.username).first()
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "用户名已被占用")
    user = User(username=body.username, password_hash=hash_password(body.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # 并发注册同名：exists 检查与 commit 之间被别人抢先，唯一约束兜底。
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "用户名已被占用")
    db.refresh(user)
    return TokenOut(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    # 限流两个维度：同一 IP 每分钟 20 次（防大范围撞库），
    # 同一 IP+用户名每分钟 5 次（防定向暴力破解单个账号）。
    ip = _client_ip(request)
    if not check_rate_limit(f"login-ip:{ip}", max_hits=20, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "尝试过于频繁，请稍后再试")
    if not check_rate_limit(f"login-user:{ip}:{body.username}", max_hits=5, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "尝试过于频繁，请稍后再试")
    user = db.query(User).filter(User.username == body.username).first()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "用户名或密码错误")
    return TokenOut(access_token=create_access_token(user.id))
