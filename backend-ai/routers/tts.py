"""
TTS 语音合成路由 — /internal/tts/*

文本 → 音频 → MinIO URL。
Redis 缓存：相同文本 24 小时内直接返回缓存 URL。
长文本自动分段合成（每段 ≤500 字）。
"""

import hashlib
import io
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from services.xunfei_client import xunfei_tts
from services.minio_client import get_minio_client
from services.config import get_settings
from services.deps import get_current_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tts", tags=["tts"])

settings = get_settings()

# Redis 缓存键前缀
TTS_CACHE_PREFIX = "tts:"
TTS_CACHE_TTL = 86400  # 24 小时

# 分段参数
MAX_SEGMENT_LENGTH = 500  # 字


# ── 请求/响应模型 ──

class TTSSynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000, description="待合成文本，限制 5000 字符")
    resource_id: Optional[int] = None
    voice: str = "xiaoyan"


# ── Redis 辅助 ──

def _get_redis():
    """获取 Redis 连接"""
    import redis
    return redis.Redis(
        host=settings.redis_host,
        port=settings.redis_port,
        decode_responses=True,
        socket_connect_timeout=3,
    )


def _text_md5(text: str) -> str:
    """计算文本 MD5"""
    return hashlib.md5(text.encode("utf-8")).hexdigest()


# ── 分段 ──

def _split_text(text: str, max_len: int = MAX_SEGMENT_LENGTH) -> list:
    """将长文本按段落边界切分，每段不超过 max_len 字"""
    paragraphs = text.split("\n\n")
    segments = []
    current = ""
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if len(current) + len(para) <= max_len:
            current += ("\n\n" + para) if current else para
        else:
            if current:
                segments.append(current)
            # 如果段落本身超长，按句号再切
            if len(para) > max_len:
                sentences = para.replace("。", "。\n").split("\n")
                for s in sentences:
                    s = s.strip()
                    if not s:
                        continue
                    if len(s) <= max_len:
                        segments.append(s)
                    else:
                        # 硬切
                        for i in range(0, len(s), max_len):
                            segments.append(s[i:i + max_len])
            else:
                current = para
    if current:
        segments.append(current)
    return segments


# ── 端点 ──

@router.post("/synthesize")
async def synthesize(
    req: TTSSynthesizeRequest,
    user_id: int = Depends(get_current_user_id),
):
    """文本转语音 → MinIO 音频 URL"""

    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="文本不能为空")

    # 移除 Markdown 标记，保留纯文本
    import re
    clean_text = re.sub(r'[#*>`\-\[\]()|]', '', text)
    clean_text = re.sub(r'\n{2,}', '\n', clean_text).strip()

    text_hash = _text_md5(clean_text)
    cache_key = f"{TTS_CACHE_PREFIX}{text_hash}"

    # 1. 检查 Redis 缓存
    try:
        r = _get_redis()
        cached_url = r.get(cache_key)
        if cached_url:
            logger.info(f"[tts] cache HIT: hash={text_hash}")
            return {
                "audio_url": cached_url,
                "duration_sec": 0,
                "cached": True,
            }
    except Exception as e:
        logger.warning(f"[tts] Redis unavailable, skip cache: {e}")
        r = None

    # 2. 分段合成
    segments = (
        _split_text(clean_text) if len(clean_text) > MAX_SEGMENT_LENGTH
        else [clean_text]
    )
    logger.info(f"[tts] synthesizing {len(segments)} segment(s), total chars={len(clean_text)}")

    audio_data = bytearray()
    try:
        for i, seg in enumerate(segments):
            seg = seg.strip()
            if not seg:
                continue
            logger.debug(f"[tts] segment {i+1}/{len(segments)}: {len(seg)} chars")
            seg_audio = await xunfei_tts(seg, voice=req.voice)
            audio_data.extend(seg_audio)
    except Exception as e:
        logger.error(f"[tts] synthesis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"语音合成失败: {str(e)[:200]}")

    # 3. 上传到 MinIO
    try:
        minio_client = get_minio_client()
        object_name = f"{text_hash}.mp3"
        audio_bytes = bytes(audio_data)

        minio_client.put_object(
            bucket_name="tts",
            object_name=object_name,
            data=io.BytesIO(audio_bytes),
            length=len(audio_bytes),
            content_type="audio/mpeg",
        )

        # 构造公开 URL
        audio_url = f"/api/materials/files/tts/{object_name}"
        logger.info(f"[tts] uploaded to MinIO: {object_name}")

    except Exception as e:
        logger.error(f"[tts] MinIO upload failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"音频上传失败: {str(e)[:200]}")

    # 4. 写入 Redis 缓存
    if r:
        try:
            r.setex(cache_key, TTS_CACHE_TTL, audio_url)
        except Exception as e:
            logger.warning(f"[tts] cache write failed: {e}")

    # 5. 估算时长（MP3 约 16KB/s）
    duration_sec = len(audio_data) / 16000 if audio_data else 0

    return {
        "audio_url": audio_url,
        "duration_sec": round(duration_sec, 1),
        "cached": False,
        "segments": [
            {"text": seg, "index": i}
            for i, seg in enumerate(segments) if seg.strip()
        ],
    }
