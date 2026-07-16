# 孩子档案 + 进度同步路由。
# 同步策略：本地优先。客户端上传自己的全量状态，服务端按"较新者胜"合并后回传权威值。
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User, Profile, Progress, LessonRecord, Economy
from app.api.deps import get_current_user, get_owned_profile
from app import schemas

router = APIRouter(prefix="/api", tags=["profiles"])


# ---- 孩子档案管理 ----
@router.get("/profiles", response_model=list[schemas.ProfileOut])
def list_profiles(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Profile).filter(Profile.user_id == user.id).all()


@router.post("/profiles", response_model=schemas.ProfileOut, status_code=status.HTTP_201_CREATED)
def create_profile(
    body: schemas.ProfileIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = Profile(user_id=user.id, nickname=body.nickname, avatar=body.avatar or "🐼")
    db.add(profile)
    db.flush()  # 拿到 profile.id
    # 同时建一份经济档案（一对一）。
    db.add(Economy(profile_id=profile.id))
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/profiles/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(
    profile_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = get_owned_profile(profile_id, user, db)
    db.delete(profile)
    db.commit()


# ---- 进度同步 ----
@router.post("/sync", response_model=schemas.SyncOut)
def sync(
    body: schemas.SyncIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    import time

    profile = get_owned_profile(body.profile_id, user, db)

    def _merge_once():
        # 每次（含重试）都重新读 existing：并发同步下对方可能已插入某 char/lesson，
        # 重跑时会读到它并走 update 分支，避开唯一约束冲突。
        # 合并每字进度：以 reviewed_at/learned_at 的较新者为准（本地优先，服务端只在更旧时被覆盖）。
        existing = {p.char: p for p in db.query(Progress).filter(Progress.profile_id == profile.id)}
        for cp in body.chars:
            row = existing.get(cp.char)
            incoming_time = max(cp.reviewed_at or 0, cp.learned_at or 0)
            if row is None:
                db.add(Progress(
                    profile_id=profile.id, char=cp.char, stars=cp.stars, box=cp.box,
                    due=cp.due, learned_at=cp.learned_at or 0, reviewed_at=cp.reviewed_at or 0,
                ))
            else:
                row_time = max(row.reviewed_at or 0, row.learned_at or 0)
                if incoming_time >= row_time:
                    row.stars = max(row.stars, cp.stars)
                    row.box = cp.box
                    row.due = cp.due
                    row.learned_at = cp.learned_at or row.learned_at
                    row.reviewed_at = cp.reviewed_at or row.reviewed_at

        # 合并每课进度：星级取较大值，完成时间取较新（本地优先）。
        existing_lessons = {
            lp.lesson_id: lp
            for lp in db.query(LessonRecord).filter(LessonRecord.profile_id == profile.id)
        }
        for lp in body.lessons:
            row = existing_lessons.get(lp.lesson_id)
            if row is None:
                db.add(LessonRecord(
                    profile_id=profile.id, lesson_id=lp.lesson_id,
                    stars=lp.stars, completed_at=lp.completed_at or 0,
                ))
            else:
                row.stars = max(row.stars, lp.stars)
                if lp.completed_at and lp.completed_at >= (row.completed_at or 0):
                    row.completed_at = lp.completed_at

        # 合并经济：金币取较大值，宠物取较高等级/经验，打卡取较新。
        eco = profile.economy
        if eco is None:
            eco = Economy(profile_id=profile.id)
            db.add(eco)
        e = body.economy
        eco.coins = max(eco.coins, e.coins)
        if (e.pet_level, e.pet_exp) > (eco.pet_level, eco.pet_exp):
            eco.pet_level, eco.pet_exp = e.pet_level, e.pet_exp
        if e.streak_last_day >= eco.streak_last_day:
            eco.streak_count = e.streak_count
            eco.streak_last_day = e.streak_last_day

        db.commit()

    # 并发下唯一约束（uq_profile_char / uq_profile_lesson）可能触发 IntegrityError：
    # rollback 后重跑一次，重跑时会读到对方刚插入的行走 update，不再冲突。
    try:
        _merge_once()
    except IntegrityError:
        db.rollback()
        _merge_once()

    # 回传权威状态。
    rows = db.query(Progress).filter(Progress.profile_id == profile.id).all()
    lesson_rows = db.query(LessonRecord).filter(LessonRecord.profile_id == profile.id).all()
    return schemas.SyncOut(
        chars=[
            schemas.CharProgress(
                char=r.char, stars=r.stars, box=r.box, due=r.due,
                learned_at=r.learned_at, reviewed_at=r.reviewed_at,
            )
            for r in rows
        ],
        lessons=[
            schemas.LessonProgress(
                lesson_id=r.lesson_id, stars=r.stars, completed_at=r.completed_at,
            )
            for r in lesson_rows
        ],
        economy=schemas.EconomyState(
            coins=eco.coins, pet_exp=eco.pet_exp, pet_level=eco.pet_level,
            streak_count=eco.streak_count, streak_last_day=eco.streak_last_day,
        ),
        server_time=time.time() * 1000,
    )
