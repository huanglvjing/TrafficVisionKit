"""FastAPI 应用入口（Phase 1 骨架，后续各 Phase 逐步填充）。"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动时初始化资源，关闭时释放资源。"""
    # Phase 3+ 会在此处启动 TCP Server 和 PipelineManager
    yield
    # Phase 3+ 会在此处关闭 TCP Server


app = FastAPI(
    title="车辆检测与计数系统",
    description="STM32 采集 → TCP 传输 → YOLO 推理 → WebSocket 推送",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["system"])
async def health_check():
    """快速健康检查接口（无需鉴权）。"""
    return {"status": "ok", "version": "0.1.0"}
