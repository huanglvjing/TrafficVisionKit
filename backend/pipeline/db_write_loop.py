"""DB 写入协程（Phase 5）：从 db_queue 取推理统计数据 → 写入内存聚合缓冲区。

不直接操作数据库；数据库写入由 services/aggregator.py 的定时协程完成。
每帧调用一次 aggregator.add_sample()，纯内存操作，不阻塞事件循环。
"""
from __future__ import annotations

import asyncio
import logging

from pipeline.context import DevicePipelineContext

logger = logging.getLogger(__name__)


async def db_write_loop(ctx: DevicePipelineContext) -> None:
    """DB 写入协程主循环，运行直到任务被取消（设备断线时）。"""
    # 延迟导入避免模块级循环引用
    from services.aggregator import aggregator

    logger.info(f"[DBWriteLoop] device {ctx.device_id} started")

    while True:
        try:
            task: dict = await ctx.db_queue.get()
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.warning(f"[DBWriteLoop] device {ctx.device_id} queue error: {exc}")
            continue

        try:
            aggregator.add_sample(ctx.device_id, task)
        except Exception as exc:
            logger.warning(
                f"[DBWriteLoop] add_sample failed device={ctx.device_id}: {exc}"
            )

    logger.info(f"[DBWriteLoop] device {ctx.device_id} stopped")
