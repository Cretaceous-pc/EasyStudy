"""
向量库操作

支持两种后端:
- chroma-http:  Chroma Docker 容器（推荐，无需本地编译依赖）
- chroma:       Chroma 嵌入式（需要 Visual C++ Build Tools）
- qdrant:       Qdrant（生产环境，待实现）

Embedding 后端:
- chroma-builtin: ChromaDB 内置 ONNX 模型（默认，all-MiniLM-L6-v2）
- api:            OpenAI 兼容 Embedding API（需配置 embedding_model 等）
"""

import os
import time
import logging
from typing import List, Optional

from services.config import get_settings

***REMOVED*** chromadb 可能未安装（仅类型检查时需要）
try:
    from chromadb.api.types import EmbeddingFunction as _EmbeddingFunction
except ImportError:
    _EmbeddingFunction = object

logger = logging.getLogger(__name__)


***REMOVED*** ══════════════════════════════════════════════════════════════════
***REMOVED*** API Embedding Function
***REMOVED*** ══════════════════════════════════════════════════════════════════

class APIEmbeddingFunction(_EmbeddingFunction):
    """OpenAI 兼容 Embedding API 封装，支持 OpenAI / 智谱 等"""

    def __init__(self, model: str, api_key: str, base_url: str, batch_size: int = 100):
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self.batch_size = batch_size
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from openai import OpenAI
            self._client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        return self._client

    def __call__(self, texts: List[str]) -> List[List[float]]:
        """将文本列表转为 embedding 列表"""
        all_embeddings = []
        total = len(texts)

        for i in range(0, total, self.batch_size):
            batch = texts[i:i + self.batch_size]
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    resp = self.client.embeddings.create(
                        model=self.model,
                        input=batch,
                    )
                    batch_embeddings = [d.embedding for d in resp.data]
                    all_embeddings.extend(batch_embeddings)
                    break
                except Exception as e:
                    if attempt < max_retries - 1:
                        wait = 2 ** attempt
                        logger.warning(
                            f"Embedding API 失败 (attempt {attempt + 1}/{max_retries}): {e}，"
                            f"{wait}s 后重试..."
                        )
                        time.sleep(wait)
                    else:
                        raise RuntimeError(
                            f"Embedding API 调用失败，已重试 {max_retries} 次: {e}"
                        ) from e

            if i + self.batch_size < total:
                logger.info(f"   Embedding 进度: {min(i + self.batch_size, total)}/{total}")

        return all_embeddings


def _build_embedding_function(settings):
    """根据配置构建 embedding function，None 表示使用 ChromaDB 内置"""
    if settings.embedding_backend == "api":
        api_key = settings.embedding_api_key or settings.deepseek_api_key
        base_url = settings.embedding_base_url or settings.deepseek_base_url
        if not api_key:
            raise ValueError(
                "embedding_backend=api 但未配置 embedding_api_key 或 deepseek_api_key"
            )
        logger.info(f"   Embedding: API ({settings.embedding_model})")
        return APIEmbeddingFunction(
            model=settings.embedding_model,
            api_key=api_key,
            base_url=base_url,
        )
    ***REMOVED*** chroma-builtin: 返回 None，ChromaDB 使用内置 ONNX 模型
    logger.info("   Embedding: ChromaDB 内置 (all-MiniLM-L6-v2)")
    return None


***REMOVED*** ══════════════════════════════════════════════════════════════════
***REMOVED*** Vector Store
***REMOVED*** ══════════════════════════════════════════════════════════════════

def get_vectorstore(collection_name: str = "easystudy_chunks"):
    """
    获取向量库实例

    chroma-http: Docker 容器模式（默认）
    chroma:      嵌入式本地模式
    """
    settings = get_settings()

    if settings.vector_backend in ("chroma", "chroma-http"):
        return _get_chroma(collection_name, settings)
    else:
        return _get_qdrant(collection_name, settings)


def _get_chroma(collection_name: str, settings):
    """Chroma 向量库（HTTP 或嵌入式）"""
    import chromadb

    ef = _build_embedding_function(settings)

    if settings.vector_backend == "chroma-http":
        host = settings.chroma_host
        port = settings.chroma_port
        client = chromadb.HttpClient(host=host, port=port)
        logger.info(f"   Chroma HTTP: {host}:{port}")
    else:
        persist_dir = settings.chroma_persist_dir
        os.makedirs(persist_dir, exist_ok=True)
        client = chromadb.PersistentClient(path=persist_dir)
        logger.info(f"   Chroma 嵌入式: {persist_dir}")

    collection = client.get_or_create_collection(
        name=collection_name,
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"},
    )

    return ChromaVectorStore(collection)


def _get_qdrant(collection_name: str, settings):
    """Qdrant 向量库（生产环境）"""
    raise NotImplementedError("Qdrant 后端尚未实现，请使用 Chroma")


class ChromaVectorStore:
    """Chroma 向量库封装"""

    def __init__(self, collection):
        self.collection = collection

    def count(self) -> int:
        """返回 collection 中的向量数量"""
        return self.collection.count()

    def add_documents(
        self,
        ids: List[str],
        documents: List[str],
        metadatas: List[dict],
    ):
        """写入文档向量"""
        self.collection.upsert(
            ids=ids,
            documents=documents,
            metadatas=metadatas,
        )

    def search(
        self,
        query: str,
        course_id: int,
        top_k: int = 5,
    ) -> List[dict]:
        """检索相关文档，强制过滤 course_id"""
        results = self.collection.query(
            query_texts=[query],
            n_results=top_k,
            where={"course_id": course_id},
            include=["documents", "metadatas", "distances"],
        )

        docs = []
        if results and results["documents"]:
            for i, doc in enumerate(results["documents"][0]):
                docs.append({
                    "chunk_text": doc,
                    "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                    "score": 1 - results["distances"][0][i] if results["distances"] else 0,
                })

        return docs

    def delete_by_course(self, course_id: int):
        """删除指定课程的所有向量"""
        self.collection.delete(
            where={"course_id": course_id},
        )

    def delete_by_material(self, material_id: int):
        """删除指定资料的所有向量"""
        self.collection.delete(
            where={"material_id": material_id},
        )

    def delete_by_path_id(self, path_id: int):
        """删除指定学习路径的所有教学切片向量"""
        self.collection.delete(
            where={"path_id": path_id},
        )
