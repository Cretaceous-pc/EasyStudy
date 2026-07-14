"""健康检查路由 — 需要认证，避免泄露基础设施状态"""

import redis as redis_lib
from fastapi import APIRouter, Depends
from psycopg2 import connect as pg_connect
from minio import Minio

from services.config import get_settings
from services.deps import get_current_user_id

router = APIRouter()


@router.get("/health")
async def health_check(user_id: int = Depends(get_current_user_id)):
    """返回所有依赖服务的状态（需要认证）"""
    settings = get_settings()
    checks = {}

    # ── PostgreSQL ──
    try:
        conn = pg_connect(
            host=settings.db_host,
            port=settings.db_port,
            dbname=settings.db_name,
            user=settings.db_user,
            password=settings.db_password,
            connect_timeout=3,
        )
        conn.cursor().execute("SELECT 1")
        conn.close()
        checks["postgres"] = "ok"
    except Exception:
        checks["postgres"] = "unreachable"

    # ── Redis ──
    try:
        r = redis_lib.Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            socket_connect_timeout=3,
        )
        r.ping()
        r.close()
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "unreachable"

    # ── MinIO ──
    try:
        client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_user,
            secret_key=settings.minio_password,
            secure=False,
        )
        client.list_buckets()
        checks["minio"] = "ok"
    except Exception:
        checks["minio"] = "unreachable"

    # ── API Key 状态（不泄露具体值） ──
    checks["deepseek"] = "configured" if settings.deepseek_api_key else "missing"
    checks["xunfei"] = "configured" if (
        settings.xunfei_app_id and settings.xunfei_api_key and settings.xunfei_api_secret
    ) else "missing"

    all_ok = all(v in ("ok", "configured") for v in checks.values())

    return {
        "status": "healthy" if all_ok else "degraded",
        "checks": checks,
    }
