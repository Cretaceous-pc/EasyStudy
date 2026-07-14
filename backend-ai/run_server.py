"""FastAPI 启动脚本（位于 backend-ai 目录内）"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, log_level="info")
