# 应用配置：用 pydantic-settings 从环境变量读取，带自用场景的合理默认值。
import os
import secrets
from pathlib import Path

from pydantic_settings import BaseSettings

# JWT 签名密钥所在文件（落在数据卷，与 SQLite 同目录，随容器重建而保留）。
_SECRET_FILE = Path(os.getenv("JWT_SECRET_FILE", "/app/data/.jwt_secret"))


def _resolve_jwt_secret() -> str:
    """解析 JWT 密钥，优先级：环境变量 > 持久化文件 > 新生成并落盘。
    绝不回退到硬编码默认值——避免任何人拿源码里的固定密钥伪造 token。"""
    env = os.getenv("JWT_SECRET")
    if env:
        return env
    try:
        if _SECRET_FILE.exists():
            saved = _SECRET_FILE.read_text(encoding="utf-8").strip()
            if saved:
                return saved
        # 首次启动：生成 32 字节随机密钥并写入数据卷，重启后复用。
        generated = secrets.token_hex(32)
        _SECRET_FILE.parent.mkdir(parents=True, exist_ok=True)
        _SECRET_FILE.write_text(generated, encoding="utf-8")
        try:
            _SECRET_FILE.chmod(0o600)
        except OSError:
            pass  # 某些文件系统不支持 chmod，不致命
        return generated
    except OSError:
        # 数据卷不可写等极端情况：退回到进程内随机密钥（重启后 token 失效，但绝不用固定值）。
        return secrets.token_hex(32)


class Settings(BaseSettings):
    # 数据库：默认 SQLite，落在容器 volume（/app/data），零配置、和现有后端一致。
    DATABASE_URL: str = "sqlite:////app/data/jarvis_child.db"

    # JWT：无硬编码默认值。见 _resolve_jwt_secret：环境变量 > 持久化文件 > 自动生成。
    JWT_SECRET: str = _resolve_jwt_secret()
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_DAYS: int = 30  # 自用，给长有效期省得频繁登录

    # CORS：允许前端来源。自用放宽为 *。
    CORS_ORIGINS: str = "*"

    class Config:
        env_file = ".env"


settings = Settings()
