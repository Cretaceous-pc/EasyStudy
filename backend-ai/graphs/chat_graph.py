"""
ChatState 图 — 对话路由 + 意图分发

节点: guard → route_intent → retrieve → generate_reply → trigger_profile_update → record_message
条件分支: route_intent → delegate_resource (资源生成子图)
"""

import logging
from typing import TypedDict, List, Optional

from langgraph.graph import StateGraph, END

from services.config import get_settings

logger = logging.getLogger(__name__)


class ChatState(TypedDict):
    # ── 请求上下文 ──
    student_id: int
    course_id: int
    course_title: str
    conversation_id: Optional[int]

    # ── 当前轮次 ──
    user_message: str
    history_summary: str
    intent: Optional[str]  # "chat" | "generate_resource" | "update_profile" | "get_path"

    # ── 学生上下文 ──
    profile: dict
    enrolled_courses: List[dict]

    # ── 检索上下文 ──
    retrieved_docs: List[dict]

    # ── 生成结果 ──
    assistant_reply: str
    reply_chunks: List[str]
    actions: List[dict]

    # ── 子图委派 ──
    resource_gen_request: Optional[dict]
    resource_gen_result: Optional[dict]

    # ── 状态标记 ──
    error: Optional[str]
    done: bool


# ── 辅助函数 ──

def _format_profile_for_prompt(profile: dict) -> dict:
    """从画像 JSONB 中提取各维度的 label，格式化为 Prompt 变量"""
    if not profile:
        return {
            "profile_knowledge_base": "未知",
            "profile_learning_goal": "未知",
            "profile_cognitive_style": "未知",
            "profile_learning_pace": "未知",
            "profile_error_prone_points": "无",
            "profile_engagement": "未知",
        }
    return {
        "profile_knowledge_base": profile.get("knowledge_base", {}).get("label", "未知"),
        "profile_learning_goal": profile.get("learning_goal", {}).get("label", "未知"),
        "profile_cognitive_style": profile.get("cognitive_style", {}).get("label", "未知"),
        "profile_learning_pace": profile.get("learning_pace", {}).get("label", "未知"),
        "profile_error_prone_points": profile.get("error_prone_points", {}).get("label", "无"),
        "profile_engagement": profile.get("engagement", {}).get("label", "未知"),
    }


def _has_profile(profile: dict) -> bool:
    """判断画像是否已建立（至少有一个维度有值）"""
    if not profile:
        return False
    dimensions = ["knowledge_base", "learning_goal", "cognitive_style", "error_prone_points", "learning_pace", "engagement"]
    return any(profile.get(d, {}).get("value") for d in dimensions)


# ── 节点函数 ──

def guard_check(state: ChatState) -> dict:
    """鉴权 + 课程权限校验 — 查询 DB 验证选课关系"""
    student_id = state.get("student_id")
    course_id = state.get("course_id")

    if not student_id or not course_id:
        return {"error": "缺少学生ID或课程ID"}

    try:
        from services.db import check_enrollment, get_course_title

        if not check_enrollment(student_id, course_id):
            return {"error": f"未选修该课程(course_id={course_id})，无法发起对话"}

        # 同时加载课程标题
        title = get_course_title(course_id) or ""
        return {"course_title": title}
    except Exception as e:
        logger.error("guard_check DB error: %s", str(e), exc_info=True)
        return {"error": "选课验证服务异常，请稍后重试"}


async def classify_intent(state: ChatState) -> dict:
    """路由智能体: 调用 DeepSeek 分类用户意图"""
    from services.deepseek_client import deepseek_generate
    from prompts.chat_prompts import PROMPT_INTENT_CLASSIFY

    user_message = state.get("user_message", "")
    history_summary = state.get("history_summary", "（无历史对话）")

    prompt = PROMPT_INTENT_CLASSIFY.format(
        user_message=user_message,
        history_summary=history_summary,
    )

    try:
        result = await deepseek_generate(
            prompt=prompt,
            system="你是一个意图分类器。只输出意图标签，不要任何其他文字。",
            model="deepseek-chat",
            timeout=15.0,
        )
        intent = result.strip().strip('"').strip("'")
        # 规范化：只保留已知的意图标签
        valid_intents = {"chat", "generate_resource", "update_profile", "get_path"}
        if intent not in valid_intents:
            logger.warning(f"Unknown intent '{intent}', defaulting to 'chat'")
            intent = "chat"
        logger.info(f"[intent] classified as: {intent}")
        return {"intent": intent}
    except Exception as e:
        logger.error(f"[intent] classification failed: {e}, defaulting to 'chat'")
        return {"intent": "chat"}


def retrieve_context(state: ChatState) -> dict:
    """RAG 检索相关 chunk"""
    from rag.retriever import get_retriever, format_retrieved_docs

    course_id = state.get("course_id")
    user_message = state.get("user_message", "")

    if not course_id or not user_message:
        return {"retrieved_docs": []}

    try:
        retriever = get_retriever(course_id, top_k=5)
        docs = retriever(user_message)
        logger.info(f"[rag] retrieved {len(docs)} chunks for course={course_id}")
        return {"retrieved_docs": docs}
    except Exception as e:
        logger.error(f"[rag] retrieval failed: {e}")
        return {"retrieved_docs": []}


