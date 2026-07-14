# 数据模型：家长账号 + 孩子档案 + 学习进度 + 经济/宠物 + 每日打卡。
# 自用场景，字段尽量精简；PII 最小化（家长登录名 + 孩子昵称即可）。
from datetime import datetime, timezone

from sqlalchemy import String, Integer, Float, ForeignKey, DateTime, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _now():
    return datetime.now(timezone.utc)


class User(Base):
    """家长账号。username 唯一（可用手机号/邮箱/任意昵称，自用不校验格式）。"""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    profiles: Mapped[list["Profile"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Profile(Base):
    """孩子档案。一个家长可有多个孩子。只存昵称，不收集其他 PII。"""
    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    nickname: Mapped[str] = mapped_column(String(32))
    avatar: Mapped[str] = mapped_column(String(16), default="🐼")  # 用 emoji 作头像
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    user: Mapped["User"] = relationship(back_populates="profiles")
    progress: Mapped[list["Progress"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan"
    )
    economy: Mapped["Economy"] = relationship(
        back_populates="profile", cascade="all, delete-orphan", uselist=False
    )
    logs: Mapped[list["DailyLog"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan"
    )


class Progress(Base):
    """每个孩子对每个字的掌握度（Leitner 盒子 + 星级 + 到期时间）。"""
    __tablename__ = "progress"
    __table_args__ = (UniqueConstraint("profile_id", "char", name="uq_profile_char"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    profile_id: Mapped[int] = mapped_column(ForeignKey("profiles.id"), index=True)
    char: Mapped[str] = mapped_column(String(4), index=True)
    stars: Mapped[int] = mapped_column(Integer, default=0)      # 最佳星级 0-3
    box: Mapped[int] = mapped_column(Integer, default=1)        # Leitner 盒子 1-5
    due: Mapped[float] = mapped_column(Float, default=0.0)      # 下次复习时间戳(ms)
    learned_at: Mapped[float] = mapped_column(Float, default=0.0)
    reviewed_at: Mapped[float] = mapped_column(Float, default=0.0)

    profile: Mapped["Profile"] = relationship(back_populates="progress")


class Economy(Base):
    """每个孩子的金币与宠物养成状态（一对一）。"""
    __tablename__ = "economy"

    id: Mapped[int] = mapped_column(primary_key=True)
    profile_id: Mapped[int] = mapped_column(ForeignKey("profiles.id"), unique=True, index=True)
    coins: Mapped[int] = mapped_column(Integer, default=0)
    pet_exp: Mapped[int] = mapped_column(Integer, default=0)
    pet_level: Mapped[int] = mapped_column(Integer, default=1)
    streak_count: Mapped[int] = mapped_column(Integer, default=0)
    streak_last_day: Mapped[float] = mapped_column(Float, default=0.0)

    profile: Mapped["Profile"] = relationship(back_populates="economy")


class DailyLog(Base):
    """每日学习日志，供家长报告用（学了多少字、时长、日期）。"""
    __tablename__ = "daily_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    profile_id: Mapped[int] = mapped_column(ForeignKey("profiles.id"), index=True)
    day: Mapped[str] = mapped_column(String(10), index=True)  # YYYY-MM-DD
    chars_learned: Mapped[int] = mapped_column(Integer, default=0)
    seconds: Mapped[int] = mapped_column(Integer, default=0)
    note: Mapped[str] = mapped_column(Text, default="")

    profile: Mapped["Profile"] = relationship(back_populates="logs")
