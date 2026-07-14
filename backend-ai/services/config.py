"""全局配置 — pydantic-settings 管理环境变量"""

import os
import sys
from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache


def _find_env_file() -> str:
    """查找 .env 文件：当前目录 → 上级目录 → 项目根目录"""
    # 尝试当前工作目录
    candidates = [
        Path.cwd() / ".env",
        # 尝试 backend-ai/ 的父目录（项目根目录）
        Path(__file__).resolve().parent.parent.parent / ".env",
    ]
    for p in candidates:
        if p.is_file():
            return str(p)
    # 默认回退到相对于工作目录的 .env
    return ".env"


class Settings(BaseSettings):
    # ── Database ──
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "easystudy"
    db_user: str = "easystudy"
    db_password: str = ""  # 必须通过环境变量设置

    # ── Redis ──
    redis_host: str = "localhost"
    redis_port: int = 6379

    # ── MinIO ──
    minio_endpoint: str = "localhost:9000"
    minio_user: str = "easystudy_admin"
    minio_password: str = ""  # 必须通过环境变量设置

    # ── DeepSeek ──
    deepseek_api_key: str = ""  # 必须通过环境变量设置
    deepseek_base_url: str = "https://api.deepseek.com/v1"  # OpenAI SDK 要求含 /v1

    # ── 讯飞星火 ──
    xunfei_app_id: str = ""
    xunfei_api_key: str = ""
    xunfei_api_secret: str = ""

    # ── Vector Store ──
    vector_backend: str = "chroma-http"  # chroma-http (Docker) | chroma (嵌入式) | qdrant
    chroma_persist_dir: str = "./chroma_data"
    chroma_host: str = "localhost"
    chroma_port: int = 8001

    # ── CORS ──
    cors_allowed_origins: str = "http://localhost:5173"

    # ── JWT（与 Spring Boot 共享同一密钥，用于验证请求来源） ──
    jwt_secret: str = ""  # 必须通过环境变量设置，与 Spring Boot 的 JWT_SECRET 一致

    # ── SSE ──
    sse_timeout_seconds: int = 300  # 5 分钟
    sse_heartbeat_seconds: int = 30

    class Config:
        env_file = _find_env_file()
        env_file_encoding = "utf-8"
        extra = "ignore"  # 忽略 Spring Boot 专属的 .env 变量

    def validate_secrets(self) -> list[str]:
        """校验关键密钥是否已配置，返回缺失项列表"""
        missing = []
        if not self.db_password:
            missing.append("DB_PASSWORD")
        if not self.minio_password:
            missing.append("MINIO_PASSWORD")
        if not self.jwt_secret:
            missing.append("JWT_SECRET")
        return missing


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    missing = settings.validate_secrets()
    if missing:
        print(f"⚠️  警告: 以下环境变量未配置: {', '.join(missing)}")
        print(f"   请在 .env 文件中设置这些变量后再启动生产环境")
    return settings
