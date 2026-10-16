"""
资源生成路由 — /internal/resources/*

SSE 流式资源生成
"""

import asyncio
import json
import logging
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field

from graphs.resource_gen_graph import compile_resource_gen_graph, ResourceGenState
from services.db import check_enrollment
from services.sse import sse_event, sse_error, sse_done, create_sse_response
from services.deps import get_current_user_id, get_current_user_role

logger = logging.getLogger(__name__)

router = APIRouter()

***REMOVED*** 资源生成总时限：与对话链路保持一致，避免上游挂起时连接被长期占用
***REMOVED*** （原先 ainvoke 没有超时，只靠 SSE 层 300s 静默超时兜底）
RESOURCE_GEN_TIMEOUT_SEC = 240.0

***REMOVED*** ── 编译 ResourceGenState 图 ──
resource_gen_app = compile_resource_gen_graph()

***REMOVED*** 允许的资源类型（与 _RESOURCE_NODE 保持一致，避免拼错类型导致整张图失败）
ResourceTypeName = Literal["document", "mermaid", "exercise_set", "code_case", "reading_material"]


def _require_enrollment(student_id: int, course_id: int) -> None:
    """课程范围接口的统一准入校验（对话链路原本已有，这里补齐其余接口）"""
    if not check_enrollment(student_id, course_id):
        raise HTTPException(status_code=403, detail="未选修该课程，无权访问该课程数据")


class ResourceGenerateRequest(BaseModel):
    """资源生成请求

    长度上限是安全约束而非体验优化：topic 与 requirements 会被拼进提示词，
    生成的"课程资料"随后写入 course_materials / knowledge_chunks / Chroma，
    并被其他学生的问答检索命中。无上限时可用于跨用户的提示词注入，
    同时构成 token 消耗放大（每个资源类型各调一次模型）。
    """
    course_id: int
    topic: str = Field(..., min_length=1, max_length=200)
    resource_types: List[ResourceTypeName] = Field(..., min_length=1, max_length=5)
    conversation_id: Optional[int] = None
    requirements: str = Field(default="", max_length=2000)


@router.post("/resources/generate")
async def generate_resources(
    request: ResourceGenerateRequest,
    user_id: int = Depends(get_current_user_id),
    user_role: str = Depends(get_current_user_role),
):
    """资源生成（SSE 流式）"""
    ***REMOVED*** 准入校验：原实现不校验选课，任何登录用户都能对任意 course_id 生成资源，
    ***REMOVED*** 既消耗大模型额度，也把内容写进该课程的共享知识库（影响其他学生检索）。
    _require_enrollment(user_id, request.course_id)

    ***REMOVED*** 构造初始 State
    initial_state = ResourceGenState(
        student_id=user_id,
        course_id=request.course_id,
        topic=request.topic,
        resource_types=request.resource_types,
        requirements=request.requirements,
        profile={},
        rag_context="",
        resource_plan=[],
        generated={},
        validation_results={},
        generated_count=0,
        failed_count=0,
        resource_ids=[],
        summary_text="",
        error=None,
    )

    async def event_stream():
        """SSE 事件流

        协议约定：无论成功或失败，最后一个事件必须是 done。
        原实现的两条错误分支只发 error 就 return，前端会一直等待
        （与 chat.py 中"发送 error 后必须 send done"的约定不一致）。
        """
        done_sent = False
        try:
            ***REMOVED*** plan 事件
            yield sse_event("plan", {
                "topic": request.topic,
                "resource_types": request.resource_types,
            })

            ***REMOVED*** 执行图（带超时，避免上游挂起时连接一直占用）
            result = await asyncio.wait_for(
                resource_gen_app.ainvoke(initial_state),
                timeout=RESOURCE_GEN_TIMEOUT_SEC,
            )

            ***REMOVED*** 检查错误
            if result.get("error"):
                yield sse_error(result["error"], 50002)
                yield sse_done(generated_count=0, failed_count=0, resource_ids=[])
                done_sent = True
                return

            ***REMOVED*** progress + resource 事件：从 Graph 结果中提取真实数据
            generated = result.get("generated", {})
            resource_ids = result.get("resource_ids", [])
            rid_idx = 0

            for rt in request.resource_types:
                gen_result = generated.get(rt, {})
                has_error = bool(gen_result.get("error"))
                yield sse_event("progress", {
                    "resource_type": rt,
                    "status": "failed" if has_error else "completed",
                })
                if not has_error:
                    rid = resource_ids[rid_idx] if rid_idx < len(resource_ids) else None
                    rid_idx += 1
                    raw_title = gen_result.get("title", f"{rt}: {request.topic}")
                    ***REMOVED*** 去掉 LLM 生成的类型前缀 "document: " / "mermaid: " 等
                    clean_title = raw_title
                    for prefix in ["document: ", "mermaid: ", "exercise_set: ",
                                   "code_case: ", "reading_material: ",
                                   "Document: ", "Mermaid: ", "Exercise_set: ",
                                   "Code_case: ", "Reading_material: "]:
                        if clean_title.startswith(prefix):
                            clean_title = clean_title[len(prefix):]
                            break
                    yield sse_event("resource", {
                        "resource_type": rt,
                        "resource_id": rid,
                        "title": clean_title,
                        "topic": request.topic,
                        "status": "generated",
                    })

            ***REMOVED*** done 事件
            yield sse_done(
                generated_count=result.get("generated_count", 0),
                failed_count=result.get("failed_count", 0),
                resource_ids=result.get("resource_ids", []),
            )
            done_sent = True

        except asyncio.TimeoutError:
            logger.error("Resource generation timed out after %ss", RESOURCE_GEN_TIMEOUT_SEC)
            yield sse_error("资源生成超时，请稍后重试或减少资源数量", 50002)
        except Exception as e:
            logger.error("Resource generation error: %s", str(e), exc_info=True)
            yield sse_error("资源生成失败，请稍后重试", 50002)
        finally:
            ***REMOVED*** 兜底：任何异常路径都必须补一个 done，否则前端永久等待
            if not done_sent:
                yield sse_done(generated_count=0, failed_count=0, resource_ids=[])

    return create_sse_response(event_stream())


