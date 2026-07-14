"""
PathGenState 图 — 学习路径生成

节点: load_context → generate_path → generate_teach_content → save_path → index_teach_to_kb
"""

import asyncio
import logging
from typing import TypedDict, List, Optional

from langgraph.graph import StateGraph, END

from services.deepseek_client import deepseek_generate_json, deepseek_generate
from services.db import (
    load_profile,
    save_learning_path,
    save_teach_chunks,
)

logger = logging.getLogger(__name__)


class PathGenState(TypedDict):
    student_id: int
    course_id: int
    profile: dict
    profile_version: int
    force_regenerate: bool
    questionnaire: dict  # 前端问卷答案

    # ── 课程结构 ──
    course_chapters: List[dict]
    available_resources: List[dict]
    completed_items: List[dict]

    # ── 生成的路径 ──
    path_items: List[dict]
    path_id: Optional[int]
    abandoned_path_ids: List[int]  # 被废弃的旧路径 ID，用于清理 Chroma
    error: Optional[str]


# ── 节点函数 ──

async def load_course_and_resources(state: PathGenState) -> dict:
    """加载学生画像（仅作辅助参考，不加载课程章节/资源/已完成项）"""
    student_id = state["student_id"]
    course_id = state["course_id"]
    logger.info(f"[load_context] START student={student_id} course={course_id}")

    try:
        # 仅加载画像作为辅助参考，路径生成完全基于问卷
        profile_data = load_profile(student_id, course_id)

        logger.info(f"[load_context] profile_version={profile_data['version']}")
        return {
            "course_chapters": [],
            "available_resources": [],
            "completed_items": [],
            "profile": profile_data["profile"],
            "profile_version": profile_data["version"],
        }
    except Exception as e:
        logger.error(f"[load_context] FAILED: {e}", exc_info=True)
        return {"error": f"加载画像数据失败: {str(e)[:200]}"}


async def generate_learning_path(state: PathGenState) -> dict:
    """LLM 生成个性化学习路径"""
    student_id = state["student_id"]
    course_id = state["course_id"]

    if state.get("error"):
        return {"error": state.get("error")}

    logger.info(f"[generate_path] generating path for student={student_id}")

    try:
        from prompts.path_prompts import PROMPT_PATH_GENERATE

        profile = state.get("profile", {})
        questionnaire = state.get("questionnaire", {})

        # 问卷中文标签映射
        q_purpose_labels = {
            "exam": "通过考试/考证", "career": "提升工作技能",
            "interest": "兴趣探索", "research": "学术研究", "other": "其他",
        }
        q_level_labels = {
            "beginner": "零基础", "elementary": "入门了解",
            "intermediate": "有一定基础", "advanced": "比较熟练",
        }
        q_depth_labels = {
            "overview": "了解概览即可", "practical": "能独立上手使用",
            "systematic": "系统掌握原理", "expert": "成为专家",
        }
        q_time_labels = {
            "<30min": "少于30分钟", "30min-1h": "30分钟-1小时",
            "1-2h": "1-2小时", ">2h": "2小时以上",
        }

        prompt = PROMPT_PATH_GENERATE.format(
            profile_knowledge_base=profile.get("knowledge_base", {}).get("label", "未知"),
            profile_learning_goal=profile.get("learning_goal", {}).get("label", "未知"),
            profile_learning_pace=profile.get("learning_pace", {}).get("label", "适中"),
            q_purpose=q_purpose_labels.get(questionnaire.get("purpose", ""), questionnaire.get("purpose", "未填写")),
            q_daily_study_time=q_time_labels.get(questionnaire.get("dailyStudyTime", ""), questionnaire.get("dailyStudyTime", "未填写")),
            q_depth=q_depth_labels.get(questionnaire.get("depth", ""), questionnaire.get("depth", "未填写")),
            q_level=q_level_labels.get(questionnaire.get("level", ""), questionnaire.get("level", "未填写")),
            q_topic=questionnaire.get("topic", "").strip() or "（用户未填写具体内容，请根据前四项偏好生成通用路径）",
        )

        result = await deepseek_generate_json(prompt, temperature=0.3, timeout=180.0)
        items = result.get("items", [])
        logger.info(f"[generate_path] generated {len(items)} path items")

        return {"path_items": items}
    except Exception as e:
        logger.error(f"[generate_path] FAILED: {e}", exc_info=True)
        return {"error": f"生成学习路径失败: {str(e)[:200]}"}


async def save_learning_path_node(state: PathGenState) -> dict:
    """保存学习路径到 DB，并返回被废弃的旧路径 ID 列表"""
    if state.get("error") or not state.get("path_items"):
        logger.warning("[save_path] skipped: no items or has error")
        return {"error": state.get("error")}

    student_id = state["student_id"]
    course_id = state["course_id"]
    items = state["path_items"]

    try:
        result = save_learning_path(
            student_id, course_id, state.get("profile_version", 1), items
        )
        path_id = result["path_id"]
        abandoned_ids = result["abandoned_path_ids"]
        logger.info(
            f"[save_path] path saved: path_id={path_id}, "
            f"abandoned={abandoned_ids}"
        )
        return {"path_id": path_id, "abandoned_path_ids": abandoned_ids}
    except Exception as e:
        logger.error(f"[save_path] FAILED: {e}", exc_info=True)
        return {"error": f"保存学习路径失败: {str(e)[:200]}"}


