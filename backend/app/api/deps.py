# 认证依赖：从 Authorization: Bearer <token> 解析出当前家长用户。
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, Profile

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "未登录")
    sub = decode_token(creds.credentials)
    if sub is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "登录已失效")
    user = db.query(User).filter(User.id == int(sub)).first()
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "用户不存在")
    return user


def get_owned_profile(profile_id: int, user: User, db: Session) -> Profile:
    # 校验该档案属于当前家长，防止越权访问他人孩子的数据。
    profile = (
        db.query(Profile)
        .filter(Profile.id == profile_id, Profile.user_id == user.id)
        .first()
    )
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "档案不存在")
    return profile