@router.get("/resources")
async def list_resources(
    course_id: int = Query(...),
    resource_type: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: int = Depends(get_current_user_id),
):
    """资源列表"""
    from services.db import get_available_resources
    _require_enrollment(user_id, course_id)
    resources = get_available_resources(user_id, course_id)

    ***REMOVED*** 过滤
    filtered = resources
    if resource_type:
        filtered = [r for r in filtered if r["resource_type"] == resource_type]
    if topic:
        filtered = [r for r in filtered if topic in (r.get("topic") or "")]

    ***REMOVED*** 分页
    total = len(filtered)
    start = (page - 1) * page_size
    items = filtered[start:start + page_size]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/resources/{resource_id}")
async def get_resource_detail(
    resource_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """资源详情"""
    from services.db import get_resource_by_id
    resource = get_resource_by_id(resource_id, user_id)
    if not resource:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="资源不存在")
    return resource


@router.get("/resources/{resource_id}/download")
async def download_resource(
    resource_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """
    下载资源文件（Markdown 格式）

    优先从 MinIO 获取已入库的文件；若 MinIO 不可用则根据 DB content 实时生成。
    """
    import io
    import re as _re
    from services.db import get_resource_by_id
    from fastapi.responses import StreamingResponse

    resource = get_resource_by_id(resource_id, user_id)
    if not resource:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="资源不存在")

    resource_type = resource.get("resource_type", "document")
    title = resource.get("title", "resource")
    content = resource.get("content", {})
    if isinstance(content, str):
        import json as _json
        try:
            content = _json.loads(content)
        except (ValueError, TypeError):
            content = {"raw": content}

    def _content_to_md(rt: str, c: dict) -> str:
        """将资源 content 转为 Markdown（内联版）"""
        if rt == "document":
            return c.get("markdown", c.get("text", str(c)))
        if rt == "mermaid":
            return f"```mermaid\n{c.get('mermaid_code', '')}\n```"
        if rt == "exercise_set":
            md = ""
            for ex in c.get("exercises", []):
                md += f"***REMOVED******REMOVED*** {ex.get('question', '')}\n\n"
                for opt in ex.get("options", []):
                    md += f"- {opt}\n"
                md += f"\n**答案**: {ex.get('answer', '')}\n\n"
                if ex.get("explanation"):
                    md += f"**解析**: {ex.get('explanation', '')}\n\n"
                md += "---\n\n"
            return md
        if rt == "code_case":
            ***REMOVED*** LLM 已生成完整 Markdown，直接返回
            if "markdown" in c:
                return c["markdown"]
            return f"```{c.get('language', '')}\n{c.get('code', '')}\n```\n\n{c.get('explanation', '')}"
        if rt == "reading_material":
            return c.get("markdown", c.get("text", str(c)))
        return str(c)

    def _slugify(s: str) -> str:
        s = s.lower().strip()
        ***REMOVED*** 只保留 ASCII 字母数字、空格、连字符，中文全部移除
        s = _re.sub(r'[^\x00-\x7F]+', '', s)  ***REMOVED*** 先移除所有非 ASCII
        s = _re.sub(r'[^\w\s-]', '', s, flags=_re.ASCII)
        s = _re.sub(r'\s+', '-', s)
        return s.strip('-')[:80] or 'resource'

    ***REMOVED*** 尝试从 MinIO 获取已入库文件
    try:
        from services.minio_client import get_minio_client
        from services.config import get_settings

        settings = get_settings()
        minio_client = get_minio_client()
        type_dir = {
            "document": "documents",
            "mermaid": "mermaid",
            "exercise_set": "exercises",
            "code_case": "code",
            "reading_material": "reading",
        }.get(resource_type, "other")
        course_id = resource.get("course_id", 0)
        object_name = (
            f"course-{course_id}/ai-generated/{type_dir}/"
            f"r{resource_id}-{_slugify(title)}.md"
        )
        obj = minio_client.get_object("materials", object_name)
        return StreamingResponse(
            io.BytesIO(obj.read()),
            media_type="text/markdown; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{_slugify(title)}.md"',
            },
        )
    except Exception:
        pass

    ***REMOVED*** Fallback: 从 DB content 实时生成
    md_content = _content_to_md(resource_type, content)
    return StreamingResponse(
        io.BytesIO(md_content.encode("utf-8")),
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{_slugify(title)}.md"',
        },
    )


