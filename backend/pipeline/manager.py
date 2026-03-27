"""PipelineManager：管理所有设备的 Pipeline 生命周期。

见设计稿 10.1 节：
- on_device_connected  → 创建 Context、预加载配置热缓存、启动 4 个协程 Task
- on_device_disconnected → 取消 4 个协程 Task、从字典移除
- invalidate_settings_cache → 清除配置热缓存（PUT settings 后调用）
- get_context → 供 TCP Server 读取 raw_queue

Phase 3：inference_loop + dispatch_loop（noop 占位 ws/db）。
Phase 5：db_write_loop 替换 db noop。
Phase 6：ws_push_loop 替换 ws noop。
"""
from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from database import AsyncSessionLocal
from inference.engine import engine
from models import DeviceSettings
from pipeline.context import DevicePipelineContext
from pipeline.db_write_loop import db_write_loop
from pipeline.dispatch_loop import dispatch_loop
from pipeline.inference_loop import inference_loop

logger = logging.getLogger(__name__)


class PipelineManager:
    """全局单例，管理所有 STM32 设备的 Pipeline。"""

    def __init__(self) -> None:
        self._contexts: dict[int, DevicePipelineContext] = {}

    def get_context(self, device_id: int) -> DevicePipelineContext | None:
        return self._contexts.get(device_id)

    def get_all_contexts(self) -> list[DevicePipelineContext]:
        return list(self._contexts.values())

    async def _load_settings_cache(self, device_id: int) -> dict:
        """从数据库加载设备配置到热缓存字典。"""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(DeviceSettings).where(DeviceSettings.device_id == device_id)
            )
            settings = result.scalar_one_or_none()
            if settings is None:
                return {}
            return {
                "line_y": settings.line_y,
                "confidence": settings.confidence,
                "fps_limit": settings.fps_limit,
                "alert_l2_threshold": settings.alert_l2_threshold,
                "alert_l3_threshold": settings.alert_l3_threshold,
                "alert_l4_threshold": settings.alert_l4_threshold,
                "park_timeout_seconds": settings.park_timeout_seconds,
            }

    async def on_device_connected(self, device_id: int, device_ip: str) -> None:
        """设备 TCP 连接建立：创建 Context 并启动协程。"""
        if device_id in self._contexts:
            # 已有上下文说明之前断线未清理，先清理
            await self.on_device_disconnected(device_id)

        ctx = DevicePipelineContext(device_id=device_id, device_ip=device_ip)

        # 预加载配置热缓存
        ctx.settings_cache = await self._load_settings_cache(device_id)

        # 启动 4 个协程 Task（Phase 5/6 补充 db_write_loop 和 ws_push_loop）
        ctx.inference_task = asyncio.create_task(
            inference_loop(ctx), name=f"inference_{device_id}"
        )
        ctx.dispatch_task = asyncio.create_task(
            dispatch_loop(ctx), name=f"dispatch_{device_id}"
        )
        # db_task：Phase 5 接入 db_write_loop
        ctx.db_task = asyncio.create_task(
            db_write_loop(ctx), name=f"db_{device_id}"
        )
        # ws_task：Phase 6 替换为 ws_push_loop，暂时用占位协程
        ctx.ws_task = asyncio.create_task(
            _noop_loop(), name=f"ws_{device_id}"
        )

        self._contexts[device_id] = ctx
        logger.info(f"[PipelineManager] device {device_id} pipeline started")

    async def on_device_disconnected(self, device_id: int) -> None:
        """设备 TCP 断开：取消所有协程 Task。"""
        ctx = self._contexts.pop(device_id, None)
        if ctx is None:
            return
        await ctx.cancel_all_tasks()
        logger.info(f"[PipelineManager] device {device_id} pipeline stopped")

    def invalidate_settings_cache(self, device_id: int) -> None:
        """清除设备配置热缓存，下一帧读取前会重新从 DB 加载。
        
        注意：此方法是同步的，由 PUT /devices/{id}/settings 路由同步调用。
        热缓存在 TCP 帧处理时才会按需重载（懒加载），所以此处只需清空。
        """
        ctx = self._contexts.get(device_id)
        if ctx:
            ctx.settings_cache.clear()

    async def shutdown(self) -> None:
        """关闭所有 Pipeline（服务关闭时调用）。"""
        device_ids = list(self._contexts.keys())
        for device_id in device_ids:
            await self.on_device_disconnected(device_id)
        logger.info("[PipelineManager] all pipelines stopped")


async def _noop_loop() -> None:
    """占位协程，Phase 6 替换为 ws_push_loop。"""
    try:
        while True:
            await asyncio.sleep(3600)
    except asyncio.CancelledError:
        pass


# 全局单例
pipeline_manager = PipelineManager()
