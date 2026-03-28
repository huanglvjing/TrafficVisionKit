"""推理协程：从 raw_queue 取 JPEG 帧 → ThreadPoolExecutor 推理 → 结果写 result_queue。

- 推理在线程池中运行（避免阻塞 asyncio 事件循环）
- 全局共享 executor（max_workers=2，避免多设备并发把 GPU 撑爆）
- 推理结果含渲染帧（base64）、DetectionResult 列表、推理耗时
"""
from __future__ import annotations

import asyncio
import base64
import logging
import time
from concurrent.futures import ThreadPoolExecutor

import cv2
import numpy as np

from inference.engine import engine
from pipeline.context import DevicePipelineContext

logger = logging.getLogger(__name__)

# 全局共享 ThreadPoolExecutor，max_workers=2（见设计稿 10.2 节）
_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="yolo")


def _run_inference(jpeg_bytes: bytes, ctx: DevicePipelineContext, confidence: float) -> dict:
    """在线程中执行推理（同步函数，由 run_in_executor 调用）。"""
    t0 = time.perf_counter()

    # 解码 JPEG
    nparr = np.frombuffer(jpeg_bytes, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None:
        return {}

    # YOLO 推理 + ByteTrack 跟踪（rendered 丢弃，由前端 Canvas 绘制 HUD 检测框）
    results, _ = engine.detect(frame, {}, confidence)

    # 编码原始帧（无 OpenCV 标注），前端负责高科技可视化
    _, enc = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 82])
    frame_b64 = base64.b64encode(enc.tobytes()).decode("ascii")

    elapsed_ms = (time.perf_counter() - t0) * 1000

    h, w = frame.shape[:2]
    return {
        "frame_b64": frame_b64,
        "width": w,
        "height": h,
        "results": results,
        "inference_ms": round(elapsed_ms, 1),
    }


async def inference_loop(ctx: DevicePipelineContext) -> None:
    """推理协程主循环，运行直到任务被取消（设备断线时）。"""
    loop = asyncio.get_running_loop()
    logger.info(f"[InferenceLoop] device {ctx.device_id} started")

    while True:
        try:
            jpeg_bytes: bytes = await ctx.raw_queue.get()
        except asyncio.CancelledError:
            break

        # 若热缓存已被 invalidate_settings_cache 清空，则从 DB 重载
        if not ctx.settings_cache:
            from sqlalchemy import select
            from database import AsyncSessionLocal
            from models import DeviceSettings
            try:
                async with AsyncSessionLocal() as db_session:
                    res = await db_session.execute(
                        select(DeviceSettings).where(DeviceSettings.device_id == ctx.device_id)
                    )
                    ds = res.scalar_one_or_none()
                    if ds:
                        ctx.settings_cache = {
                            "line_y": ds.line_y,
                            "confidence": ds.confidence,
                            "fps_limit": ds.fps_limit,
                            "alert_l2_threshold": ds.alert_l2_threshold,
                            "alert_l3_threshold": ds.alert_l3_threshold,
                            "alert_l4_threshold": ds.alert_l4_threshold,
                            "park_timeout_seconds": ds.park_timeout_seconds,
                        }
            except Exception as exc:
                logger.warning(f"[InferenceLoop] reload settings cache failed: {exc}")

        confidence = ctx.settings_cache.get("confidence", 0.5)

        try:
            result = await loop.run_in_executor(
                _executor,
                _run_inference,
                jpeg_bytes,
                ctx,
                confidence,
            )
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.exception(f"[InferenceLoop] device {ctx.device_id} inference error: {exc}")
            continue

        if not result:
            continue

        # 记录推理耗时到统计
        ctx.stats.record_frame(result["inference_ms"])

        # 写入 result_queue（非阻塞，满则丢弃最旧结果）
        data = {
            "device_id": ctx.device_id,
            **result,
        }
        if ctx.result_queue.full():
            try:
                ctx.result_queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
        try:
            ctx.result_queue.put_nowait(data)
        except asyncio.QueueFull:
            pass

    logger.info(f"[InferenceLoop] device {ctx.device_id} stopped")