@router.delete("/resources/{resource_id}")
async def delete_resource(
    resource_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """删除资源（DB + MinIO）"""
    from services.db import get_resource_by_id, delete_resource as db_delete_resource
    from services.minio_client import get_minio_client

    ***REMOVED*** 校验资源存在且属于当前用户
    resource = get_resource_by_id(resource_id, user_id)
    if not resource:
        raise HTTPException(status_code=404, detail="资源不存在或无权访问")

    ***REMOVED*** 尝试删除 MinIO 文件（路径须与 resource_ingest.ingest_resource 一致）
    try:
        import re as _re

        def _slugify(s: str) -> str:
            s = s.lower().strip()
            s = _re.sub(r'[^\x00-\x7F]+', '', s)
            s = _re.sub(r'[^\w\s-]', '', s, flags=_re.ASCII)
            s = _re.sub(r'\s+', '-', s)
            return s.strip('-')[:80] or 'resource'

        minio_client = get_minio_client()
        resource_type = resource.get("resource_type", "document")
        type_dir = {
            "document": "documents", "mermaid": "mermaid",
            "exercise_set": "exercises", "code_case": "code",
            "reading_material": "reading",
        }.get(resource_type, "other")
        title = resource.get("title", f"{resource_type}: {resource_id}")
        object_name = (
            f"course-{resource['course_id']}/ai-generated/{type_dir}/"
            f"r{resource_id}-{_slugify(title)}.md"
        )
        minio_client.remove_object("materials", object_name)
        logger.info(f"[delete_resource] MinIO 文件已删除: {object_name}")
    except Exception as e:
        logger.warning(f"[delete_resource] MinIO 删除失败（继续删除DB记录）: {e}")

    ***REMOVED*** 删除 DB 记录
    db_delete_resource(resource_id)
    logger.info(f"[delete_resource] 资源已删除: id={resource_id}, student={user_id}")

    return {"deleted": True, "resource_id": resource_id}
