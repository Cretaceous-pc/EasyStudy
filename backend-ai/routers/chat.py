"""
对话路由 — /internal/chat/*

SSE 流式对话接口
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from graphs.chat_graph import compile_chat_graph, ChatState
from services.sse import sse_event, sse_error, sse_done, create_sse_response
from services.deps import get_current_user_id, get_current_user_role

logger = logging.getLogger(__name__)

router = APIRouter()

# ── 编译 ChatState 图 ──
chat_app = compile_chat_graph()


class ChatSendRequest(BaseModel):
    """发送消息请求"""
    course_id: int
    conversation_id: Optional[int] = None
    message: str = Field(..., min_length=1, max_length=10000, description="用户消息，限制 10000 字符")
    material_id: Optional[int] = None   # 课件 ID，用于课件级会话绑定
    context_type: Optional[str] = None  # 'general' | 'courseware' | 'exercise'
    context: Optional[dict] = None      # 可选附加上下文


class ConversationListResponse(BaseModel):
    """对话列表响应"""
    items: list
    total: int


@router.post("/chat/send")
async def chat_send(
    request: ChatSendRequest,
    user_id: int = Depends(get_current_user_id),
    user_role: str = Depends(get_current_user_role),
):
    """发送消息（SSE 流式）"""
    # 加载课程标题、画像和对话历史
    from services.db import get_course_title, load_profile, get_conversation_messages
    course_title = get_course_title(request.course_id) or ""
    try:
        profile_data = load_profile(user_id, request.course_id)
        profile = profile_data.get("profile", {}) if profile_data else {}
    except Exception:
        profile = {}

    # 加载历史消息作为上下文
    history_summary = ""
    if request.conversation_id:
        try:
            hist = get_conversation_messages(request.conversation_id, user_id, limit=20)
            msgs = hist.get("items", [])
            if msgs:
                lines = []
                for m in msgs[-10:]:  # 最近10条
                    role_label = "用户" if m["role"] == "user" else "助手"
                    lines.append(f"[{role_label}]: {m['content'][:200]}")
                history_summary = "\n".join(lines)
        except Exception:
            pass

    # 构造初始 State
    initial_state = ChatState(
        student_id=user_id,
        course_id=request.course_id,
        course_title=course_title,
        conversation_id=request.conversation_id,
        user_message=request.message,
        history_summary=history_summary,
        intent=None,
        profile=profile,
        enrolled_courses=[],
        retrieved_docs=[],
        assistant_reply="",
        reply_chunks=[],
        actions=[],
        resource_gen_request=None,
        resource_gen_result=None,
        error=None,
        done=False,
    )

    async def event_stream():
        """SSE 事件流"""
        try:
            # 新对话创建事件
            new_conv_id = request.conversation_id
            if new_conv_id is None:
                from services.db import create_conversation
                title = request.message[:30] if len(request.message) > 30 else request.message
                new_conv_id = create_conversation(
                    user_id, request.course_id, title,
                    material_id=request.material_id,
                    context_type=request.context_type or "general",
                )
                yield sse_event("conversation_created", {
                    "conversation_id": new_conv_id,
                    "title": title,
                    "material_id": request.material_id,
                })

            # 更新 initial_state 中的 conversation_id
            initial_state["conversation_id"] = new_conv_id

            # 执行 LangGraph 图（90 秒总超时 — 复杂图表生成需要更长时间）
            import asyncio
            try:
                result = await asyncio.wait_for(
                    chat_app.ainvoke(initial_state),
                    timeout=90.0,
                )
            except asyncio.TimeoutError:
                logger.error(f"Chat graph timeout for user={user_id}, course={request.course_id}")
                yield sse_error("AI 处理超时，请稍后重试或缩短问题", 50001)
                yield sse_done(conversation_id=new_conv_id)
                return

            # 检查错误 — 发送 error 后必须 send done，否则前端永远等待
            if result.get("error"):
                yield sse_error(result["error"], 50001)
                yield sse_done(conversation_id=new_conv_id)
                return

            # 流式输出回复
            for chunk in result.get("reply_chunks", []):
                yield sse_event("message", {
                    "role": "assistant",
                    "content": chunk,
                    "done": False,
                })

            # 最后一条 message 事件标记 done
            yield sse_event("message", {
                "role": "assistant",
                "content": "",
                "done": True,
            })

            # action 事件
            for action in result.get("actions", []):
                yield sse_event("action", action)

            # done 事件
            yield sse_done(conversation_id=new_conv_id)

        except Exception as e:
            logger.error("Chat generation error: %s", str(e), exc_info=True)
            yield sse_error(f"对话生成失败: {str(e)[:100]}", 50001)
            yield sse_done(conversation_id=None)

    return create_sse_response(event_stream())


@router.get("/chat/conversations")
async def list_conversations(
    course_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: int = Depends(get_current_user_id),
):
    """对话列表"""
    from services.db import get_conversations
    return get_conversations(user_id, course_id=course_id, page=page, page_size=page_size)


@router.get("/chat/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: int,
    before_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    user_id: int = Depends(get_current_user_id),
):
    """对话历史"""
    from services.db import get_conversation_messages
    return get_conversation_messages(conversation_id, user_id, before_id=before_id, limit=limit)


class ByMaterialQuery(BaseModel):
    """课件级会话查询"""
    course_id: int
    material_id: int


@router.get("/chat/conversations/by-material")
async def get_conversation_for_material(
    course_id: int = Query(...),
    material_id: int = Query(...),
    user_id: int = Depends(get_current_user_id),
):
    """获取指定课件的活跃会话（用于课件点击时判断是否已有历史对话）"""
    from services.db import get_conversation_by_material
    conv = get_conversation_by_material(user_id, course_id, material_id)
    if conv:
        return {"exists": True, "conversation": conv}
    return {"exists": False, "conversation": None}


@router.post("/chat/conversations/new")
async def create_new_session(
    body: ByMaterialQuery,
    user_id: int = Depends(get_current_user_id),
):
    """对同一课件创建新会话（旧会话归档）"""
    from services.db import get_conversation_by_material, archive_conversation, create_conversation
    from services.db import get_course_title as db_get_course_title

    # 归档旧会话
    existing = get_conversation_by_material(user_id, body.course_id, body.material_id)
    if existing:
        archive_conversation(existing["conversation_id"], user_id)

    # 创建新会话
    course_title = db_get_course_title(body.course_id) or "课程"
    title = f"{course_title} · 课件 {body.material_id}"
    new_id = create_conversation(
        user_id, body.course_id, title,
        material_id=body.material_id, context_type="courseware",
    )
    return {"conversation_id": new_id, "title": title}


@router.delete("/chat/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """删除（归档）指定会话，仅允许会话所有者操作"""
    from services.db import archive_conversation, get_connection

    # 直接查询归属（get_conversation_messages 对无权限返回空列表而非错误，不可用于鉴权）
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM conversations WHERE id = %s AND student_id = %s AND status = 'active'",
                (conversation_id, user_id),
            )
            if not cur.fetchone():
                return {"code": 40401, "message": "会话不存在或无权访问"}

    success = archive_conversation(conversation_id, user_id)
    if not success:
        return {"code": 40401, "message": "会话不存在或无权访问"}
    return {"code": 0, "message": "已删除"}
