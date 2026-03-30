"""分发协程：从 result_queue 取推理结果 →
  1. 虚拟线双向计数
  2. 异常停车检测
  3. 占道率 / LOS 计算
  4. 速度估算 + 超速检测
  5. 逆行检测
  6. 车头时距
  7. 排队长度
  8. 预警触发/解除
  9. 推送 ws_queue（供 ws_push_loop 消费）
  10. 推送 db_queue（供 db_write_loop → aggregator 消费）
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from inference.counter import count_crossings
from inference.parking_detector import check_parking
from inference.metrics import (
    compute_occupancy,
    occupancy_to_los,
    update_speed_history,
    compute_fleet_speeds,
    update_direction_history,
    count_wrong_way_vehicles,
    record_crossing_for_headway,
    get_avg_headway,
    get_min_headway,
    estimate_queue_length,
)
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

        # ── 读取热缓存配置 ────────────────────────────────────────────────────
        line_y        = ctx.settings_cache.get("line_y", 240)
        park_timeout  = ctx.settings_cache.get("park_timeout_seconds", 30)
        roi_x1        = ctx.settings_cache.get("roi_x1", 0)
        roi_y1        = ctx.settings_cache.get("roi_y1", 0)
        roi_x2        = ctx.settings_cache.get("roi_x2", 640)
        roi_y2        = ctx.settings_cache.get("roi_y2", 480)
        px_per_meter  = ctx.settings_cache.get("calibration_px_per_meter")   # None=未标定
        speed_limit   = ctx.settings_cache.get("speed_limit_kmh", 60)
        allowed_dir   = ctx.settings_cache.get("allowed_direction", "both")
        fps_hint      = ctx.stats.fps if ctx.stats.fps > 0 else 25.0

        # ── 1. 虚拟线双向计数 ────────────────────────────────────────────────
        in_count, out_count = count_crossings(results, line_y, ctx.crossing_tracker)
        ctx.passed_in_count += in_count
        ctx.passed_out_count += out_count

        # ── 2. 更新速度历史（所有后续速度计算依赖此步）──────────────────────
        update_speed_history(results, ctx.speed_history)

        # ── 3. 更新方向历史（逆行检测依赖此步）─────────────────────────────
        update_direction_history(results, ctx.direction_history, ctx.speed_history)

        # ── 4. 占道率 + LOS ──────────────────────────────────────────────────
        occupancy = compute_occupancy(results, roi_x1, roi_y1, roi_x2, roi_y2)
        los_grade = occupancy_to_los(occupancy)
        ctx.occupancy_samples.append(occupancy)

        # ── 5. 热力图密度矩阵更新 ────────────────────────────────────────────
        _update_heatmap(ctx, results, roi_x1, roi_y1, roi_x2, roi_y2)

        # ── 6. 速度估算 + 超速检测 ───────────────────────────────────────────
        avg_speed, max_speed, per_vehicle_speeds = compute_fleet_speeds(
            results, ctx.speed_history, px_per_meter, fps_hint
        )
        speed_dict = dict(per_vehicle_speeds)  # {tracking_id: speed_kmh}

        if avg_speed is not None:
            ctx.speed_samples.append(avg_speed)
        if max_speed is not None:
            ctx.max_speed_samples.append(max_speed)

        # 超速检测：对每辆车判断
        speeding_ids: list[int] = []
        if px_per_meter and per_vehicle_speeds:
            for tid, spd in per_vehicle_speeds:
                if spd > speed_limit:
                    speeding_ids.append(tid)
                    ctx.speed_violation_count += 1

        # ── 7. 逆行检测 ──────────────────────────────────────────────────────
        wrong_way_cnt, wrong_way_ids = count_wrong_way_vehicles(
            results, ctx.direction_history, allowed_dir
        )
        if wrong_way_cnt > 0:
            ctx.wrong_way_count += wrong_way_cnt

        # ── 8. 异常停车检测 ──────────────────────────────────────────────────
        alerted_ids = alert_resolver.get_park_alerted_ids(ctx.device_id)
        new_park_ids, recovered_ids = check_parking(
            results, ctx.parked_tracker, park_timeout, alerted_ids
        )
        for tid in new_park_ids:
            await alert_resolver.on_parking_triggered(ctx.device_id, tid, len(results))
        for tid in recovered_ids:
            await alert_resolver.on_parking_recovered(ctx.device_id, tid)

        # ── 9. 拥堵预警 + 零流量预警 ─────────────────────────────────────────
        await alert_resolver.check_congestion(ctx.device_id, len(results), ctx.settings_cache)
        await alert_resolver.check_flow_zero(ctx.device_id, len(results))

        # ── 10. 超速预警（write speed_event + alert） ────────────────────────
        for tid in speeding_ids:
            spd = speed_dict.get(tid, 0.0)
            v = next((r for r in results if r.tracking_id == tid), None)
            bbox_snap = (
                f"{v.bbox[0]},{v.bbox[1]},{v.bbox[2]},{v.bbox[3]}" if v else None
            )
            await alert_resolver.on_speeding(ctx.device_id, tid, spd, bbox_snap)

        # ── 11. 逆行预警 ─────────────────────────────────────────────────────
        for tid in wrong_way_ids:
            await alert_resolver.on_wrong_way(ctx.device_id, tid, len(results))

        # ── 12. 车头时距：过线时记录 ─────────────────────────────────────────
        if in_count > 0 or out_count > 0:
            headway = record_crossing_for_headway(ctx.headway_state)
            if headway is not None and headway < 1.0:
                # 密集流预警（车头时距 < 1s）
                await alert_resolver.on_dense_flow(ctx.device_id, len(results))

        avg_headway = get_avg_headway(ctx.headway_state)
        min_headway = get_min_headway(ctx.headway_state)

        # ── 13. 排队长度 ─────────────────────────────────────────────────────
        parked_vehicles = [r for r in results if r.tracking_id in alerted_ids]
        queue_len = estimate_queue_length(parked_vehicles)
        if queue_len >= 5:
            await alert_resolver.on_queue_detected(ctx.device_id, queue_len, len(results))

        # 更新统计快照
        ctx.stats.vehicle_count = len(results)

        # ── 14. 构造 WebSocket 推送消息 ───────────────────────────────────────
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
                        "is_wrong_way": r.tracking_id in wrong_way_ids,
                        "speed_kmh": round(speed_dict.get(r.tracking_id, 0.0), 1)
                            if r.tracking_id in speed_dict else None,
                    }
                    for r in results
                ],
                "line_y": line_y,
                "inference_ms": inference_ms,
                # ── 0002 新增字段 ────────────────────────────────────────────
                "occupancy": round(occupancy, 4),
                "los_grade": los_grade,
                "avg_speed_kmh": round(avg_speed, 1) if avg_speed is not None else None,
                "avg_headway_sec": round(avg_headway, 2) if avg_headway is not None else None,
                "min_headway_sec": round(min_headway, 2) if min_headway is not None else None,
                "queue_length": queue_len,
                "wrong_way_active": bool(wrong_way_ids),
                "speed_calibrated": px_per_meter is not None,
            },
        }

        try:
            ctx.ws_queue.put_nowait(ws_msg)
        except asyncio.QueueFull:
            pass

        # ── 15. 构造 DB 写入任务 ──────────────────────────────────────────────
        db_task = {
            "device_id": ctx.device_id,
            "timestamp": timestamp,
            "vehicle_count": len(results),
            "inference_ms": inference_ms,
            "passed_in": in_count,
            "passed_out": out_count,
            # 0002 新增
            "occupancy": occupancy,
            "avg_speed": avg_speed,
            "max_speed": max_speed,
            "speed_violation_count": len(speeding_ids),
            "avg_headway": avg_headway,
            "min_headway": min_headway,
            "queue_length": queue_len,
            "los_grade": los_grade,
            "wrong_way_count": wrong_way_cnt,
        }
        try:
            ctx.db_queue.put_nowait(db_task)
        except asyncio.QueueFull:
            pass

    logger.info(f"[DispatchLoop] device {ctx.device_id} stopped")


def _update_heatmap(
    ctx: DevicePipelineContext,
    vehicles: list,
    roi_x1: int,
    roi_y1: int,
    roi_x2: int,
    roi_y2: int,
) -> None:
    """将当前帧 bbox 中心点投影到 64×48 密度网格，原地累加。"""
    roi_w = max(roi_x2 - roi_x1, 1)
    roi_h = max(roi_y2 - roi_y1, 1)
    for v in vehicles:
        cx, cy = v.center
        # 坐标归一化到 ROI 内
        gx = int((cx - roi_x1) / roi_w * 64)
        gy = int((cy - roi_y1) / roi_h * 48)
        gx = max(0, min(gx, 63))
        gy = max(0, min(gy, 47))
        ctx.heatmap_grid[gx][gy] += 1
    if vehicles:
        ctx.heatmap_sample_count += 1
