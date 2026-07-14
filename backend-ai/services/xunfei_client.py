"""
讯飞星火 TTS 客户端封装

支持:
- xunfei_tts(text) → bytes（音频字节流）

使用讯飞 WebSocket API 进行语音合成。
"""

import asyncio
import hashlib
import hmac
import base64
import json
import time
from typing import Optional
from urllib.parse import urlencode, urlparse

import websocket

from services.config import get_settings


def _create_auth_url(api_key: str, api_secret: str, base_url: str) -> str:
    """生成讯飞 WebSocket 鉴权 URL"""
    url = urlparse(base_url)
    now = str(int(time.time()))
    signature_origin = f"host: {url.hostname}\ndate: {now}\nGET {url.path} HTTP/1.1"
    signature = hmac.new(
        api_secret.encode("utf-8"),
        signature_origin.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).digest()
    authorization = base64.b64encode(signature).decode("utf-8")
    params = {
        "authorization": authorization,
        "date": now,
        "host": url.hostname,
    }
    return f"{base_url}?{urlencode(params)}"


async def xunfei_tts(
    text: str,
    voice: str = "xiaoyan",
    speed: int = 50,
    volume: int = 50,
    timeout: float = 30.0,
) -> bytes:
    """
    调用讯飞星火 TTS，返回音频字节流

    Args:
        text: 要合成的文本
        voice: 发音人（默认 xiaoyan）
        speed: 语速 0-100
        volume: 音量 0-100
        timeout: 超时秒数

    Returns:
        PCM/MP3 音频字节流
    """
    settings = get_settings()

    if not all([settings.xunfei_app_id, settings.xunfei_api_key, settings.xunfei_api_secret]):
        raise ValueError("讯飞星火 TTS 配置不完整：需要 APP_ID + API_KEY + API_SECRET")

    base_url = f"wss://tts-api.xfyun.cn/v2/tts"
    auth_url = _create_auth_url(settings.xunfei_api_key, settings.xunfei_api_secret, base_url)

    # 构造请求参数
    request_json = {
        "header": {
            "app_id": settings.xunfei_app_id,
            "status": 2,  # 一次性发送
        },
        "parameter": {
            "tts": {
                "vcn": voice,
                "speed": speed,
                "volume": volume,
                "pitch": 50,
                "audio": {
                    "encoding": "lame",  # MP3
                    "sample_rate": 16000,
                },
            }
        },
        "payload": {
            "text": {
                "encoding": "utf8",
                "text": base64.b64encode(text.encode("utf-8")).decode("utf-8"),
                "status": 2,
            }
        },
    }

    audio_chunks = []
    error_msg = None

    def on_message(ws, message):
        nonlocal error_msg
        result = json.loads(message)
        code = result.get("header", {}).get("code", -1)
        if code != 0:
            error_msg = result.get("header", {}).get("message", "未知错误")
            ws.close()
            return
        audio = result.get("payload", {}).get("audio", {}).get("audio", "")
        if audio:
            audio_chunks.append(base64.b64decode(audio))
        status = result.get("header", {}).get("status", 0)
        if status == 2:  # 合成完成
            ws.close()

    def on_error(ws, error):
        nonlocal error_msg
        error_msg = str(error)

    # 同步 WebSocket 调用
    loop = asyncio.get_event_loop()

    def _call_tts():
        ws = websocket.WebSocketApp(
            auth_url,
            on_message=on_message,
            on_error=on_error,
        )
        ws.on_open = lambda w: w.send(json.dumps(request_json))
        ws.run_forever(timeout=timeout)

    try:
        await asyncio.wait_for(
            loop.run_in_executor(None, _call_tts),
            timeout=timeout,
        )
    except asyncio.TimeoutError:
        raise TimeoutError(f"讯飞星火 TTS 调用超时 ({timeout}s)")

    if error_msg:
        raise RuntimeError(f"讯飞星火 TTS 调用失败: {error_msg}")

    return b"".join(audio_chunks)
