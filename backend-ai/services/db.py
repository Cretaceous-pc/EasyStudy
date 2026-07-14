"""数据库工具 — 复用 psycopg2 连接，提供查询方法"""

import logging
from contextlib import contextmanager

from psycopg2 import connect as pg_connect
from psycopg2.pool import SimpleConnectionPool

from services.config import get_settings

logger = logging.getLogger(__name__)

_pool: SimpleConnectionPool | None = None


def _get_pool() -> SimpleConnectionPool:
    """获取连接池（懒初始化，全局复用）"""
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = SimpleConnectionPool(
            minconn=1,
            maxconn=5,
            host=settings.db_host,
            port=settings.db_port,
            dbname=settings.db_name,
            user=settings.db_user,
            password=settings.db_password,
            connect_timeout=5,
        )
        logger.info("PostgreSQL connection pool initialized")
    return _pool


@contextmanager
def get_connection():
    """获取数据库连接（上下文管理器，自动归还连接池）"""
    pool = _get_pool()
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


def check_enrollment(student_id: int, course_id: int) -> bool:
    """验证学生是否选了指定课程"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM course_enrollments WHERE course_id = %s AND student_id = %s",
                (course_id, student_id),
            )
            return cur.fetchone() is not None


def get_course_title(course_id: int) -> str | None:
    """获取课程标题"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT title FROM courses WHERE id = %s",
                (course_id,),
            )
            row = cur.fetchone()
            return row[0] if row else None


# ── 画像相关 ──

def load_profile(student_id: int, course_id: int) -> dict:
    """加载学生画像，返回 {profile, version} 或 None"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT profile, version, last_updated_at FROM student_profiles "
                "WHERE student_id = %s AND course_id = %s",
                (student_id, course_id),
            )
            row = cur.fetchone()
            if row:
                import json
                return {"profile": row[0] if isinstance(row[0], dict) else json.loads(row[0]),
                        "version": row[1],
                        "last_updated_at": row[2].isoformat() if row[2] else None}
            return {"profile": {}, "version": 0}


def save_profile(student_id: int, course_id: int, profile: dict, version: int) -> int:
    """保存/更新画像，返回新版本号。首次插入用 version=1"""
    import json
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO student_profiles (student_id, course_id, profile, version, last_updated_at) "
                "VALUES (%s, %s, %s::jsonb, %s, NOW()) "
                "ON CONFLICT (student_id, course_id) "
                "DO UPDATE SET profile = EXCLUDED.profile, version = EXCLUDED.version, "
                "last_updated_at = NOW()",
                (student_id, course_id, json.dumps(profile, ensure_ascii=False), version),
            )
            return version


def save_profile_snapshot(
    student_id: int, course_id: int, profile: dict, version: int, trigger: str
) -> None:
    """保存画像快照"""
    import json
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO profile_snapshots (student_id, course_id, profile, version, trigger) "
                "VALUES (%s, %s, %s::jsonb, %s, %s)",
                (student_id, course_id, json.dumps(profile, ensure_ascii=False), version, trigger),
            )
            logger.info(
                f"Profile snapshot saved: student={student_id}, course={course_id}, "
                f"version={version}, trigger={trigger}"
            )


def get_profile_history(student_id: int, course_id: int, limit: int = 10) -> list:
    """获取画像变更历史"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT version, profile, trigger, snapshot_at FROM profile_snapshots "
                "WHERE student_id = %s AND course_id = %s "
                "ORDER BY snapshot_at DESC LIMIT %s",
                (student_id, course_id, limit),
            )
            rows = cur.fetchall()
            import json
            return [
                {
                    "version": r[0],
                    "profile": r[1] if isinstance(r[1], dict) else json.loads(r[1]),
                    "trigger": r[2],
                    "snapshot_at": r[3].isoformat() if r[3] else None,
                }
                for r in rows
            ]


# ── 学习路径相关 ──

