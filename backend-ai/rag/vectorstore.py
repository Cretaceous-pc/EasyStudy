"""
向量库操作

支持两种后端:
- chroma-http:  Chroma Docker 容器（推荐，无需本地编译依赖）
- chroma:       Chroma 嵌入式（需要 Visual C++ Build Tools）
- qdrant:       Qdrant（生产环境，待实现）
"""

import os
from typing import List, Optional

from services.config import get_settings


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

    if settings.vector_backend == "chroma-http":
        # Docker 模式：通过 HTTP 连接
        host = settings.chroma_host
        port = settings.chroma_port
        client = chromadb.HttpClient(host=host, port=port)
        print(f"   Chroma HTTP: {host}:{port}")
    else:
        # 嵌入式模式：本地持久化
        persist_dir = settings.chroma_persist_dir
        os.makedirs(persist_dir, exist_ok=True)
        client = chromadb.PersistentClient(path=persist_dir)
        print(f"   Chroma 嵌入式: {persist_dir}")

    collection = client.get_or_create_collection(
        name=collection_name,
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
