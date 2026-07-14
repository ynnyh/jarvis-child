# 导出所有模型，便于 Base.metadata.create_all 建表。
from app.models.user import User, Profile, Progress, Economy, DailyLog  # noqa: F401
