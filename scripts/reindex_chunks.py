***REMOVED***!/usr/bin/env python3
"""
easyStudy — 知识库批量向量化脚本

从 PostgreSQL knowledge_chunks 表读取所有 chunk，
调用 Embedding API（或 ChromaDB 内置 ONNX 模型）生成向量，
写入 ChromaDB。

用法:
    ***REMOVED*** 本地开发 (API 模式, 需要 .env 中配置 embedding_backend=api)
    cd backend-ai && python ../scripts/reindex_chunks.py

    ***REMOVED*** 服务器 Docker 容器内
    docker exec easystudy-fastapi python scripts/reindex_chunks.py

    ***REMOVED*** 预览模式（不实际写入）
    python scripts/reindex_chunks.py --dry-run

    ***REMOVED*** 指定单个课程
    python scripts/reindex_chunks.py --course-id 5

环境变量 (在 .env 中配置):
    EMBEDDING_BACKEND=api          ***REMOVED*** chroma-builtin | api
    EMBEDDING_MODEL=text-embedding-3-small
    EMBEDDING_API_KEY=...          ***REMOVED*** 默认复用 DEEPSEEK_API_KEY
    EMBEDDING_BASE_URL=...         ***REMOVED*** 默认复用 DEEPSEEK_BASE_URL
"""

import argparse
import os
import sys
import time
import logging
from collections import defaultdict

***REMOVED*** 确保 backend-ai 在 Python 路径中
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_DIR = os.path.dirname(_SCRIPT_DIR)
_BACKEND_AI_DIR = os.path.join(_PROJECT_DIR, "backend-ai")
sys.path.insert(0, _BACKEND_AI_DIR)

import psycopg2
from psycopg2.extras import RealDictCursor

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("reindex")


def parse_args():
    p = argparse.ArgumentParser(description="知识库批量向量化")
    p.add_argument("--dry-run", action="store_true", help="预览模式，不实际写入 ChromaDB")
    p.add_argument("--course-id", type=int, default=0, help="仅处理指定课程 (0=全部)")
    p.add_argument("--batch-size", type=int, default=50, help="每批 upsert 的 chunk 数量 (默认 50)")
    p.add_argument("--no-clear", action="store_true", help="不清除已有向量（增量模式）")
    return p.parse_args()


def get_pg_conn(settings):
    return psycopg2.connect(
        host=settings.db_host,
        port=settings.db_port,
        dbname=settings.db_name,
        user=settings.db_user,
        password=settings.db_password,
    )


def load_chunks(conn, course_id: int = 0):
    """从 PG 读取所有 chunk 记录，按 course_id 分组"""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        if course_id:
            cur.execute(
                """SELECT id, course_id, material_id, chunk_index, chunk_text,
                          vector_id, metadata
                   FROM knowledge_chunks
                   WHERE course_id = %s
                   ORDER BY course_id, material_id, chunk_index""",
                (course_id,),
            )
        else:
            cur.execute(
                """SELECT id, course_id, material_id, chunk_index, chunk_text,
                          vector_id, metadata
                   FROM knowledge_chunks
                   ORDER BY course_id, material_id, chunk_index"""
            )

        rows = cur.fetchall()

    groups = defaultdict(list)
    for r in rows:
        groups[r["course_id"]].append(r)

    return groups


