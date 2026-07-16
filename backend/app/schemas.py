# Pydantic 请求/响应模型（Pydantic 2）。
# 命名对齐前端 store 的数据结构，方便同步。
from typing import Optional
from pydantic import BaseModel, Field


# ---- 认证 ----
class RegisterIn(BaseModel):
    # 家长账号：用户名 + 密码即可（自用，不强制邮箱/手机）。
    username: str = Field(min_length=2, max_length=40)
    password: str = Field(min_length=8, max_length=64)


class LoginIn(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---- 孩子档案 ----
class ProfileIn(BaseModel):
    nickname: str = Field(min_length=1, max_length=20)
    avatar: Optional[str] = None  # emoji 或预设头像标识


class ProfileOut(BaseModel):
    id: int
    nickname: str
    avatar: Optional[str] = None

    class Config:
        from_attributes = True


# ---- 进度同步 ----
# 单字进度，字段对齐前端 store 的 chars[char]。
class CharProgress(BaseModel):
    char: str
    stars: int = 0
    box: int = 0
    due: float = 0            # 到期时间戳（ms）
    learned_at: Optional[float] = None
    reviewed_at: Optional[float] = None


class LessonProgress(BaseModel):
    lesson_id: str
    stars: int = 0
    completed_at: Optional[float] = None


class EconomyState(BaseModel):
    coins: int = 0
    pet_exp: int = 0
    pet_level: int = 1
    streak_count: int = 0
    streak_last_day: float = 0


# 全量同步载荷（本地优先：客户端上传自己的状态，服务端合并后回传权威值）。
class SyncIn(BaseModel):
    profile_id: int
    chars: list[CharProgress] = []
    lessons: list[LessonProgress] = []
    economy: EconomyState = EconomyState()
    # 客户端本次同步的时间戳，用于合并策略（取较新）。
    client_time: float = 0


class SyncOut(BaseModel):
    chars: list[CharProgress] = []
    lessons: list[LessonProgress] = []
    economy: EconomyState = EconomyState()
    server_time: float


# ---- 家长报告 ----
class ReportOut(BaseModel):
    profile_id: int
    total_learned: int          # 已学字数
    total_stars: int
    mastered: int               # 盒子>=4 视为掌握
    due_today: int              # 今日到期复习
    streak_count: int
    coins: int
    box_distribution: dict[int, int]  # 各盒子字数分布
