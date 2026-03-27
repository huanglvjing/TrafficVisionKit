"""WebSocket 推送协程（Phase 6）：从 ws_queue 取完整 stream_frame 消息 → 广播。

dispatch_loop 已将 stream_frame JSON 打包完毕放入 ws_queue，
本协程只负责从队列取出并通过 WebSocketManager 广播给订阅该设备的所有前端连接。
"""
from __future__ import annotations

import asyncio
import logging

from pipeline.context import DevicePipelineContext

logger = logging.getLogger(__name__)


async def ws_push_loop(ctx: DevicePipelineContext) -> None:
    """WebSocket 推送协程主循环，运行直到任务被取消（设备断线时）。"""
    # 延迟导入避免模块级循环引用
    from services.websocket_manager import ws_manager

    logger.info(f"[WSPushLoop] device {ctx.device_id} started")

    while True:
        try:
            msg: dict = await ctx.ws_queue.get()
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.warning(f"[WSPushLoop] device {ctx.device_id} queue error: {exc}")
            continue

        try:
            await ws_manager.broadcast_stream(ctx.device_id, msg)
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.warning(
                f"[WSPushLoop] broadcast failed device={ctx.device_id}: {exc}"
            )

    logger.info(f"[WSPushLoop] device {ctx.device_id} stopped")
