# 家长报告路由：汇总某个孩子的学习情况。
import time

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User, Progress
from app.api.deps import get_current_user, get_owned_profile
from app import schemas

router = APIRouter(prefix="/api", tags=["report"])

DAY_MS = 24 * 60 * 60 * 1000


@router.get("/report/{profile_id}", response_model=schemas.ReportOut)
def report(
    profile_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = get_owned_profile(profile_id, user, db)
    rows = db.query(Progress).filter(Progress.profile_id == profile.id).all()

    now = time.time() * 1000
    total_learned = len(rows)
    total_stars = sum(r.stars for r in rows)
    # 盒子 >=4 视为"掌握"（复习间隔已拉长到 7 天以上）。
    mastered = sum(1 for r in rows if r.box >= 4)
    due_today = sum(1 for r in rows if r.due and r.due <= now)

    # 各盒子字数分布 1-5。
    box_dist = {i: 0 for i in range(1, 6)}
    for r in rows:
        if 1 <= r.box <= 5:
            box_dist[r.box] += 1

    eco = profile.economy
    return schemas.ReportOut(
        profile_id=profile.id,
        total_learned=total_learned,
        total_stars=total_stars,
        mastered=mastered,
        due_today=due_today,
        streak_count=eco.streak_count if eco else 0,
        coins=eco.coins if eco else 0,
        box_distribution=box_dist,
    )
