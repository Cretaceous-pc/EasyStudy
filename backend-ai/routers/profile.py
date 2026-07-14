"""
画像路由 — /internal/profile/*

提供画像查询、手动更新、变更历史三个端点。
画像在对话中自动更新（通过 ProfileUpdateState 图），此路由提供主动查询接口。
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel

from services.db import (
    load_profile,
    save_profile,
    save_profile_snapshot,
    get_profile_history,
    get_recent_conversation_messages,
)
from graphs.profile_graph import ProfileUpdateState, compile_profile_graph
from services.deps import get_current_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/profile", tags=["profile"])

# 模块级编译图（启动时编译一次）
profile_app = compile_profile_graph()


# ── 请求/响应模型 ──

class ProfileUpdateRequest(BaseModel):
    course_id: int
    updates: dict  # {dimension: {value, label}}


class ProfileInitRequest(BaseModel):
    course_id: int
    answers: dict  # {dimension_key: value}


# ── 维度 label 映射 ──

DIMENSION_LABELS = {
    "knowledge_base": "知识基础",
    "learning_goal": "学习目标",
    "cognitive_style": "认知风格",
    "error_prone_points": "易错知识点",
    "learning_pace": "学习节奏",
    "engagement": "参与度",
}

DIMENSION_VALUE_LABELS = {
    "knowledge_base": {
        "low": "入门", "medium": "有一定基础", "high": "比较熟练", "very_high": "非常扎实",
    },
    "learning_goal": {
        "exam_prep": "通过考试", "competition": "参加竞赛", "research": "科研需要",
        "interest": "兴趣爱好", "job_interview": "求职需要", "other": "其他",
    },
    "cognitive_style": {
        "visual": "视觉型", "auditory": "听觉型",
        "read_write": "读写型", "kinesthetic": "动觉型",
    },
    "learning_pace": {
        "fast": "快速推进", "medium": "稳步前进", "slow": "精耕细作",
    },
}


# ── 端点 ──

@router.get("")
@router.get("")
async def get_profile(
    course_id: int = Query(..., description="课程ID"),
    user_id: int = Depends(get_current_user_id),
):
    """获取当前课程的学生画像"""
    result = load_profile(user_id, course_id)
    return {
        "student_id": user_id,
        "course_id": course_id,
        "profile": result["profile"],
        "version": result["version"],
        "last_updated_at": result.get("last_updated_at"),
    }


@router.post("/update")
async def update_profile(
    req: ProfileUpdateRequest,
    user_id: int = Depends(get_current_user_id),
):
    """手动更新画像维度（学生主动修改）"""
    current = load_profile(user_id, req.course_id)
    current_profile = current["profile"]
    current_version = current["version"]

    # 合并手动更新
    for dim, dim_data in req.updates.items():
        if isinstance(dim_data, dict):
            from datetime import datetime, timezone
            dim_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        current_profile[dim] = dim_data

    new_version = current_version + 1

    # 保存
    save_profile(user_id, req.course_id, current_profile, new_version)
    save_profile_snapshot(
        user_id, req.course_id, current_profile, new_version, "manual"
    )

    logger.info(
        f"Profile manually updated: student={user_id} "
        f"course={req.course_id} version={new_version}"
    )

    return {
        "profile": current_profile,
        "version": new_version,
    }


@router.get("/history")
async def get_history(
    course_id: int = Query(..., description="课程ID"),
    limit: int = Query(10, ge=1, le=50),
    user_id: int = Depends(get_current_user_id),
):
    """获取画像变更历史"""
    snapshots = get_profile_history(user_id, course_id, limit)
    return {"snapshots": snapshots}


@router.post("/init")
async def init_profile(
    req: ProfileInitRequest,
    user_id: int = Depends(get_current_user_id),
):
    """首次初始化画像（注册问卷完成后调用）"""
    from datetime import datetime, timezone

    profile = {}
    for dim_key, dim_value in req.answers.items():
        if dim_key not in DIMENSION_LABELS:
            continue

        label = DIMENSION_LABELS[dim_key]
        value_label = dim_value

        # 尝试从映射表获取中文标签
        if dim_key in DIMENSION_VALUE_LABELS and dim_value in DIMENSION_VALUE_LABELS[dim_key]:
            value_label = DIMENSION_VALUE_LABELS[dim_key][dim_value]

        # engagement 特殊处理：百分比映射到 0.0-1.0
        if dim_key == "engagement":
            try:
                dim_value = float(dim_value)
            except (ValueError, TypeError):
                dim_value = 0.5
            value_label = f"{int(dim_value * 100)}%"
        # error_prone_points 特殊处理：列表
        elif dim_key == "error_prone_points":
            if isinstance(dim_value, list):
                value_label = ", ".join(dim_value) if dim_value else "无"
            else:
                value_label = str(dim_value)

        profile[dim_key] = {
            "value": dim_value,
            "label": value_label if isinstance(value_label, str) else str(value_label),
            "confidence": 1.0,
            "evidence": "用户通过注册问卷填写",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

    save_profile(user_id, req.course_id, profile, 1)
    save_profile_snapshot(user_id, req.course_id, profile, 1, "questionnaire")

    logger.info(
        f"Profile initialized via questionnaire: student={user_id} course={req.course_id}"
    )

    return {
        "profile": profile,
        "version": 1,
    }


@router.post("/reset")
async def reset_profile(
    course_id: int = Query(..., description="课程ID"),
    user_id: int = Depends(get_current_user_id),
):
    """重置画像：保存最终快照后清空"""
    current = load_profile(user_id, course_id)

    if current["profile"] and current["version"] > 0:
        # 保存重置前快照
        save_profile_snapshot(
            user_id, current["profile"], current["version"], "reset"
        )

    # 写入空画像
    save_profile(user_id, course_id, {}, 0)

    logger.info(
        f"Profile reset: student={user_id} course={course_id}"
    )

    return {"message": "画像已重置"}


@router.post("/cold-start")
async def trigger_cold_start(
    course_id: int = Query(..., description="课程ID"),
    user_id: int = Depends(get_current_user_id),
):
    """触发画像冷启动对话引导（首次选课后调用）"""
    # 检查是否已有画像
    current = load_profile(user_id, course_id)
    if current["profile"] and current["version"] > 0:
        return {
            "need_cold_start": False,
            "message": "画像已存在，无需冷启动",
        }

    return {
        "need_cold_start": True,
        "message": "需要冷启动对话。请用对话接口与 AI 助教交流，我将通过几轮对话了解你的学习情况。",
    }
