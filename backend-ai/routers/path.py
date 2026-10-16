"""
学习路径路由 — /internal/path/*

提供路径生成、查询、节点状态更新三个端点。
"""

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel

from services.db import (
    get_active_learning_path,
    update_path_item_status,
    check_enrollment,
)
from graphs.path_graph import PathGenState, compile_path_graph
from services.deps import get_current_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/path", tags=["path"])

# 路径生成总时限（原先 ainvoke 无超时，上游挂起会长期占用连接）
PATH_GEN_TIMEOUT_SEC = 240.0


def _require_enrollment(student_id: int, course_id: int) -> None:
    """课程范围接口的统一准入校验。

    原实现只有对话链路(chat_graph.guard_check)校验选课，
    资源生成/路径/画像等接口均可对任意 course_id 操作。
    """
    if not check_enrollment(student_id, course_id):
        raise HTTPException(status_code=403, detail="未选修该课程，无权访问该课程数据")

# 模块级编译图（启动时编译一次）
path_app = compile_path_graph()


# ── 请求/响应模型 ──

class PathGenerateRequest(BaseModel):
    course_id: int
    force_regenerate: bool = False
    questionnaire: Optional[dict] = None # 前端问卷答案 {goal, level, weeklyHours, preferStyle, depth, timeline}


class PathItemStatusRequest(BaseModel):
    status: str # "pending" | "in_progress" | "completed" | "skipped"


# ── 端点 ──

@router.post("/generate")
async def generate_path(
    req: PathGenerateRequest,
    user_id: int = Depends(get_current_user_id),
):
    """生成/刷新学习路径"""
    _require_enrollment(user_id, req.course_id)
    logger.info(
        f"Generating learning path: student={user_id} course={req.course_id}"
    )

    # 如果不是强制重新生成，先检查是否已有活跃路径
    if not req.force_regenerate:
        existing = get_active_learning_path(user_id, req.course_id)
        if existing:
            return {
                "path_id": existing["path_id"],
                "items": existing["items"],
                "generated_at": existing.get("created_at"),
                "from_cache": True,
            }

    # 构造初始 state 并执行图
    initial_state: PathGenState = {
        "student_id": user_id,
        "course_id": req.course_id,
        "profile": {},
        "profile_version": 0,
        "force_regenerate": req.force_regenerate,
        "questionnaire": req.questionnaire or {},
        "course_chapters": [],
        "available_resources": [],
        "completed_items": [],
        "path_items": [],
        "path_id": None,
        "abandoned_path_ids": [],
        "error": None,
    }

    result = await asyncio.wait_for(path_app.ainvoke(initial_state), timeout=PATH_GEN_TIMEOUT_SEC)

    if result.get("error"):
        raise HTTPException(status_code=500, detail=result["error"])

    return {
        "path_id": result.get("path_id"),
        "items": result.get("path_items", []),
        "generated_at": None,
        "from_cache": False,
    }


@router.get("")
async def get_path(
    course_id: int = Query(..., description="课程ID"),
    user_id: int = Depends(get_current_user_id),
):
    """获取当前活跃的学习路径"""
    _require_enrollment(user_id, course_id)
    path = get_active_learning_path(user_id, course_id)
    if not path:
        return {"message": "尚无学习路径，请先调用 POST /internal/path/generate 生成", "items": []}

    return {
        "path_id": path["path_id"],
        "items": path["items"],
        "generated_at": path.get("created_at"),
    }


@router.put("/items/{item_id}/status")
async def update_item_status(
    item_id: int,
    req: PathItemStatusRequest,
    user_id: int = Depends(get_current_user_id),
):
    """更新路径节点状态"""
    valid_statuses = {"pending", "in_progress", "completed", "skipped"}
    if req.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"无效状态值，允许: {', '.join(valid_statuses)}",
        )

    result = update_path_item_status(item_id, user_id, req.status)
    if not result:
        raise HTTPException(status_code=404, detail=f"路径节点 item_id={item_id} 不存在")

    return result