def get_active_learning_path(student_id: int, course_id: int) -> dict | None:
    """获取当前活跃的学习路径"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, profile_version, status, created_at FROM learning_paths "
                "WHERE student_id = %s AND course_id = %s AND status = 'active' "
                "ORDER BY created_at DESC LIMIT 1",
                (student_id, course_id),
            )
            row = cur.fetchone()
            if not row:
                return None
            path_id = row[0]
            # 获取路径节点
            cur.execute(
                "SELECT id, seq_order, item_type, item_ref_id, title, description, "
                "estimated_minutes, dependencies, detail, teach_content, status, completed_at FROM learning_path_items "
                "WHERE path_id = %s ORDER BY seq_order",
                (path_id,),
            )
            items = [
                {
                    "item_id": r[0], "seq_order": r[1], "item_type": r[2],
                    "item_ref_id": r[3], "title": r[4], "description": r[5],
                    "estimated_minutes": r[6],
                    "dependencies": r[7] if r[7] else [],
                    "detail": r[8] if r[8] else {},
                    "teach_content": r[9] or "",
                    "status": r[10],
                    "completed_at": r[11].isoformat() if r[11] else None,
                }
                for r in cur.fetchall()
            ]
            return {
                "path_id": path_id,
                "profile_version": row[1],
                "status": row[2],
                "items": items,
                "created_at": row[3].isoformat() if row[3] else None,
            }


def save_learning_path(
    student_id: int, course_id: int, profile_version: int, items: list
) -> dict:
    """保存学习路径（废弃旧路径，创建新路径），返回 {path_id, abandoned_path_ids}"""
    import json as _json
    with get_connection() as conn:
        with conn.cursor() as cur:
            # 查询将被废弃的旧路径 ID（用于清理关联数据）
            cur.execute(
                "SELECT id FROM learning_paths "
                "WHERE student_id = %s AND course_id = %s AND status = 'active'",
                (student_id, course_id),
            )
            abandoned_ids = [r[0] for r in cur.fetchall()]

            # 废弃旧路径
            cur.execute(
                "UPDATE learning_paths SET status = 'abandoned', updated_at = NOW() "
                "WHERE student_id = %s AND course_id = %s AND status = 'active'",
                (student_id, course_id),
            )

            # 清理旧路径的知识库切片（path_id 存储在 metadata JSONB 中）
            if abandoned_ids:
                cur.execute(
                    "DELETE FROM knowledge_chunks WHERE (metadata->>'path_id')::int = ANY(%s)",
                    (abandoned_ids,),
                )
                logger.info(
                    f"Cleaned knowledge_chunks for abandoned paths: {abandoned_ids}"
                )

            # 创建新路径
            cur.execute(
                "INSERT INTO learning_paths (student_id, course_id, profile_version, status) "
                "VALUES (%s, %s, %s, 'active') RETURNING id",
                (student_id, course_id, profile_version),
            )
            path_id = cur.fetchone()[0]
            # 插入节点
            for item in items:
                deps = _json.dumps(item.get("dependencies", []))
                detail = _json.dumps(item.get("detail", {}), ensure_ascii=False)
                cur.execute(
                    "INSERT INTO learning_path_items "
                    "(path_id, seq_order, item_type, item_ref_id, title, description, estimated_minutes, dependencies, detail, teach_content) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s)",
                    (
                        path_id,
                        item["seq_order"],
                        item["item_type"],
                        item.get("item_ref_id"),
                        item["title"],
                        item.get("description", ""),
                        item.get("estimated_minutes", 30),
                        deps,
                        detail,
                        item.get("teach_content", ""),
                    ),
                )
            logger.info(
                f"Learning path saved: path_id={path_id}, student={student_id}, "
                f"course={course_id}, items={len(items)}, abandoned={abandoned_ids}"
            )
            return {"path_id": path_id, "abandoned_path_ids": abandoned_ids}


def update_path_item_status(item_id: int, status: str) -> dict | None:
    """更新路径节点状态，返回更新后的节点信息"""
    import json
    with get_connection() as conn:
        with conn.cursor() as cur:
            completed_at = "NOW()" if status == "completed" else "NULL"
            cur.execute(
                f"UPDATE learning_path_items SET status = %s, completed_at = {completed_at} "
                "WHERE id = %s RETURNING id, status, completed_at",
                (status, item_id),
            )
            row = cur.fetchone()
            if not row:
                return None
            return {
                "item_id": row[0],
                "status": row[1],
                "completed_at": row[2].isoformat() if row[2] else None,
            }


def get_course_chapters(course_id: int) -> list:
    """获取课程章节结构"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, title, chapter, section FROM course_materials "
                "WHERE course_id = %s AND processing_status = 'completed' "
                "ORDER BY chapter, section",
                (course_id,),
            )
            return [
                {
                    "material_id": r[0],
                    "title": r[1],
                    "chapter": r[2] or "",
                    "section": r[3] or "",
                }
                for r in cur.fetchall()
            ]


