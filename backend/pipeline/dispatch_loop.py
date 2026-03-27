"""分发协程（Phase 4 完整版）：从 result_queue 取推理结果 →
  1. 虚拟线双向计数（counter.py）
  2. 异常停车检测（parking_detector.py）
  3. 预警触发/解除（alert_resolver.py）
  4. 推送 ws_queue（供 Phase 6 ws_push_loop 消费）
  5. 推送 db_queue（供 Phase 5 db_write_loop 消费）
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from inference.counter import count_crossings
from inference.parking_detector import check_parking
from pipeline.context import DevicePipelineContext
from services.alert_resolver import alert_resolver

logger = logging.getLogger(__name__)


def _utcnow_str() -> str:
    return datetime.now(timezone.utc).isoformat()


async def dispatch_loop(ctx: DevicePipelineContext) -> None:
    """分发协程主循环，运行直到任务被取消。"""
    logger.info(f"[DispatchLoop] device {ctx.device_id} started")
    seq = 0

    while True:
        try:
            data: dict = await ctx.result_queue.get()
        except asyncio.CancelledError:
            break

        seq += 1
        results = data.get("results", [])
        inference_ms = data.get("inference_ms", 0.0)
        timestamp = _utcnow_str()

        # ── 读取热缓存配置 ───────────────────────────────────────────────────────
        line_y = ctx.settings_cache.get("line_y", 240)
        park_timeout = ctx.settings_cache.get("park_timeout_seconds", 30)

        # ── 1. 虚拟线双向计数 ────────────────────────────────────────────────────
        in_count, out_count = count_crossings(results, line_y, ctx.crossing_tracker)
        ctx.passed_in_count += in_count
        ctx.passed_out_count += out_count

        # ── 2. 异常停车检测 ──────────────────────────────────────────────────────
        alerted_ids = alert_resolver.get_park_alerted_ids(ctx.device_id)
        new_park_ids, recovered_ids = check_parking(
            results, ctx.parked_tracker, park_timeout, alerted_ids
        )

        # 触发停车预警
        for tid in new_park_ids:
            await alert_resolver.on_parking_triggered(ctx.device_id, tid, len(results))

        # 解除停车预警
        for tid in recovered_ids:
            await alert_resolver.on_parking_recovered(ctx.device_id, tid)

        # ── 3. 拥堵预警检查 ──────────────────────────────────────────────────────
        await alert_resolver.check_congestion(ctx.device_id, len(results), ctx.settings_cache)

        # ── 4. 零流量预警检查 ────────────────────────────────────────────────────
        await alert_resolver.check_flow_zero(ctx.device_id, len(results))

        # 更新统计快照
        ctx.stats.vehicle_count = len(results)

        # ── 5. 构造 WebSocket 推送消息 ────────────────────────────────────────────
        ws_msg = {
            "type": "stream_frame",
            "device_id": ctx.device_id,
            "timestamp": timestamp,
            "frame": {
                "data": data.get("frame_b64", ""),
                "width": data.get("width", 640),
                "height": data.get("height", 480),
                "seq": seq,
            },
            "detection": {
                "vehicle_count": len(results),
                "passed_count": ctx.passed_in_count + ctx.passed_out_count,
                "passed_in_count": ctx.passed_in_count,
                "passed_out_count": ctx.passed_out_count,
                "alert_level": ctx.stats.alert_level,
                "vehicles": [
                    {
                        "tracking_id": r.tracking_id,
                        "class_id": r.class_id,
                        "class_name": r.class_name,
                        "confidence": round(r.confidence, 2),
                        "bbox": list(r.bbox),
                        "is_parked": r.tracking_id in alerted_ids,
                    }
                    for r in results
                ],
                "line_y": line_y,
                "inference_ms": inference_ms,
            },
        }

        try:
            ctx.ws_queue.put_nowait(ws_msg)
        except asyncio.QueueFull:
            pass

        # ── 6. 构造 DB 写入任务 ───────────────────────────────────────────────────
        db_task = {
            "device_id": ctx.device_id,
            "timestamp": timestamp,
            "vehicle_count": len(results),
            "inference_ms": inference_ms,
            "passed_in": in_count,
            "passed_out": out_count,
        }
        try:
            ctx.db_queue.put_nowait(db_task)
        except asyncio.QueueFull:
            pass

    logger.info(f"[DispatchLoop] device {ctx.device_id} stopped")
