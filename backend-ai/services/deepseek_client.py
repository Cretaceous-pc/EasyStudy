"""
DeepSeek API 客户端封装

支持:
- deepseek_generate(prompt) → 文本
- deepseek_generate_json(prompt) → dict（含 JSON 解析失败重试）
- deepseek_stream(prompt) → AsyncGenerator[str, None]（流式）

v1.1: 添加指数退避重试 + 连接错误时重建客户端
"""

import json
import asyncio
import logging
from typing import Optional, AsyncGenerator

from openai import AsyncOpenAI, APIConnectionError

from services.config import get_settings

logger = logging.getLogger(__name__)

# ── 全局客户端（懒初始化） ──
_client: Optional[AsyncOpenAI] = None


def _create_client() -> AsyncOpenAI:
    """创建新的 DeepSeek OpenAI 兼容客户端"""
    settings = get_settings()
    return AsyncOpenAI(
        api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url,  # OpenAI SDK 要求含 /v1 的完整 base URL
        timeout=180.0,  # 3 分钟，匹配路径生成长耗时
        max_retries=1,
    )


def get_deepseek_client() -> AsyncOpenAI:
    """获取 DeepSeek OpenAI 兼容客户端（懒初始化 + 全局复用）"""
    global _client
    if _client is None:
        _client = _create_client()
    return _client


def _reset_client() -> None:
    """强制重建客户端（连接错误恢复）"""
    global _client
    _client = None
    logger.info("[deepseek] client reset due to connection error")


async def deepseek_generate(
    prompt: str,
    system: str = "你是 easyStudy 的 AI 学习助手。",
    model: str = "deepseek-chat",
    timeout: float = 30.0,
    max_retries: int = 2,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> str:
    """调用 DeepSeek 生成文本

    max_retries: 最大重试次数（不含首次，共 max_retries+1 次）。默认 2。
    遇到连接错误时自动重建客户端并指数退避重试。
    """
    for attempt in range(max_retries + 1):
        client = get_deepseek_client()

        try:
            response = await asyncio.wait_for(
                client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=temperature,
                    max_tokens=max_tokens,
                ),
                timeout=timeout,
            )
            return response.choices[0].message.content or ""

        except asyncio.TimeoutError:
            logger.warning(
                "[deepseek] timeout on attempt %d/%d (%.1fs)",
                attempt + 1, max_retries + 1, timeout,
            )
            if attempt < max_retries:
                await asyncio.sleep(2 ** attempt)  # 指数退避: 1s, 2s, 4s
                continue
            raise TimeoutError("DeepSeek API 调用超时")

        except APIConnectionError as e:
            logger.warning(
                "[deepseek] connection error on attempt %d/%d: %s",
                attempt + 1, max_retries + 1, str(e)[:200],
            )
            if attempt < max_retries:
                _reset_client()  # 重建客户端，避免连接池污染
                await asyncio.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"DeepSeek API 连接失败（已重试 {max_retries} 次）: {str(e)[:200]}")

        except Exception as e:
            logger.warning(
                "[deepseek] %s on attempt %d/%d: %s",
                type(e).__name__, attempt + 1, max_retries + 1, str(e)[:200],
            )
            if attempt < max_retries:
                await asyncio.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"DeepSeek API 调用失败: {type(e).__name__}: {str(e)[:200]}")


async def deepseek_generate_json(
    prompt: str,
    system: str = "你是 easyStudy 的 AI 学习助手。请用 JSON 格式回复。",
    model: str = "deepseek-chat",
    timeout: float = 30.0,
    max_retries: int = 2,
    temperature: float = 0.3,
) -> dict:
    """调用 DeepSeek 并解析 JSON 响应（含解析失败重试）"""
    for attempt in range(max_retries + 1):
        text = await deepseek_generate(prompt, system=system, model=model, timeout=timeout, temperature=temperature)
        try:
            # 尝试提取 JSON 块（可能被 markdown 代码块包裹）
            text = text.strip()
            if text.startswith("```"):
                # 去掉 ```json 和 ```
                lines = text.split("\n")
                lines = [l for l in lines if not l.strip().startswith("```")]
                text = "\n".join(lines)

            return json.loads(text)
        except json.JSONDecodeError:
            if attempt < max_retries:
                # 追加提示让模型修正
                prompt = f"{prompt}\n\n上一次回复不是有效 JSON，请直接返回 JSON，不要加 markdown 代码块。"
                continue
            raise ValueError(f"DeepSeek 返回的 JSON 解析失败: {text[:200]}")


async def deepseek_stream(
    prompt: str,
    system: str = "你是 easyStudy 的 AI 学习助手。",
    model: str = "deepseek-chat",
    temperature: float = 0.7,
    max_retries: int = 1,
) -> AsyncGenerator[str, None]:
    """流式调用 DeepSeek，逐 token yield

    max_retries: 建立连接的最大重试次数（不含首次）。默认 1。
    流式传输中途断开不会重试（内容已部分输出），调用方应 fallback 到非流式。
    """
    last_error = None

    for attempt in range(max_retries + 1):
        client = get_deepseek_client()

        try:
            stream = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                temperature=temperature,
                max_tokens=4096,
                stream=True,
            )

            async for chunk in stream:
                delta = chunk.choices[0].delta
                if delta.content:
                    yield delta.content
            return  # 流正常结束

        except APIConnectionError as e:
            last_error = e
            logger.warning(
                "[deepseek] stream connection error on attempt %d/%d: %s",
                attempt + 1, max_retries + 1, str(e)[:200],
            )
            if attempt < max_retries:
                _reset_client()
                await asyncio.sleep(2 ** attempt)
                continue

        except Exception as e:
            last_error = e
            logger.warning(
                "[deepseek] stream %s on attempt %d/%d: %s",
                type(e).__name__, attempt + 1, max_retries + 1, str(e)[:200],
            )
            if attempt < max_retries:
                await asyncio.sleep(2 ** attempt)
                continue

    raise RuntimeError(
        f"DeepSeek 流式调用失败（已重试 {max_retries} 次）: "
        f"{type(last_error).__name__}: {str(last_error)[:200]}" if last_error else ""
    )