def main():
    args = parse_args()

    ***REMOVED*** 延迟导入，确保 sys.path 已设置
    from services.config import get_settings
    from rag.vectorstore import get_vectorstore

    settings = get_settings()
    emb_backend = settings.embedding_backend

    logger.info("=" * 60)
    logger.info("easyStudy 知识库批量向量化")
    logger.info(f"   Embedding 后端: {emb_backend}")
    if emb_backend == "api":
        logger.info(f"   Embedding 模型: {settings.embedding_model}")
        api_key = settings.embedding_api_key or settings.deepseek_api_key
        base_url = settings.embedding_base_url or settings.deepseek_base_url
        logger.info(f"   API Base URL: {base_url}")
        ***REMOVED*** 只回显是否存在与长度，绝不打印密钥本身（即使是前缀，也已构成信息泄漏）
        logger.info(f"   API Key: **已配置（长度 {len(api_key)}）**" if api_key else "   API Key: **未配置**")
    logger.info(f"   Chroma: {settings.chroma_host}:{settings.chroma_port}")
    logger.info(f"   批次大小: {args.batch_size}")
    if args.dry_run:
        logger.info("   ** DRY RUN 模式 — 不会写入数据 **")
    logger.info("=" * 60)

    ***REMOVED*** ── 连接数据库 ──
    logger.info("连接 PostgreSQL...")
    try:
        pg_conn = get_pg_conn(settings)
    except Exception as e:
        logger.error(f"数据库连接失败: {e}")
        sys.exit(1)

    ***REMOVED*** ── 读取 chunks ──
    logger.info("读取 knowledge_chunks...")
    try:
        course_groups = load_chunks(pg_conn, args.course_id)
    except Exception as e:
        logger.error(f"读取 chunks 失败: {e}")
        pg_conn.close()
        sys.exit(1)
    finally:
        pg_conn.close()

    total_chunks = sum(len(v) for v in course_groups.values())
    if total_chunks == 0:
        logger.warning("knowledge_chunks 表为空！请先导入数据或检查 course_id。")
        return

    logger.info(f"共 {len(course_groups)} 门课程, {total_chunks} 条 chunk")

    ***REMOVED*** ── 显示分布 ──
    for cid in sorted(course_groups.keys()):
        logger.info(f"   course-{cid}: {len(course_groups[cid])} chunks")

    if args.dry_run:
        logger.info("Dry run 完成，退出。")
        return

    ***REMOVED*** ── 连接 ChromaDB ──
    logger.info("连接 ChromaDB...")
    try:
        vs = get_vectorstore("easystudy_chunks")
    except Exception as e:
        logger.error(f"ChromaDB 连接失败: {e}")
        sys.exit(1)

    ***REMOVED*** ── 逐课程处理 ──
    ok = 0
    fail = 0

    for course_id in sorted(course_groups.keys()):
        chunks = course_groups[course_id]
        logger.info(f"\n── 处理 course-{course_id} ({len(chunks)} chunks) ──")

        try:
            ***REMOVED*** 清除旧向量（幂等）
            if not args.no_clear:
                logger.info(f"   清除 course-{course_id} 已有向量...")
                vs.delete_by_course(course_id)

            ***REMOVED*** 批量 upsert
            for i in range(0, len(chunks), args.batch_size):
                batch = chunks[i:i + args.batch_size]
                batch_ids = [c["vector_id"] for c in batch]
                batch_texts = [c["chunk_text"] for c in batch]
                batch_meta = [
                    {
                        **c.get("metadata", {}),
                        "course_id": c["course_id"],
                        "material_id": c["material_id"],
                        "chunk_index": c["chunk_index"],
                    }
                    for c in batch
                ]

                t0 = time.time()
                vs.add_documents(
                    ids=batch_ids,
                    documents=batch_texts,
                    metadatas=batch_meta,
                )
                elapsed = time.time() - t0

                progress = min(i + args.batch_size, len(chunks))
                logger.info(
                    f"   [{progress:4d}/{len(chunks)}] "
                    f"{len(batch)} chunks, {elapsed:.1f}s "
                    f"({len(batch) / elapsed:.0f} docs/s)"
                )
                ok += len(batch)

        except Exception as e:
            logger.error(f"   course-{course_id} 处理失败: {e}")
            fail += len(chunks)
            continue

    ***REMOVED*** ── 验证 ──
    logger.info(f"\n{'=' * 60}")
    logger.info(f"写入完成: {ok} 成功, {fail} 失败")
    try:
        count = vs.count()
        logger.info(f"ChromaDB collection 当前向量数: {count}")
    except Exception as e:
        logger.warning(f"无法获取 count: {e}")
    logger.info("=" * 60)

    if fail > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
