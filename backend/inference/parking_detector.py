"""异常停车检测（见设计稿 3.3 节、9.1 节）。

触发条件：某 tracking_id 静止超过 park_timeout_seconds（位移 < 5px）
自动解除条件：
  - tracking_id 从画面消失（ByteTrack 不再追踪）→ alert_resolver 处理
  - 恢复移动（位移 > 20px）持续 5 秒 → 此处返回 recovered_ids

parked_tracker 格式：
{
    tracking_id: {
        "last_center": (x, y),
        "still_since": float,       # time.monotonic()，开始静止的时间戳
        "alerted": bool,            # 是否已触发过预警（防重复）
        "moving_since": float | None, # 开始恢复移动的时间戳（用于迟滞解除）
    }
}
"""
from __future__ import annotations

import time

from inference.engine import DetectionResult

_STILL_THRESHOLD_PX = 5      # 位移小于此值视为静止（像素）
_MOVE_THRESHOLD_PX = 20      # 位移大于此值视为恢复移动（像素）
_RECOVER_HYSTERESIS_S = 5.0  # 持续移动多少秒后才确认解除（迟滞）


def _distance(a: tuple[int, int], b: tuple[int, int]) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5


def check_parking(
    vehicles: list[DetectionResult],
    parked_tracker: dict,
    park_timeout: int,
    alerted_ids: set[int],
) -> tuple[list[int], list[int]]:
    """
    检测异常停车并返回本帧的触发/恢复列表。

    参数：
        vehicles       : 当前帧 DetectionResult 列表
        parked_tracker : 跨帧状态字典（原地修改），见模块文档
        park_timeout   : 触发停车预警的静止秒数（来自设备配置热缓存）
        alerted_ids    : 当前已有未解除停车预警的 tracking_id 集合（由 alert_resolver 维护）

    返回：
        (new_park_ids, recovered_ids)
        new_park_ids   : 本帧刚达到静止时长阈值、应触发预警的 tracking_id 列表
        recovered_ids  : 本帧刚确认恢复移动、应解除停车预警的 tracking_id 列表
    """
    now = time.monotonic()
    current_ids: set[int] = set()
    new_park_ids: list[int] = []
    recovered_ids: list[int] = []

    for v in vehicles:
        tid = v.tracking_id
        if tid < 0:
            continue
        center = v.center
        current_ids.add(tid)

        if tid not in parked_tracker:
            parked_tracker[tid] = {
                "last_center": center,
                "still_since": now,
                "alerted": False,
                "moving_since": None,
            }
            continue

        state = parked_tracker[tid]
        dist = _distance(center, state["last_center"])

        if dist < _STILL_THRESHOLD_PX:
            # 仍然静止
            state["moving_since"] = None
            still_duration = now - state["still_since"]
            if still_duration >= park_timeout and not state["alerted"] and tid not in alerted_ids:
                # 首次达到停车阈值，触发预警
                state["alerted"] = True
                new_park_ids.append(tid)
        else:
            # 车辆在移动
            if dist >= _MOVE_THRESHOLD_PX:
                if state["moving_since"] is None:
                    state["moving_since"] = now
                elif now - state["moving_since"] >= _RECOVER_HYSTERESIS_S:
                    # 持续移动超过 5 秒，确认解除
                    if state["alerted"] or tid in alerted_ids:
                        recovered_ids.append(tid)
                    # 重置状态
                    state["alerted"] = False
                    state["still_since"] = now
                    state["moving_since"] = None
            else:
                # 小幅移动（5~20px），重置静止计时但不认为是"恢复移动"
                state["still_since"] = now
                state["moving_since"] = None

        state["last_center"] = center

    # 清理已离开画面的 tracking_id，触发"消失"解除
    dead_ids = set(parked_tracker.keys()) - current_ids
    for dead_id in dead_ids:
        if parked_tracker[dead_id]["alerted"] or dead_id in alerted_ids:
            recovered_ids.append(dead_id)
        del parked_tracker[dead_id]

    return new_park_ids, recovered_ids
