"""MinIO 客户端封装"""

from minio import Minio
from services.config import get_settings

_client = None


def get_minio_client() -> Minio:
    """获取 MinIO 客户端"""
    global _client
    if _client is None:
        settings = get_settings()
        _client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_user,
            secret_key=settings.minio_password,
            secure=False,
        )
    return _client
