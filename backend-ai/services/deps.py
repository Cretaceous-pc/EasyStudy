"""FastAPI 依赖注入 — JWT 验签 + Header 提取用户身份

双重保障机制：
1. Spring Boot 网关模式：JWT 已由 Spring Boot 验证，通过 X-User-Id / X-User-Role 传入
2. JWT 直验模式：如果请求直接到达 FastAPI，从 Authorization Header 解析 JWT

优先级：Authorization Header (JWT) > X-User-Id Header (网关注入)
"""

import logging

import jwt
from fastapi import Depends, Header, HTTPException

from services.config import get_settings

logger = logging.getLogger(__name__)


async def get_current_user_id(
    x_user_id: int = Header(default=None, alias="X-User-Id", description="网关注入的用户 ID"),
    authorization: str = Header(default=None, alias="Authorization", description="JWT Token"),
) -> int:
    """获取当前用户 ID — 优先 JWT 直验，其次信任网关注入"""
    # 优先：JWT 直验模式
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        try:
            settings = get_settings()
            payload = jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=["HS384"],
                options={"verify_exp": True},
            )
            user_id = int(payload.get("sub", 0))
            if user_id > 0:
                return user_id
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="JWT 已过期")
        except jwt.InvalidTokenError as e:
            logger.warning("JWT validation failed: %s", str(e))
            raise HTTPException(status_code=401, detail="无效的 JWT Token")

    # 其次：网关注入的 X-User-Id
    if x_user_id is not None and x_user_id > 0:
        return x_user_id

    raise HTTPException(status_code=401, detail="缺少身份认证信息")


async def get_current_user_role(
    x_user_role: str = Header(default=None, alias="X-User-Role", description="网关注入的用户角色"),
    authorization: str = Header(default=None, alias="Authorization", description="JWT Token"),
) -> str:
    """获取当前用户角色 — 优先 JWT 直验，其次信任网关注入"""
    # 优先：JWT 直验模式
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        try:
            settings = get_settings()
            payload = jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=["HS384"],
                options={"verify_exp": True},
            )
            roles = payload.get("roles", [])
            if roles:
                return roles[0]
        except jwt.InvalidTokenError:
            pass  # 已在 get_current_user_id 中处理

    # 其次：网关注入的 X-User-Role
    if x_user_role:
        return x_user_role

    return "ROLE_STUDENT"


async def require_teacher(
    user_id: int = Depends(get_current_user_id),
    user_role: str = Depends(get_current_user_role),
) -> tuple[int, str]:
    """要求教师或管理员角色（先验 JWT / X-User-Id，再检查角色 claims）"""
    if user_role not in ("ROLE_TEACHER", "ROLE_ADMIN"):
        raise HTTPException(status_code=403, detail="需要教师或管理员权限")
    return user_id, user_role
