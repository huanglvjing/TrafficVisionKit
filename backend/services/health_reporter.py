"""全局健康数据广播服务（Phase 6，见设计稿 5.2 节 health_report）。

每秒向所有 /ws/health 连接推送一次 health_report：
  - 服务器指标：CPU%、内存%、GPU%（无 GPU 时为 null）、uptime
  - 各设备运行指标：FPS、队列深度、丢帧数、推理耗时、预警等级
  - 性能降级等级（0~3，见设计稿 11.1 节）：
      0 = 正常
      1 = 轻度（推理延迟 >30ms 或 raw_queue 深度 ≥2）
      2 = 严重（推理延迟 >50ms）
      3 = 紧急（系统内存 >90%）

GPU 指标通过 pynvml 获取，未安装或无 GPU 时均返回 null，不影响运行。
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Optional

import psutil

logger = logging.getLogger(__name__)

_START_TIME = time.time()

# ── GPU 指标（可选）────────────────────────────────────────────────────────────

try:
    import pynvml  # type: ignore[import]
    pynvml.nvmlInit()
    _NVML_OK = True
except Exception:
    _NVML_OK = False


def _gpu_stats() -> tuple[Optional[float], Optional[int]]:
    """返回 (gpu_percent, gpu_memory_used_mb)，无 GPU / 未安装 pynvml 时均为 None。"""
    if not _NVML_OK:
        return None, None
    try:
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)
        util = pynvml.nvmlDeviceGetUtilizationRates(handle)
        mem = pynvml.nvmlDeviceGetMemoryInfo(handle)
        return float(util.gpu), int(mem.used // (1024 * 1024))
    except Exception:
        return None, None


# ── 服务器系统指标 ──────────────────────────────────────────────────────────────

def _server_stats() -> dict:
    vm = psutil.virtual_memory()
    gpu_pct, gpu_mem = _gpu_stats()
    return {
        "cpu_percent": psutil.cpu_percent(),
        "memory_percent": round(vm.percent, 1),
        "gpu_percent": gpu_pct,
        "gpu_memory_used_mb": gpu_mem,
        "uptime_seconds": round(time.time() - _START_TIME, 1),
    }


# ── 性能降级评估（见设计稿 11.1 节）────────────────────────────────────────────

def _degradation_level(ctx) -> int:  # type: ignore[return]
    """评估单设备降级等级（0~3）。"""
    if psutil.virtual_memory().percent > 90:
        return 3
    avg_ms = ctx.stats.avg_inference_ms
    if avg_ms > 50:
        return 2
    if avg_ms > 30 or ctx.raw_queue.qsize() >= 2:
        return 1
    return 0


# ── 健康广播循环 ────────────────────────────────────────────────────────────────

async def _health_loop() -> None:
    """每秒采集系统/设备指标并广播 health_report。"""
    from pipeline.manager import pipeline_manager
    from services.websocket_manager import ws_manager

    while True:
        try:
            await asyncio.sleep(1.0)

            server = _server_stats()
            contexts = pipeline_manager.get_all_contexts()

            devices = []
            for ctx in contexts:
                deg = _degradation_level(ctx)
                ctx.stats.degradation_level = deg
                devices.append({
                    "device_id": ctx.device_id,
                    "is_active": True,
                    "fps": round(ctx.stats.fps, 1),
                    "raw_queue_size": ctx.raw_queue.qsize(),
                    "ws_queue_size": ctx.ws_queue.qsize(),
                    "db_queue_size": ctx.db_queue.qsize(),
                    "dropped_frames": ctx.stats.dropped_frames,
                    "avg_inference_ms": ctx.stats.avg_inference_ms,
                    "vehicle_count": ctx.stats.vehicle_count,
                    "alert_level": ctx.stats.alert_level,
                    "degradation_level": deg,
                })

            msg = {
                "type": "health_report",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "server": server,
                "devices": devices,
            }
            await ws_manager.broadcast_health(msg)

        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.warning(f"[HealthReporter] error: {exc}")


def start() -> asyncio.Task:
    """启动健康广播协程（main.py lifespan 调用）。"""
    return asyncio.create_task(_health_loop(), name="health_reporter")