def get_available_resources(student_id: int, course_id: int) -> list:
    """获取学生已有的课程资源"""
    import json as _json
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, resource_type, title, topic, content, created_at FROM resources "
                "WHERE student_id = %s AND course_id = %s AND status = 'completed' "
                "ORDER BY created_at DESC LIMIT 50",
                (student_id, course_id),
            )
            rows = []
            for r in cur.fetchall():
                content = r[4]
                if isinstance(content, str):
                    try:
                        content = _json.loads(content)
                    except (ValueError, TypeError):
                        content = {}
                elif not isinstance(content, dict):
                    content = {}
                rows.append({
                    "resource_id": r[0],
                    "resource_type": r[1],
                    "title": r[2],
                    "topic": r[3],
                    "content": content,
                    "created_at": r[5].isoformat() if r[5] else None,
                })
            return rows


def get_completed_items(student_id: int, course_id: int) -> list:
    """获取已完成的学习项"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            # 已完成路径节点
            cur.execute(
                "SELECT lpi.item_type, lpi.item_ref_id, lpi.completed_at "
                "FROM learning_path_items lpi "
                "JOIN learning_paths lp ON lpi.path_id = lp.id "
                "WHERE lp.student_id = %s AND lp.course_id = %s "
                "AND lpi.status = 'completed' AND lpi.completed_at IS NOT NULL "
                "ORDER BY lpi.completed_at DESC LIMIT 50",
                (student_id, course_id),
            )
            return [
                {"item_type": r[0], "ref_id": r[1],
                 "completed_at": r[2].isoformat() if r[2] else None}
                for r in cur.fetchall()
            ]


def save_teach_chunks(path_id: int, course_id: int, chunks: list) -> None:
    """将教学内容的切片写入 knowledge_chunks 表（material_id=NULL 标记教学来源）"""
    import json as _json
    with get_connection() as conn:
        with conn.cursor() as cur:
            for seq_order, chunk_index, chunk_text, chunk_id in chunks:
                metadata = _json.dumps({
                    "course_id": course_id,
                    "path_id": path_id,
                    "source": "teach_content",
                }, ensure_ascii=False)
                cur.execute(
                    """INSERT INTO knowledge_chunks
                       (course_id, material_id, chunk_index, chunk_text, chunk_hash, vector_id, metadata)
                       VALUES (%s, NULL, %s, %s, '', %s, %s::jsonb)
                       ON CONFLICT DO NOTHING""",
                    (course_id, chunk_index, chunk_text, chunk_id, metadata),
                )
        logger.info(
            f"[save_teach_chunks] path={path_id}: {len(chunks)} chunks written"
        )


# ── 练习相关 ──

def save_exercise_attempt(
    student_id: int, resource_id: int, exercise_index: int,
    student_answer: dict, is_correct: bool | None,
    time_spent_sec: int = 0,
) -> int:
    """保存答题记录，返回 attempt_id"""
    import json
    with get_connection() as conn:
        with conn.cursor() as cur:
            # 获取当前尝试次数
            cur.execute(
                "SELECT COUNT(*) FROM exercise_attempts "
                "WHERE student_id = %s AND resource_id = %s AND exercise_index = %s",
                (student_id, resource_id, exercise_index),
            )
            count = cur.fetchone()[0]
            attempt_number = count + 1

            cur.execute(
                "INSERT INTO exercise_attempts "
                "(student_id, resource_id, exercise_index, student_answer, is_correct, "
                "time_spent_sec, attempt_number) "
                "VALUES (%s, %s, %s, %s::jsonb, %s, %s, %s) RETURNING id",
                (
                    student_id, resource_id, exercise_index,
                    json.dumps(student_answer, ensure_ascii=False),
                    is_correct, time_spent_sec, attempt_number,
                ),
            )
            attempt_id = cur.fetchone()[0]
            logger.info(
                f"Exercise attempt saved: attempt_id={attempt_id}, correct={is_correct}"
            )
            return attempt_id


def get_exercise_history(
    student_id: int, course_id: int | None = None,
    resource_id: int | None = None, page: int = 1, page_size: int = 20,
) -> dict:
    """获取答题历史，支持按课程/资源筛选"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            conditions = ["ea.student_id = %s"]
            params = [student_id]

            if resource_id:
                conditions.append("ea.resource_id = %s")
                params.append(resource_id)
            elif course_id:
                conditions.append("r.course_id = %s")
                params.append(course_id)

            where_clause = " AND ".join(conditions)
            join_clause = "LEFT JOIN resources r ON ea.resource_id = r.id" if course_id else ""

            # 计数
            cur.execute(
                f"SELECT COUNT(*) FROM exercise_attempts ea {join_clause} WHERE {where_clause}",
                params,
            )
            total = cur.fetchone()[0]

            # 分页查询
            offset = (page - 1) * page_size
            select_fields = (
                "ea.id, ea.resource_id, ea.exercise_index, ea.is_correct, "
                "ea.time_spent_sec, ea.attempt_number, ea.created_at"
            )
            if course_id:
                select_fields += ", r.resource_type, r.title"
            else:
                select_fields += ", NULL::varchar, NULL::varchar"

            cur.execute(
                f"SELECT {select_fields} FROM exercise_attempts ea {join_clause} "
                f"WHERE {where_clause} "
                f"ORDER BY ea.created_at DESC LIMIT %s OFFSET %s",
                params + [page_size, offset],
            )
            items = [
                {
                    "attempt_id": r[0], "resource_id": r[1], "exercise_index": r[2],
                    "is_correct": r[3], "time_spent_sec": r[4],
                    "attempt_number": r[5],
                    "created_at": r[6].isoformat() if r[6] else None,
                    "resource_type": r[7], "resource_title": r[8],
                }
                for r in cur.fetchall()
            ]
            return {"items": items, "total": total, "page": page, "page_size": page_size}


