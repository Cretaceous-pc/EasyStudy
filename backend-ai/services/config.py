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
    db_password: str = "" # 必须通过环境变量设置

    # ── Redis ──
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: str = "" # 与 compose 的 --requirepass 对应

    # ── MinIO ──
    minio_endpoint: str = "localhost:9000"
    minio_user: str = "easystudy_admin"
    minio_password: str = "" # 必须通过环境变量设置

    # ── DeepSeek ──
    deepseek_api_key: str = "" # 必须通过环境变量设置
    deepseek_base_url: str = "https://api.deepseek.com/v1" # OpenAI SDK 要求含 /v1

    # ── 讯飞星火 ──
    xunfei_app_id: str = ""
    xunfei_api_key: str = ""
    xunfei_api_secret: str = ""

    # ── Vector Store ──
    vector_backend: str = "chroma-http" # chroma-http (Docker) | chroma (嵌入式) | qdrant
    chroma_persist_dir: str = "./chroma_data"
    chroma_host: str = "localhost"
    chroma_port: int = 8001

    # ── Embedding ──
    embedding_backend: str = "chroma-builtin" # chroma-builtin (ONNX 本地) | api (OpenAI 兼容接口)
    embedding_model: str = "text-embedding-3-small"
    embedding_api_key: str = "" # 默认复用 deepseek_api_key
    embedding_base_url: str = "" # 默认复用 deepseek_base_url

    # ── CORS ──
    cors_allowed_origins: str = "http://localhost:5173"

    # ── JWT（与 Spring Boot 共享同一密钥，用于验证请求来源） ──
    jwt_secret: str = "" # 必须通过环境变量设置，与 Spring Boot 的 JWT_SECRET 一致

    # ── SSE ──
    sse_timeout_seconds: int = 300 # 5 分钟
    sse_heartbeat_seconds: int = 30

    class Config:
        env_file = _find_env_file()
        env_file_encoding = "utf-8"
        extra = "ignore" # 忽略 Spring Boot 专属的 .env 变量

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
        # 关键密钥缺失必须直接失败，而不是"打印警告后继续跑"。
        # 尤其是 JWT_SECRET：为空时 deps.py 会以空串作为 HMAC 密钥验签，
        # 等于任何攻击者都能用空密钥自行签发 token。
        # （deps.py 已单独拒绝空密钥，这里在启动阶段就暴露问题。）
        raise RuntimeError(
            "以下必需的环境变量未配置，服务拒绝启动: "
            + ", ".join(missing)
            + "。请检查 .env 文件（参考 .env.example）。"
        )
    return settings
