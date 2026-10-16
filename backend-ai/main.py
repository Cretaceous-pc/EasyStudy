"""
easyStudy AI Backend — FastAPI 应用入口
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import health, chat, resources, profile, path, exercises, tts
from services.config import get_settings
from services.exception_middleware import ExceptionToSSEMiddleware

app = FastAPI(
    title="easyStudy AI Backend",
    version="0.1.0",
    docs_url="/internal/docs",
    redoc_url="/internal/redoc",
)

settings = get_settings()

# ── 全局异常 → SSE error 中间件 ──
app.add_middleware(ExceptionToSSEMiddleware)

# ── CORS：仅允许 Spring Boot 来源 ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_allowed_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Accel-Buffering"],  # 禁用 Nginx 缓冲，SSE 必须
)

# ── 注册路由 ──
app.include_router(health.router, prefix="/internal", tags=["health"])
app.include_router(chat.router, prefix="/internal", tags=["chat"])
app.include_router(resources.router, prefix="/internal", tags=["resources"])
app.include_router(profile.router, prefix="/internal", tags=["profile"])
app.include_router(path.router, prefix="/internal", tags=["path"])
app.include_router(exercises.router, prefix="/internal", tags=["exercises"])
app.include_router(tts.router, prefix="/internal", tags=["tts"])


@app.on_event("startup")
async def startup():
    """应用启动时打印配置摘要"""
    print("easyStudy AI Backend started")
    print(f"   DB: {settings.db_host}:{settings.db_port}/{settings.db_name}")
    print(f"   Redis: {settings.redis_host}:{settings.redis_port}")
    print(f"   MinIO: {settings.minio_endpoint}")
    print(f"   Vector: {settings.vector_backend}")
    print(f"   CORS: {settings.cors_allowed_origins}")


@app.on_event("shutdown")
async def shutdown():
    """应用关闭时清理资源"""
    try:
        from services import db
        if hasattr(db, "_pool") and db._pool is not None:
            db._pool.closeall()
            print("🔒 PostgreSQL 连接池已关闭")
    except Exception as e:
        print(f"⚠️  关闭连接池时出错: {e}")