def get_exercise_wrong_count(student_id: int, resource_id: int, exercise_index: int) -> int:
    """获取某道题的连续错误次数"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT is_correct FROM exercise_attempts "
                "WHERE student_id = %s AND resource_id = %s AND exercise_index = %s "
                "ORDER BY created_at DESC LIMIT 10",
                (student_id, resource_id, exercise_index),
            )
            wrong_count = 0
            for row in cur.fetchall():
                if row[0] is False:
                    wrong_count += 1
                else:
                    break  # 答对就停止计数
            return wrong_count


def get_recent_conversation_messages(student_id: int, course_id: int, limit: int = 10) -> list:
    """获取最近 N 轮对话消息（用于画像抽取）"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT m.role, m.content, m.created_at FROM messages m "
                "JOIN conversations c ON m.conversation_id = c.id "
                "WHERE c.student_id = %s AND c.course_id = %s "
                "ORDER BY m.created_at DESC LIMIT %s",
                (student_id, course_id, limit),
            )
            return [
                {"role": r[0], "content": r[1],
                 "created_at": r[2].isoformat() if r[2] else None}
                for r in cur.fetchall()
            ]


def get_existing_profile_json(student_id: int, course_id: int) -> dict:
    """获取已有画像（用于首次选课后检查）"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT profile FROM student_profiles "
                "WHERE student_id = %s AND course_id = %s",
                (student_id, course_id),
            )
            row = cur.fetchone()
            if row:
                import json
                return row[0] if isinstance(row[0], dict) else json.loads(row[0])
            return {}


# ── 对话相关 ──

def create_conversation(
    student_id: int, course_id: int, title: str = "",
    material_id: int | None = None, context_type: str = "general",
) -> int:
    """创建新对话，返回 conversation_id"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO conversations (student_id, course_id, title, material_id, context_type) "
                "VALUES (%s, %s, %s, %s, %s) RETURNING id",
                (student_id, course_id, title, material_id, context_type),
            )
            conv_id = cur.fetchone()[0]
            logger.info(
                f"Conversation created: id={conv_id}, student={student_id}, "
                f"material={material_id}, ctx={context_type}"
            )
            return conv_id


