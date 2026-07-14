"""
检索链

封装 RAG 检索逻辑：course_id 强制过滤 + top-5 + score
"""

from typing import List

from rag.vectorstore import get_vectorstore


def get_retriever(course_id: int, top_k: int = 5):
    """
    获取配置好的检索器

    Args:
        course_id: 课程 ID（强制过滤，防幻觉关键防线）
        top_k: 返回结果数量

    Returns:
        可调用对象，传入 query 返回检索结果
    """
    vectorstore = get_vectorstore()

    def retrieve(query: str) -> List[dict]:
        """
        检索相关文档

        Returns:
            [{"chunk_text": ..., "metadata": {...}, "score": 0.85}, ...]
        """
        results = vectorstore.search(
            query=query,
            course_id=course_id,
            top_k=top_k,
        )
        return results

    return retrieve


def format_retrieved_docs(docs: List[dict]) -> str:
    """将检索结果格式化为 Prompt 注入文本"""
    if not docs:
        return "（未检索到相关资料）"

    parts = []
    for i, doc in enumerate(docs, 1):
        score = doc.get("score", 0)
        text = doc.get("chunk_text", "")
        meta = doc.get("metadata", {})
        source = meta.get("title", "未知来源")
        parts.append(f"[来源{i}] {source} (相关度: {score:.2f})\n{text}")

    return "\n\n---\n\n".join(parts)
