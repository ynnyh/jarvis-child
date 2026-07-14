# FastAPI 入口：挂载路由、建表、CORS。自用场景，配置从简。
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.models import user as _models  # noqa: F401  确保模型被注册后再建表
from app.api import auth, profiles, report

# 首次启动自动建表（SQLite，自用场景够用；多人协作再引入 Alembic 迁移）。
Base.metadata.create_all(bind=engine)

app = FastAPI(title="宝宝识字 API", version="1.0.0")

# CORS：自用放宽。CORS_ORIGINS="*" 时允许所有来源。
origins = ["*"] if settings.CORS_ORIGINS == "*" else settings.CORS_ORIGINS.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,  # 用 Bearer token，不用 cookie，可关闭凭据
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(profiles.router)
app.include_router(report.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