def save_message(conversation_id: int, role: str, content: str, metadata: dict | None = None) -> int:
    """保存消息，返回 message_id"""
    import json as _json
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO messages (conversation_id, role, content, metadata) "
                "VALUES (%s, %s, %s, %s::jsonb) RETURNING id",
                (conversation_id, role, content,
                 _json.dumps(metadata or {}, ensure_ascii=False)),
            )
            msg_id = cur.fetchone()[0]
            cur.execute(
                "UPDATE conversations SET updated_at = NOW() WHERE id = %s",
                (conversation_id,),
            )
            return msg_id



def get_conversations(student_id: int, course_id: int | None = None, page: int = 1, page_size: int = 20) -> dict:
    """获取对话列表（仅返回活跃会话）"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            conditions = ["student_id = %s", "status = 'active'"]
            params: list = [student_id]
            if course_id:
                conditions.append("course_id = %s")
                params.append(course_id)
            where = " AND ".join(conditions)

            # 计数
            cur.execute(f"SELECT COUNT(*) FROM conversations WHERE {where}", params)
            total = cur.fetchone()[0]

            # 分页查询
            offset = (page - 1) * page_size
            cur.execute(
                f"SELECT id, course_id, material_id, context_type, title, "
                f"(SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message, "
                f"(SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count, "
                f"created_at, updated_at "
                f"FROM conversations c WHERE {where} "
                f"ORDER BY updated_at DESC LIMIT %s OFFSET %s",
                params + [page_size, offset],
            )
            items = [
                {
                    "conversation_id": r[0],
                    "course_id": r[1],
                    "material_id": r[2],
                    "context_type": r[3],
                    "title": r[4],
                    "last_message": (r[5] or "")[:100] if r[5] else None,
                    "message_count": r[6],
                    "created_at": r[7].isoformat() if r[7] else None,
                    "updated_at": r[8].isoformat() if r[8] else None,
                }
                for r in cur.fetchall()
            ]
            return {"items": items, "total": total, "page": page, "page_size": page_size}


def get_conversation_by_material(
    student_id: int, course_id: int, material_id: int,
) -> dict | None:
    """查找指定课件的活跃会话，返回 None 表示不存在"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, title, context_type, "
                "(SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count, "
                "created_at, updated_at "
                "FROM conversations c "
                "WHERE student_id = %s AND course_id = %s AND material_id = %s AND status = 'active' "
                "ORDER BY updated_at DESC LIMIT 1",
                (student_id, course_id, material_id),
            )
            row = cur.fetchone()
            if not row:
                return None
            return {
                "conversation_id": row[0],
                "title": row[1],
                "context_type": row[2],
                "message_count": row[3],
                "created_at": row[4].isoformat() if row[4] else None,
                "updated_at": row[5].isoformat() if row[5] else None,
            }


