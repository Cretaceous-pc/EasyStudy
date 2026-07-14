"""
文档切割器

使用纯 Python 实现的递归文本切割，避免 langchain_text_splitters 依赖冲突。
"""

# ── 经验值参数 ──
CHUNK_SIZE = 1500
CHUNK_OVERLAP = 300
SEPARATORS = ["\n\n## ", "\n\n### ", "\n\n", "\n", "。", ".", " "]


def get_splitter(
    chunk_size: int = CHUNK_SIZE,
    chunk_overlap: int = CHUNK_OVERLAP,
):
    """
    获取配置好的文本切割器（返回切割函数）

    使用递归分割策略：按 separators 优先级依次尝试分割，
    直到每个片段 ≤ chunk_size。
    """
    separators = SEPARATORS

    def split_recursive(text: str, seps: list[str] | None = None) -> list[str]:
        """递归分割文本"""
        if seps is None:
            seps = separators

        if len(text) <= chunk_size:
            return [text] if text.strip() else []

        # 尝试按当前分隔符分割
        sep = seps[0] if seps else None
        remaining_seps = seps[1:] if len(seps) > 1 else []

        if sep is None:
            # 无可用的分隔符，强制按长度切割
            return _split_by_length(text, chunk_size, chunk_overlap)

        parts = text.split(sep)

        if len(parts) == 1:
            # 当前分隔符无法分割，尝试下一个
            return split_recursive(text, remaining_seps)

        # 合并过短的片段，递归处理过长的片段
        result = []
        current = ""
        for part in parts:
            candidate = current + (sep if current else "") + part
            if len(candidate) <= chunk_size:
                current = candidate
            else:
                if current.strip():
                    result.append(current)
                # 递归处理剩余的过长片段
                if len(part) > chunk_size:
                    sub_chunks = split_recursive(part, remaining_seps)
                    result.extend(sub_chunks)
                    current = ""
                else:
                    current = part

        if current.strip():
            result.append(current)

        # 添加重叠
        if chunk_overlap > 0 and len(result) > 1:
            result = _add_overlap(result, chunk_overlap)

        return result

    return split_recursive


def _split_by_length(text: str, size: int, overlap: int) -> list[str]:
    """按固定长度切割（最后手段）"""
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        chunks.append(text[start:end])
        start += size - overlap
    return chunks


def _add_overlap(chunks: list[str], overlap: int) -> list[str]:
    """为相邻 chunk 添加重叠"""
    if len(chunks) <= 1:
        return chunks
    result = [chunks[0]]
    for i in range(1, len(chunks)):
        # 从前一个 chunk 尾部取 overlap 字符追加到当前 chunk 头部
        prev = chunks[i - 1]
        if len(prev) > overlap:
            result.append(prev[-overlap:] + chunks[i])
        else:
            result.append(chunks[i])
    return result


def split_text(text: str, metadata: dict = None) -> list[dict]:
    """
    切割文本为 chunk 列表

    Returns:
        [{"text": chunk_text, "metadata": {...}}, ...]
    """
    splitter = get_splitter()
    chunks = splitter(text)
    meta = metadata or {}
    return [{"text": chunk, "metadata": meta} for chunk in chunks if chunk.strip()]
