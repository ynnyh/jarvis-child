# 应用配置：用 pydantic-settings 从环境变量读取，带自用场景的合理默认值。
# 自用、无 https：JWT 密钥给了默认值，生产可用环境变量覆盖。
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # 数据库：默认 SQLite，落在容器 volume（/app/data），零配置、和现有后端一致。
    DATABASE_URL: str = "sqlite:////app/data/jarvis_child.db"

    # JWT：自用默认密钥；如需更换用环境变量 JWT_SECRET 覆盖。
    JWT_SECRET: str = "jarvis-child-dev-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_DAYS: int = 30  # 自用，给长有效期省得频繁登录

    # CORS：允许前端来源。自用放宽为 *。
    CORS_ORIGINS: str = "*"

    class Config:
        env_file = ".env"


settings = Settings()
