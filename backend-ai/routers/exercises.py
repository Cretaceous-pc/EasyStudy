"""
练习路由 — /internal/exercises/*

提供答题提交和历史查询两个端点。
错题 ≥3 次触发画像更新（通过后台 ProfileUpdateState 图）。
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel

from services.db import (
    save_exercise_attempt,
    get_exercise_history,
    get_exercise_wrong_count,
    load_profile,
    save_profile,
    save_profile_snapshot,
    get_recent_conversation_messages,
)
from graphs.profile_graph import ProfileUpdateState, compile_profile_graph
from services.deps import get_current_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/exercises", tags=["exercises"])

profile_app = compile_profile_graph()


# ── 请求/响应模型 ──

class ExerciseSubmitRequest(BaseModel):
    resource_id: int
    exercise_index: int
    answer: dict  # {"type": "single_choice", "selected": 1} 或 {"type": "coding", "code": "..."}
    time_spent_sec: int = 0


# ── 端点 ──

@router.post("/submit")
async def submit_answer(
    req: ExerciseSubmitRequest,
    user_id: int = Depends(get_current_user_id),
):
    """提交答案 → 判断正误 → 返回解析"""

    # 1. 从 resources 表加载题目正确答案
    try:
        from services.db import get_connection

        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT content, course_id FROM resources WHERE id = %s",
                    (req.resource_id,),
                )
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="资源不存在")

                import json
                content = row[0] if isinstance(row[0], dict) else json.loads(row[0])
                course_id = row[1]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to load exercise resource: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="加载练习题失败")

    # 2. 定位题目并判断正误
    exercises = content.get("exercises", [])
    if req.exercise_index < 0 or req.exercise_index >= len(exercises):
        raise HTTPException(
            status_code=400,
            detail=f"exercise_index {req.exercise_index} 超出范围 (0-{len(exercises)-1})",
        )

    exercise = exercises[req.exercise_index]
    correct_answer = exercise.get("answer")
    explanation = exercise.get("explanation", "")
    student_answer = req.answer

    # 判断正误
    is_correct = None
    if correct_answer is not None:
        if exercise.get("type") == "coding":
            # 编程题：暂不自动判断，交给校验智能体
            is_correct = None
            explanation = "编程题已提交，将由 AI 助教批改。"
        else:
            # 选择题和填空题：比较答案
            student_value = student_answer.get("selected") or student_answer.get("value")
            if isinstance(correct_answer, list):
                # 多选题：比较集合
                is_correct = set(student_answer.get("selected", [])) == set(correct_answer)
            else:
                is_correct = student_value == correct_answer

    # 3. 保存答题记录
    attempt_id = save_exercise_attempt(
        student_id=user_id,
        resource_id=req.resource_id,
        exercise_index=req.exercise_index,
        student_answer=student_answer,
        is_correct=is_correct,
        time_spent_sec=req.time_spent_sec,
    )

    # 4. 错题 ≥3 次 → 触发画像更新
    wrong_count = get_exercise_wrong_count(user_id, req.resource_id, req.exercise_index)
    if wrong_count >= 3:
        logger.info(
            f"[exercise] wrong_count={wrong_count}, triggering profile update "
            f"for student={user_id} course={course_id}"
        )
        try:
            profile_data = load_profile(user_id, course_id)
            messages = get_recent_conversation_messages(user_id, course_id, limit=10)

            profile_state: ProfileUpdateState = {
                "student_id": user_id,
                "course_id": course_id,
                "trigger": "behavior_threshold",
                "conversation_messages": messages,
                "behavior_events": [{
                    "event_type": "exercise_attempted",
                    "event_data": {
                        "resource_id": req.resource_id,
                        "exercise_index": req.exercise_index,
                        "wrong_count": wrong_count,
                    }
                }],
                "current_profile": profile_data["profile"],
                "current_version": profile_data["version"],
                "extracted_dimensions": {},
                "changes": {},
                "needs_update": False,
                "updated_profile": None,
                "new_version": None,
            }

            import asyncio
            # P0-2+P1-3 修复: 使用 asyncio.create_task 在后台执行图像更新
            # 而非 ThreadPoolExecutor.submit(async_fn)
            asyncio.create_task(_trigger_profile_update(profile_state))
        except Exception as e:
            logger.error(f"[exercise] profile update trigger failed: {e}", exc_info=True)

    return {
        "attempt_id": attempt_id,
        "is_correct": is_correct,
        "explanation": explanation,
        "correct_answer": correct_answer if is_correct is False else None,
    }


async def _trigger_profile_update(profile_state: dict):
    """在后台异步执行画像更新（通过 asyncio.create_task 调度）"""
    try:
        await profile_app.ainvoke(profile_state)
    except Exception as e:
        logger.error(f"[profile] background update failed: {e}", exc_info=True)


@router.get("/history")
async def get_history(
    course_id: Optional[int] = Query(None, description="按课程筛选"),
    resource_id: Optional[int] = Query(None, description="按资源筛选"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: int = Depends(get_current_user_id),
):
    """获取答题历史"""

    return get_exercise_history(
        student_id=user_id,
        course_id=course_id,
        resource_id=resource_id,
        page=page,
        page_size=page_size,
    )
