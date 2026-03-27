"""数据清理定时任务（Phase 5，见设计稿第 8 节）。

每日凌晨 3:00 执行，对以下四张表按保留策略批量清理：
  - traffic_records   保留 90  天
  - traffic_alerts    保留 180 天
  - connection_sessions 保留 90  天
  - system_logs       保留 30  天

每批删除 1000 行，循环直到无剩余数据，避免单次大量 DELETE 造成表锁。
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta

from sqlalchemy import text

from database import AsyncSessionLocal

logger = logging.getLogger(__name__)

# 各表保留天数
_RETENTION: dict[str, int] = {
    "traffic_records": 90,
    "traffic_alerts": 180,
    "connection_sessions": 90,
    "system_logs": 30,
}

# 各表的时间字段名
_TIME_COLUMN: dict[str, str] = {
    "traffic_records": "recorded_at",
    "traffic_alerts": "triggered_at",
    "connection_sessions": "connected_at",
    "system_logs": "created_at",
}

_BATCH_SIZE = 1000


async def _delete_batch(table: str, time_col: str, cutoff: datetime) -> int:
    """删除指定表中早于 cutoff 的最多 _BATCH_SIZE 行，返回实际删除行数。"""
    sql = text(
        f"DELETE FROM `{table}` WHERE `{time_col}` < :cutoff LIMIT {_BATCH_SIZE}"
    )
    async with AsyncSessionLocal() as session:
        result = await session.execute(sql, {"cutoff": cutoff})
        await session.commit()
        return result.rowcount


async def _cleanup_table(table: str, retention_days: int) -> None:
    """对单张表执行批量清理，直到无剩余过期数据。"""
    time_col = _TIME_COLUMN[table]
    cutoff = datetime.now() - timedelta(days=retention_days)
    total = 0

    while True:
        try:
            deleted = await _delete_batch(table, time_col, cutoff)
        except Exception as exc:
            logger.error(f"[Cleanup] delete batch failed table={table}: {exc}")
            break

        total += deleted
        if deleted < _BATCH_SIZE:
            break
        # 短暂让出事件循环，避免长时间占用
        await asyncio.sleep(0.05)

    if total > 0:
        logger.info(f"[Cleanup] {table}: deleted {total} rows older than {retention_days}d")


async def _do_cleanup() -> None:
    """执行一次完整清理（按设计稿 8.2 节顺序）。"""
    logger.info("[Cleanup] daily cleanup started")
    for table, days in _RETENTION.items():
        await _cleanup_table(table, days)
    logger.info("[Cleanup] daily cleanup done")


def _seconds_until_3am() -> float:
    """计算到下一个本地凌晨 3:00 的等待秒数。"""
    now = datetime.now()
    target = now.replace(hour=3, minute=0, second=0, microsecond=0)
    if now >= target:
        target += timedelta(days=1)
    return (target - now).total_seconds()


async def _cleanup_loop() -> None:
    """定时循环：每日凌晨 3:00 触发一次清理。"""
    while True:
        wait = _seconds_until_3am()
        logger.debug(f"[Cleanup] next run in {wait / 3600:.1f} h")
        try:
            await asyncio.sleep(wait)
        except asyncio.CancelledError:
            break

        try:
            await _do_cleanup()
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.exception(f"[Cleanup] cleanup error: {exc}")


def start() -> asyncio.Task:
    """启动清理定时协程，返回 Task 句柄（main.py lifespan 调用）。"""
    return asyncio.create_task(_cleanup_loop(), name="cleanup_daily")