async def generate_answer(state: ChatState) -> dict:
    """生成回答：注入画像 + RAG 上下文，调用 DeepSeek 流式生成"""
    from services.deepseek_client import deepseek_stream
    from prompts.chat_prompts import PROMPT_RAG_QA, PROMPT_COLD_START_GUIDE
    from rag.retriever import format_retrieved_docs

    user_message = state.get("user_message", "")
    course_title = state.get("course_title", "未知课程")
    profile = state.get("profile", {})
    history_summary = state.get("history_summary", "")
    retrieved_docs = state.get("retrieved_docs", [])

    try:
        # 格式化 RAG 上下文
        rag_context = format_retrieved_docs(retrieved_docs)

        # 判断是否有画像：无画像 → 冷启动引导；有画像 → RAG 增强问答
        has_profile = _has_profile(profile)

        if not has_profile:
            prompt = PROMPT_COLD_START_GUIDE.format(
                user_message=user_message,
                history_summary=history_summary or "（无历史对话）",
                rag_context=rag_context,
            )
            system = "你是 easyStudy 的学习助手。优先用课程资料回答问题，同时自然地了解学生的学习背景。"
        else:
            profile_vars = _format_profile_for_prompt(profile)
            prompt = PROMPT_RAG_QA.format(
                course_title=course_title,
                history_summary=history_summary or "（无历史对话）",
                rag_context=rag_context,
                user_message=user_message,
                **profile_vars,
            )
            system = f"你是课程「{course_title}」的 AI 助教，只能基于课程资料回答问题。"

        # 流式收集 chunks，失败则降级为非流式
        chunks = []
        try:
            async for chunk in deepseek_stream(
                prompt=prompt,
                system=system,
                model="deepseek-chat",
            ):
                chunks.append(chunk)
        except Exception as stream_err:
            logger.warning(f"Streaming failed ({stream_err}), falling back to non-streaming")
            from services.deepseek_client import deepseek_generate
            reply_text = await deepseek_generate(prompt=prompt, system=system, model="deepseek-chat")
            if reply_text:
                # 模拟流式分块
                for char in reply_text:
                    chunks.append(char)
            else:
                raise

        reply = "".join(chunks).strip()
        if not reply:
            reply = "抱歉，我暂时无法生成回复。请稍后再试。"

        logger.info(f"[generate] reply length: {len(reply)} chars, chunks: {len(chunks)}")
        return {
            "assistant_reply": reply,
            "reply_chunks": chunks,
            "done": True,
        }

    except Exception as e:
        logger.error(f"[generate] answer generation failed: {e}")
        error_reply = f"抱歉，生成回复时出错：{str(e)[:100]}"
        return {
            "assistant_reply": error_reply,
            "reply_chunks": [error_reply],
            "done": True,
        }


async def save_messages(state: ChatState) -> dict:
    """持久化消息到 DB"""
    from services.db import create_conversation, save_message

    student_id = state.get("student_id")
    course_id = state.get("course_id")
    conversation_id = state.get("conversation_id")
    user_message = state.get("user_message", "")
    assistant_reply = state.get("assistant_reply", "")

    result = {}

    try:
        # 如果没有对话 ID，创建新对话
        if not conversation_id:
            title = user_message[:30] if len(user_message) > 30 else user_message
            conversation_id = create_conversation(student_id, course_id, title)
            result["conversation_id"] = conversation_id
            logger.info(f"[db] created conversation id={conversation_id}")

        # 保存用户消息
        save_message(conversation_id, "user", user_message)
        logger.info(f"[db] saved user message in conv={conversation_id}")

        # 保存助手回复
        if assistant_reply:
            save_message(conversation_id, "assistant", assistant_reply)
            logger.info(f"[db] saved assistant reply in conv={conversation_id}")

    except Exception as e:
        logger.error(f"[db] save messages failed: {e}", exc_info=True)

    # LangGraph 要求节点必须写入至少一个 State 字段
    if not result:
        result = {"done": True}
    return result


