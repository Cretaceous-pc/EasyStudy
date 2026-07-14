"""
资源入库服务 — 将 AI 生成的资源持久化到 MinIO + course_materials + 向量库

流程:
  1. 将资源 content 转换为 Markdown 文本
  2. 上传 Markdown 到 MinIO
  3. 在 course_materials 表创建记录
  4. 切割文档 → chunks
  5. 向量化 → Chroma
  6. 写入 knowledge_chunks 表
"""

import hashlib
import io
import json
import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)


def resource_content_to_markdown(resource_type: str, content: dict) -> str:
    """将资源 content 字典转换为 Markdown 字符串"""
    if resource_type == "document":
        return content.get("markdown", content.get("text", json.dumps(content, ensure_ascii=False)))
    elif resource_type == "mermaid":
        code = content.get("mermaid_code", "")
        return f"```mermaid\n{code}\n```"
    elif resource_type == "exercise_set":
        md = ""
        exercises = content.get("exercises", [])
        for i, ex in enumerate(exercises, 1):
            md += f"## 习题 {i}\n\n"
            md += f"**题目**: {ex.get('question', '')}\n\n"
            if ex.get("options"):
                for opt in ex["options"]:
                    md += f"- {opt}\n"
                md += "\n"
            md += f"**答案**: {ex.get('answer', '')}\n\n"
            if ex.get("explanation"):
                md += f"**解析**: {ex.get('explanation', '')}\n\n"
            md += "---\n\n"
        return md
    elif resource_type == "code_case":
        # LLM 已生成完整 Markdown，直接返回
        if "markdown" in content:
            return content["markdown"]
        # 兼容旧格式 {code, language, explanation}
        md = ""
        code = content.get("code", "")
        lang = content.get("language", "")
        md += f"```{lang}\n{code}\n```\n\n"
        if content.get("explanation"):
            md += content["explanation"]
        return md
    elif resource_type == "reading_material":
        return content.get("markdown", content.get("text", json.dumps(content, ensure_ascii=False)))
    else:
        return json.dumps(content, ensure_ascii=False)


def _slug(title: str) -> str:
    """生成 URL 友好的 slug"""
    slug = title.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s]+', '-', slug)
    return slug[:80]


def ingest_resource(
    resource_id: int,
    resource_type: str,
    title: str,
    topic: str,
    content: dict,
    course_id: int,
    student_id: int,
) -> dict:
    """
    将 AI 生成的资源入库：MinIO + course_materials + 向量化

    Returns:
        {"material_id": int, "file_url": str, "chunk_count": int}
    """
    import os as _os

    from services.minio_client import get_minio_client
    from services.db import get_connection
    from services.config import get_settings
    from rag.splitter import get_splitter

    settings = get_settings()
    minio_client = get_minio_client()
    bucket = "materials"

    # ── 步骤1: 内容 → Markdown ──
    logger.info(f"[ingest] 资源 {resource_id} ({resource_type}) 开始入库")
    md_content = resource_content_to_markdown(resource_type, content)
    if not md_content.strip():
        logger.warning(f"[ingest] 资源 {resource_id} 内容为空，跳过入库")
        return {"material_id": None, "file_url": None, "chunk_count": 0}

    # ── 步骤2: 上传 MinIO ──
    type_dir = {
        "document": "documents",
        "mermaid": "mermaid",
        "exercise_set": "exercises",
        "code_case": "code",
        "reading_material": "reading",
    }.get(resource_type, "other")

    object_name = (
        f"course-{course_id}/ai-generated/{type_dir}/"
        f"r{resource_id}-{_slug(title)}.md"
    )
    data = md_content.encode("utf-8")
    minio_client.put_object(
        bucket_name=bucket,
        object_name=object_name,
        data=io.BytesIO(data),
        length=len(data),
        content_type="text/markdown",
    )
    file_url = object_name
    logger.info(f"[ingest] MinIO 上传完成: {object_name}")

    # ── 步骤3: 创建 course_materials 记录 ──
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO course_materials 
                   (course_id, title, material_type, file_url, file_size, 
                    chapter, processing_status, uploaded_by)
                   VALUES (%s, %s, %s, %s, %s, %s, 'completed', %s)
                   RETURNING id""",
                (
                    course_id,
                    title,
                    f"ai_{resource_type}",
                    file_url,
                    len(data),
                    "AI生成",
                    student_id,
                ),
            )
            material_id = cur.fetchone()[0]
    logger.info(f"[ingest] course_materials 记录: id={material_id}")

    # ── 步骤4: 切割文档 ──
    splitter = get_splitter()
    chunks = splitter(md_content)
    if not chunks:
        logger.warning(f"[ingest] 资源 {resource_id} 切割后无 chunk")
        return {"material_id": material_id, "file_url": file_url, "chunk_count": 0}

    # ── 步骤5: 向量化 → Chroma ──
    from rag.vectorstore import get_vectorstore

    vs = get_vectorstore("easystudy_chunks")
    chunk_hashes = [hashlib.md5(t.encode("utf-8")).hexdigest()[:12] for t in chunks]
    chunk_ids = [f"course-{course_id}-m{material_id}-{i}" for i in range(len(chunks))]
    chunk_metadatas = [
        {
            "course_id": course_id,
            "material_id": material_id,
            "chapter": "AI生成",
            "title": title,
            "resource_type": resource_type,
            "resource_id": resource_id,
        }
        for _ in chunks
    ]

    vs.add_documents(
        ids=chunk_ids,
        documents=chunks,
        metadatas=chunk_metadatas,
    )
    logger.info(f"[ingest] 向量化完成: {len(chunks)} vectors")

    # ── 步骤6: 写入 knowledge_chunks 表 ──
    with get_connection() as conn:
        with conn.cursor() as cur:
            for i, (text, chunk_hash, vector_id, metadata) in enumerate(
                zip(chunks, chunk_hashes, chunk_ids, chunk_metadatas)
            ):
                cur.execute(
                    """INSERT INTO knowledge_chunks 
                       (course_id, material_id, chunk_index, chunk_text, 
                        chunk_hash, vector_id, metadata)
                       VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb)
                       ON CONFLICT (material_id, chunk_index) 
                       DO UPDATE SET chunk_text = EXCLUDED.chunk_text,
                                     chunk_hash = EXCLUDED.chunk_hash,
                                     vector_id = EXCLUDED.vector_id,
                                     metadata = EXCLUDED.metadata""",
                    (
                        course_id, material_id, i, text, chunk_hash,
                        vector_id, json.dumps(metadata, ensure_ascii=False),
                    ),
                )
            # 回填 chunk_count
            cur.execute(
                "UPDATE course_materials SET chunk_count = %s, updated_at = NOW() WHERE id = %s",
                (len(chunks), material_id),
            )
    logger.info(f"[ingest] knowledge_chunks: {len(chunks)} 条记录")

    return {
        "material_id": material_id,
        "file_url": file_url,
        "chunk_count": len(chunks),
    }