# ── 教学内容生成 ──

async def generate_teach_content(state: PathGenState) -> dict:
    """为每个路径节点并发生成教学内容"""
    items = state.get("path_items", [])
    if state.get("error") or not items:
        return {"error": state.get("error")}

    logger.info(f"[generate_teach] generating teach content for {len(items)} items")

    # 路径上下文（节点标题链）
    path_context = " → ".join([it.get("title", "") for it in items])

    from prompts.path_prompts import PROMPT_NODE_TEACH

    async def gen_one(item: dict) -> dict:
        detail = item.get("detail", {})
        prompt = PROMPT_NODE_TEACH.format(
            title=item.get("title", ""),
            item_type=item.get("item_type", "chapter"),
            difficulty=detail.get("difficulty", "beginner"),
            description=item.get("description", ""),
            learning_points=", ".join(detail.get("learning_points", [])),
            path_context=path_context,
        )
        try:
            content = await deepseek_generate(prompt, temperature=0.7, max_tokens=2048)
            item["teach_content"] = content.strip()
            logger.info(f"[generate_teach] item seq={item['seq_order']} done ({len(content)} chars)")
        except Exception as e:
            logger.error(f"[generate_teach] item seq={item['seq_order']} FAILED: {e}")
            item["teach_content"] = ""  # 失败不影响其他节点
        return item

    enriched = await asyncio.gather(*[gen_one(it) for it in items])
    logger.info(f"[generate_teach] all {len(enriched)} items processed")
    return {"path_items": enriched}


# ── 知识库索引 ──

async def index_teach_to_kb(state: PathGenState) -> dict:
    """将教学内容切片后索引到 Chroma + knowledge_chunks 表，同时清理旧路径的向量"""
    path_id = state.get("path_id")
    course_id = state["course_id"]
    items = state.get("path_items", [])
    abandoned_ids = state.get("abandoned_path_ids", [])

    if state.get("error") or not path_id or not items:
        return {"error": state.get("error")}

    logger.info(f"[index_teach] indexing teach content for path={path_id}")

    try:
        from rag.vectorstore import get_vectorstore

        vs = get_vectorstore("easystudy_chunks")

        # 清理被废弃路径的 Chroma 向量
        for old_pid in abandoned_ids:
            try:
                vs.delete_by_path_id(old_pid)
                logger.info(f"[index_teach] cleaned Chroma vectors for abandoned path={old_pid}")
            except Exception as e:
                logger.warning(f"[index_teach] failed to clean Chroma for path={old_pid}: {e}")

        chunks_batch = []
        items_with_chunks = []

        for item in items:
            teach = item.get("teach_content", "")
            if not teach:
                continue

            # 按段落切片，过滤太短的
            paragraphs = [p.strip() for p in teach.split("\n\n") if len(p.strip()) > 50]
            if not paragraphs:
                paragraphs = [teach[:500]]

            for i, chunk in enumerate(paragraphs):
                chunk_id = f"teach-p{path_id}-s{item['seq_order']}-{i}"
                chunks_batch.append((chunk_id, chunk, {
                    "course_id": course_id,
                    "path_id": path_id,
                    "item_title": item.get("title", ""),
                    "source": "teach_content",
                }))
                items_with_chunks.append((item["seq_order"], i, chunk, chunk_id))

            logger.info(
                f"[index_teach] item seq={item['seq_order']}: {len(paragraphs)} chunks"
            )

        if chunks_batch:
            ids, docs, metas = zip(*chunks_batch)
            vs.add_documents(ids=list(ids), documents=list(docs), metadatas=list(metas))

            # 同步写入 knowledge_chunks 表
            save_teach_chunks(path_id, course_id, items_with_chunks)

        logger.info(f"[index_teach] indexed {len(chunks_batch)} chunks total")
    except Exception as e:
        logger.error(f"[index_teach] FAILED: {e}", exc_info=True)
        # 索引失败不阻塞路径生成

    return {"error": state.get("error")}


# ── 编译函数 ──

def compile_path_graph():
    """编译 PathGenState 图"""
    graph = StateGraph(PathGenState)

    graph.add_node("load_context", load_course_and_resources)
    graph.add_node("generate_path", generate_learning_path)
    graph.add_node("generate_teach_content", generate_teach_content)
    graph.add_node("save_path", save_learning_path_node)
    graph.add_node("index_teach_to_kb", index_teach_to_kb)

    graph.set_entry_point("load_context")
    graph.add_edge("load_context", "generate_path")
    graph.add_edge("generate_path", "generate_teach_content")
    graph.add_edge("generate_teach_content", "save_path")
    graph.add_edge("save_path", "index_teach_to_kb")
    graph.add_edge("index_teach_to_kb", END)

    return graph.compile()
