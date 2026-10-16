"""全局异常处理 — 未捕获异常转为 SSE error 事件（脱敏版）"""

import logging
import traceback
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from services.sse import sse_error

logger = logging.getLogger(__name__)


class ExceptionToSSEMiddleware(BaseHTTPMiddleware):
    """将未捕获的异常转为统一 JSON 响应或 SSE error 事件，不泄露内部细节"""

    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            return response
        except Exception as e:
            # 记录完整异常到服务端日志（脱敏：不发给客户端）
            logger.error(
                "Unhandled exception on %s %s: %s",
                request.method, request.url.path, str(e),
                exc_info=True,
            )

            # 如果是 SSE 请求，返回 text/event-stream 格式的错误
            accept = request.headers.get("accept", "")
            if "text/event-stream" in accept:
                from starlette.responses import StreamingResponse

                async def error_stream():
                    yield sse_error("服务内部错误，请稍后重试", 50001)

                return StreamingResponse(
                    error_stream(),
                    media_type="text/event-stream",
                )
            else:
                return JSONResponse(
                    status_code=500,
                    content={
                        "code": 50001,
                        "message": "服务内部错误，请稍后重试",
                    },
                )
