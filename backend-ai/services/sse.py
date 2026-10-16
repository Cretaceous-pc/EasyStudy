"""SSE 工具函数 — 封装 StreamingResponse 的通用逻辑"""

import asyncio
import json
import logging
import time
from typing import AsyncGenerator, Optional

from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)


def sse_event(event: str, data: dict) -> str:
    """格式化单条 SSE 事件"""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def sse_error(message: str, code: int = 50001) -> str:
    """格式化 SSE 错误事件"""
    return sse_event("error", {"code": code, "message": message})


def sse_done(**extra) -> str:
    """格式化 SSE 完成事件"""
    return sse_event("done", extra)


async def merge_streams(
    main_stream: AsyncGenerator[str, None],
    heartbeat_interval: int = 30,
    timeout: int = 300,
) -> AsyncGenerator[str, None]:
    """合并主数据流和心跳流，并在超时后发送 error 事件

    P0-2 修复：使用 asyncio.Queue 将心跳注入数据流，使用 asyncio.wait 实现超时竞速。
    """
    queue: asyncio.Queue[Optional[str]] = asyncio.Queue()
    last_data_time = time.monotonic()
    finished = False

    async def _read_main():
        """读取主数据流，放入队列"""
        nonlocal finished
        try:
            async for chunk in main_stream:
                await queue.put(chunk)
        except Exception as e:
            # 脱敏：不泄露异常原文，记录到日志
            logger.error("SSE main stream error: %s", str(e), exc_info=True)
            await queue.put(sse_error("生成过程中发生错误，请重试", 50001))
        finally:
            finished = True
            await queue.put(None)  # 哨兵值，表示主数据流结束

    async def _heartbeat():
        """心跳协程：定期向队列注入 SSE 注释"""
        while not finished:
            await asyncio.sleep(heartbeat_interval)
            if not finished:
                await queue.put(f": heartbeat {int(time.time())}\n\n")

    # 并行启动主数据流读取和心跳
    main_task = asyncio.create_task(_read_main())
    hb_task = asyncio.create_task(_heartbeat())

    try:
        while True:
            # 计算距上次数据的时间
            elapsed = time.monotonic() - last_data_time
            remaining = timeout - elapsed

            if remaining <= 0:
                # 超时
                yield sse_error("响应超时，请重试", 50001)
                return

            try:
                # 等待数据或超时
                item = await asyncio.wait_for(queue.get(), timeout=remaining)
            except asyncio.TimeoutError:
                yield sse_error("响应超时，请重试", 50001)
                return

            if item is None:
                # 主数据流结束
                return

            yield item
            # 心跳注释不重置超时计时器，只有真实数据才重置
            if not item.startswith(":"):
                last_data_time = time.monotonic()
    finally:
        main_task.cancel()
        hb_task.cancel()
        # 确保任务被清理
        for t in (main_task, hb_task):
            try:
                await t
            except (asyncio.CancelledError, Exception):
                pass


def create_sse_response(
    stream: AsyncGenerator[str, None],
    heartbeat_interval: int = 30,
    timeout: int = 300,
) -> StreamingResponse:
    """创建 SSE StreamingResponse"""
    merged = merge_streams(stream, heartbeat_interval, timeout)
    return StreamingResponse(
        merged,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Nginx 不缓冲
        },
    )

