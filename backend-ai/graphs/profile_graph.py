"""
ProfileUpdateState 图 — 画像维度抽取/更新

节点: extract_dimensions → compare_and_decide → apply_update / no_op
"""

import json
import logging
from typing import TypedDict, List, Optional

from langgraph.graph import StateGraph, END

from prompts.profile_prompts import (
    PROMPT_PROFILE_EXTRACT,
    PROMPT_PROFILE_COMPARE,
)
from services.deepseek_client import deepseek_generate, deepseek_generate_json
from services.db import (
    load_profile,
    save_profile,
    save_profile_snapshot,
)

logger = logging.getLogger(__name__)


class ProfileUpdateState(TypedDict):
    student_id: int
    course_id: int

    # ── 触发来源 ──
    trigger: str  # "conversation" | "behavior_threshold" | "manual" | "chapter_complete"
    conversation_messages: Optional[List[dict]]
    behavior_events: Optional[List[dict]]

    # ── 当前画像 ──
    current_profile: dict
    current_version: int

    # ── 更新结果 ──
    extracted_dimensions: dict
    changes: dict
    needs_update: bool
    updated_profile: Optional[dict]
    new_version: Optional[int]


# ── 节点函数 ──

async def extract_profile_from_context(state: ProfileUpdateState) -> dict:
    """LLM 从对话/行为中抽取画像维度"""
    student_id = state["student_id"]
    course_id = state["course_id"]
    logger.info(
        f"[extract_dimensions] START student={student_id} course={course_id} "
        f"trigger={state['trigger']}"
    )

    try:
        # 构造上下文文本
        context_parts = []
        messages = state.get("conversation_messages") or []
        for msg in reversed(messages):
            role_label = "学生" if msg["role"] == "user" else "助手"
            context_parts.append(f"[{role_label}]: {msg['content']}")

        events = state.get("behavior_events") or []
        for evt in events:
            context_parts.append(f"[行为事件-{evt.get('event_type','')}]: {json.dumps(evt.get('event_data',{}), ensure_ascii=False)}")

        context_text = "\n".join(context_parts) if context_parts else "（暂无对话/行为记录）"
        current_profile_text = json.dumps(state.get("current_profile", {}), ensure_ascii=False)

        # 调用 LLM 抽取
        prompt = PROMPT_PROFILE_EXTRACT.format(
            current_profile=current_profile_text,
            context=context_text,
        )
        extracted = await deepseek_generate_json(prompt, temperature=0.1)  # P1-5: 画像抽取需低温度
        logger.info(
            f"[extract_dimensions] EXIT student={student_id} "
            f"extracted_keys={list(extracted.keys())}"
        )
        return {"extracted_dimensions": extracted}

    except Exception as e:
        logger.error(f"[extract_dimensions] FAILED: {e}", exc_info=True)
        return {"extracted_dimensions": {}, "needs_update": False}


async def compare_profiles(state: ProfileUpdateState) -> dict:
    """对比新旧画像，判断是否需要更新"""
    logger.info(f"[compare_and_decide] comparing profiles")

    extracted = state.get("extracted_dimensions", {})
    if not extracted:
        logger.info("[compare_and_decide] no dimensions extracted, skip")
        return {"needs_update": False, "changes": {}}

    try:
        current_text = json.dumps(state.get("current_profile", {}), ensure_ascii=False)
        extracted_text = json.dumps(extracted, ensure_ascii=False)

        prompt = PROMPT_PROFILE_COMPARE.format(
            current_profile=current_text,
            extracted_dimensions=extracted_text,
        )
        result = await deepseek_generate_json(prompt, temperature=0.0)  # P1-5: 决策判断需确定性

        needs_update = result.get("needs_update", False)
        changes = result.get("changes", [])
        logger.info(
            f"[compare_and_decide] needs_update={needs_update}, change_count={len(changes)}"
        )
        return {"needs_update": needs_update, "changes": changes}

    except Exception as e:
        logger.error(f"[compare_and_decide] FAILED: {e}", exc_info=True)
        return {"needs_update": False, "changes": {}}


async def apply_profile_update(state: ProfileUpdateState) -> dict:
    """应用画像更新：合并新旧画像 → 写 DB → 保存快照"""
    student_id = state["student_id"]
    course_id = state["course_id"]
    current = state.get("current_profile", {})
    extracted = state.get("extracted_dimensions", {})

    logger.info(f"[apply_update] applying profile update")

    try:
        # 合并：用新值覆盖对应维度
        updated_profile = dict(current)
        for dim, dim_data in extracted.items():
            if isinstance(dim_data, dict) and dim_data.get("confidence", 0) >= 0.5:
                updated_profile[dim] = dim_data
                # 追加更新时间戳
                from datetime import datetime, timezone
                updated_profile[dim]["updated_at"] = datetime.now(timezone.utc).isoformat()

        new_version = state.get("current_version", 0) + 1

        # 写入 DB
        save_profile(student_id, course_id, updated_profile, new_version)
        save_profile_snapshot(
            student_id, course_id, updated_profile, new_version, state["trigger"]
        )

        logger.info(
            f"[apply_update] profile updated: student={student_id} "
            f"course={course_id} version={new_version}"
        )
        return {
            "updated_profile": updated_profile,
            "new_version": new_version,
        }

    except Exception as e:
        logger.error(f"[apply_update] FAILED: {e}", exc_info=True)
        return {"new_version": state.get("current_version", 0)}


def no_op(state: ProfileUpdateState) -> dict:
    """无变化，跳过更新"""
    logger.info(f"[no_op] profile unchanged, skip")
    return {"needs_update": False}


# ── 条件边 ──

def after_compare(state: ProfileUpdateState) -> str:
    return "apply_update" if state.get("needs_update") else "no_op"


# ── 编译函数 ──

def compile_profile_graph():
    """编译 ProfileUpdateState 图"""
    graph = StateGraph(ProfileUpdateState)

    graph.add_node("extract_dimensions", extract_profile_from_context)
    graph.add_node("compare_and_decide", compare_profiles)
    graph.add_node("apply_update", apply_profile_update)
    graph.add_node("no_op", no_op)

    graph.set_entry_point("extract_dimensions")
    graph.add_edge("extract_dimensions", "compare_and_decide")

    graph.add_conditional_edges("compare_and_decide", after_compare, {
        "apply_update": "apply_update",
        "no_op": "no_op",
    })
    graph.add_edge("apply_update", END)
    graph.add_edge("no_op", END)

    return graph.compile()
