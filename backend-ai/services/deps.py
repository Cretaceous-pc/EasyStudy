"""FastAPI 依赖注入 — JWT 验签

身份来源只有一个：Authorization: Bearer <JWT>。
JWT 由 Spring Boot 网关签发/验证后**原样转发**（见 AiProxyController），
本服务用自己的 JWT_SECRET 独立验签，不信任任何客户端可自行设置的头。

历史问题（已修复）
  原实现接受 X-User-Id / X-User-Role 头作为身份来源，且
  "Authorization 缺失时回退到 X-User-Id"。由于该服务在 compose 中曾把
  8000 端口发布到宿主机，任何能直连的人都可以只发
      X-User-Id: 1
      X-User-Role: ROLE_ADMIN
  就伪装成任意用户/管理员。同类头永远不能作为身份依据 ——
  它们与请求体里的 user_id 字段没有本质区别。
"""

import logging

import jwt
from fastapi import Depends, Header, HTTPException

from services.config import get_settings

logger = logging.getLogger(__name__)

***REMOVED*** 强制要求这些 claim 存在。缺少 exp 的 token 原本永不过期 ——
***REMOVED*** PyJWT 在 options={"verify_exp": True} 下对"没有 exp"的 token 并不报错。
_REQUIRED_CLAIMS = ["exp", "sub"]


def _decode(token: str) -> dict:
    """验签并解码 JWT，失败抛 HTTPException"""
    settings = get_settings()
    ***REMOVED*** 空密钥必须直接失败，不能"以空串为密钥继续验签" ——
    ***REMOVED*** 那会让攻击者用空密钥自行签发任意 token。
    if not settings.jwt_secret:
        logger.error("JWT_SECRET 未配置，拒绝所有请求")
        raise HTTPException(status_code=500, detail="服务端认证配置缺失")
    try:
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS384"],  ***REMOVED*** 固定算法，避免算法混淆/降级
            options={"verify_exp": True, "require": _REQUIRED_CLAIMS},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="JWT 已过期")
    except jwt.InvalidTokenError as e:
        logger.warning("JWT validation failed: %s", str(e))
        raise HTTPException(status_code=401, detail="无效的 JWT Token")


def _extract_bearer(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="缺少身份认证信息")
    return authorization[7:].strip()


async def get_current_user_id(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> int:
    """获取当前用户 ID —— 仅信任 Authorization 头中的 JWT"""
    payload = _decode(_extract_bearer(authorization))
    try:
        user_id = int(payload.get("sub", 0))
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="JWT 中的用户标识无效")
    if user_id <= 0:
        raise HTTPException(status_code=401, detail="JWT 中的用户标识无效")
    return user_id


async def get_current_user_role(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> str:
    """获取当前用户角色 —— 同样只来自 JWT claims"""
    payload = _decode(_extract_bearer(authorization))
    roles = payload.get("roles") or []
    if isinstance(roles, str):
        roles = [roles]
    ***REMOVED*** 多角色时优先返回管理/教师，避免角色顺序影响授权结果
    for preferred in ("ROLE_ADMIN", "ROLE_TEACHER"):
        if preferred in roles:
            return preferred
    return roles[0] if roles else "ROLE_STUDENT"


async def require_teacher(
    user_id: int = Depends(get_current_user_id),
    user_role: str = Depends(get_current_user_role),
) -> tuple[int, str]:
    """要求教师或管理员角色"""
    if user_role not in ("ROLE_TEACHER", "ROLE_ADMIN"):
        raise HTTPException(status_code=403, detail="需要教师或管理员权限")
    return user_id, user_role