def archive_conversation(conversation_id: int, student_id: int) -> bool:
    """归档指定会话（软删除），返回是否成功"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE conversations SET status = 'archived', updated_at = NOW() "
                "WHERE id = %s AND student_id = %s AND status = 'active'",
                (conversation_id, student_id),
            )
            return cur.rowcount > 0


def get_conversation_messages(
    conversation_id: int, student_id: int,
    before_id: int | None = None, limit: int = 50,
) -> dict:
    """获取对话消息（游标分页）"""
    import json as _json
    with get_connection() as conn:
        with conn.cursor() as cur:
            # 验证对话归属
            cur.execute(
                "SELECT 1 FROM conversations WHERE id = %s AND student_id = %s",
                (conversation_id, student_id),
            )
            if not cur.fetchone():
                return {"items": [], "has_more": False}

            conditions = ["conversation_id = %s"]
            params: list = [conversation_id]
            if before_id:
                conditions.append("id < %s")
                params.append(before_id)

            where = " AND ".join(conditions)
            params.append(limit + 1)  # 多取一条判断 has_more

            cur.execute(
                f"SELECT id, role, content, metadata, created_at FROM messages "
                f"WHERE {where} ORDER BY id ASC LIMIT %s",
                params,
            )
            rows = cur.fetchall()
            has_more = len(rows) > limit
            rows = rows[:limit]

            items = []
            for r in rows:
                item = {
                    "message_id": r[0],
                    "role": r[1],
                    "content": r[2],
                    "created_at": r[4].isoformat() if r[4] else None,
                }
                if r[3]:
                    item["metadata"] = r[3] if isinstance(r[3], dict) else _json.loads(r[3])
                items.append(item)

            return {"items": items, "has_more": has_more}


# ── 资源相关 ──

def save_resource(
    student_id: int,
    course_id: int,
    resource_type: str,
    title: str,
    topic: str,
    content: dict,
    is_validated: bool = False,
    source_chunks: list | None = None,
) -> int:
    """保存生成的学习资源，返回 resource_id"""
    import json as _json
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO resources "
                "(student_id, course_id, resource_type, title, topic, content, "
                "is_validated, source_chunks, status) "
                "VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s, %s::jsonb, 'completed') "
                "RETURNING id",
                (
                    student_id, course_id, resource_type, title, topic,
                    _json.dumps(content, ensure_ascii=False),
                    is_validated,
                    _json.dumps(source_chunks or [], ensure_ascii=False),
                ),
            )
            resource_id = cur.fetchone()[0]
            logger.info(f"Resource saved: id={resource_id}, type={resource_type}, topic={topic}")
            return resource_id
def get_resource_by_id(resource_id: int, student_id: int) -> dict | None:
    """获取资源详情（含权限校验）"""
    import json as _json
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, resource_type, title, topic, content, source_chunks, "
                "is_validated, status, created_at, course_id "
                "FROM resources WHERE id = %s AND student_id = %s",
                (resource_id, student_id),
            )
            row = cur.fetchone()
            if not row:
                return None

            content = row[4]
            if isinstance(content, str):
                try:
                    content = _json.loads(content)
                except (ValueError, TypeError):
                    content = {"raw": content}

            source_chunks = row[5]
            if isinstance(source_chunks, str):
                try:
                    source_chunks = _json.loads(source_chunks)
                except (ValueError, TypeError):
                    source_chunks = []

            return {
                "resource_id": row[0],
                "resource_type": row[1],
                "title": row[2],
                "topic": row[3],
                "content": content,
                "source_chunks": source_chunks or [],
                "is_validated": row[6],
                "status": row[7],
                "created_at": row[8].isoformat() if row[8] else None,
                "course_id": row[9],
            }


def delete_resource(resource_id: int) -> bool:
    """删除资源记录（MinIO 文件需调用方自行删除）"""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM resources WHERE id = %s",
                (resource_id,),
            )
            deleted = cur.rowcount > 0
            if deleted:
                logger.info(f"Resource deleted: id={resource_id}")
            return deleted