async def maybe_update_profile(state: ChatState) -> dict:
    """条件触发画像更新：加载画像 → 获取最近对话 → ainvoke ProfileUpdateState 图"""
    import json
    from services.db import load_profile, get_recent_conversation_messages, get_existing_profile_json
    from graphs.profile_graph import compile_profile_graph, ProfileUpdateState

    student_id = state["student_id"]
    course_id = state["course_id"]
    actions = []

    try:
        # 加载当前画像
        profile_data = load_profile(student_id, course_id)
        current_profile = profile_data["profile"]
        current_version = profile_data["version"]

        # 获取最近对话消息
        messages = get_recent_conversation_messages(student_id, course_id, limit=10)

        # 决定是否触发：画像为空（首次）或对话轮次 >= 3 且有足够内容
        should_trigger = False
        if not current_profile or current_version == 0:
            should_trigger = True
            logger.info(f"[profile] cold-start trigger for student={student_id} course={course_id}")
        elif len(messages) >= 3:
            should_trigger = True
            logger.info(f"[profile] conversation trigger: {len(messages)} recent messages")

        if should_trigger:
            # 构造画像状态
            profile_state: ProfileUpdateState = {
                "student_id": student_id,
                "course_id": course_id,
                "trigger": "conversation",
                "conversation_messages": messages,
                "behavior_events": None,
                "current_profile": current_profile,
                "current_version": current_version,
                "extracted_dimensions": {},
                "changes": {},
                "needs_update": False,
                "updated_profile": None,
                "new_version": None,
            }

            # 直接 await 异步调用
            profile_app = compile_profile_graph()
            result = await profile_app.ainvoke(profile_state)

            if result and result.get("needs_update"):
                dimension_names = [c.get("dimension", "") for c in result.get("changes", [])]
                actions.append({
                    "action": "profile_updated",
                    "dimensions": dimension_names,
                    "version": result.get("new_version"),
                })
                logger.info(
                    f"[profile] updated: dimensions={dimension_names} "
                    f"version={result.get('new_version')}"
                )
            else:
                logger.info("[profile] no significant changes detected")
    except Exception as e:
        logger.error(f"[profile] update failed: {e}", exc_info=True)

    return {"actions": actions}


async def delegate_resource_node(state: ChatState) -> dict:
    """调用资源生成子图 — 从聊天意图触发资源生成"""
    from graphs.resource_gen_graph import compile_resource_gen_graph, ResourceGenState

    student_id = state.get("student_id", 0)
    course_id = state.get("course_id", 0)
    user_message = state.get("user_message", "")
    profile = state.get("profile", {})

    try:
        # 构造资源生成状态：默认生成全部 5 种类型
        resource_state: ResourceGenState = {
            "student_id": student_id,
            "course_id": course_id,
            "topic": user_message[:100],
            "resource_types": ["document", "mermaid", "exercise_set", "code_case", "reading_material"],
            "profile": profile,
            "rag_context": "",
            "resource_plan": [],
            "generated": {},
            "validation_results": {},
            "generated_count": 0,
            "failed_count": 0,
            "resource_ids": [],
            "summary_text": "",
            "error": None,
        }

        resource_app = compile_resource_gen_graph()
        result = await resource_app.ainvoke(resource_state)

        reply_parts = [f"已为你生成 {result.get('generated_count', 0)} 个学习资源"]
        failed = result.get("failed_count", 0)
        if failed > 0:
            reply_parts.append(f"（{failed} 个失败）")
        reply_parts.append("，请切换到「资源生成」面板查看。")

        return {
            "assistant_reply": "".join(reply_parts),
            "reply_chunks": ["".join(reply_parts)],
            "done": True,
        }
    except Exception as e:
        logger.error(f"[delegate_resource] failed: {e}", exc_info=True)
        return {
            "assistant_reply": "抱歉，资源生成失败，请稍后重试或切换到资源生成面板手动生成。",
            "reply_chunks": ["抱歉，资源生成失败，请稍后重试或切换到资源生成面板手动生成。"],
            "done": True,
        }


# ── 条件边函数 ──

def after_guard(state: ChatState) -> str:
    """guard 检查后：失败→END，成功→route_intent"""
    if state.get("error"):
        return "__end__"
    return "route_intent"


def after_route(state: ChatState) -> str:
    if state.get("error"):
        return "record_message"
    intent = state.get("intent", "chat")
    if intent == "generate_resource":
        return "delegate_resource"
    return "retrieve"


# ── 编译函数 ──

def compile_chat_graph():
    """编译 ChatState 图"""
    graph = StateGraph(ChatState)

    # 添加节点
    graph.add_node("guard", guard_check)
    graph.add_node("route_intent", classify_intent)
    graph.add_node("retrieve", retrieve_context)
    graph.add_node("generate_reply", generate_answer)
    graph.add_node("record_message", save_messages)
    graph.add_node("trigger_profile_update", maybe_update_profile)
    graph.add_node("delegate_resource", delegate_resource_node)

    # 入口
    graph.set_entry_point("guard")

    # 边
    graph.add_conditional_edges("guard", after_guard, {
        "route_intent": "route_intent",
        "__end__": END,
    })
    graph.add_conditional_edges("route_intent", after_route, {
        "retrieve": "retrieve",
        "delegate_resource": "delegate_resource",
        "record_message": "record_message",
    })
    graph.add_edge("retrieve", "generate_reply")
    graph.add_edge("generate_reply", "trigger_profile_update")
    graph.add_edge("trigger_profile_update", "record_message")
    graph.add_edge("record_message", END)
    graph.add_edge("delegate_resource", "record_message")

    return graph.compile()
