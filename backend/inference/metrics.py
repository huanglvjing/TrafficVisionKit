"""实时交通指标计算模块（0002 新增）。

包含：
  - 占道率（Road Occupancy）+ LOS 服务水平等级
  - 速度估算（需标定系数）
  - 逆行检测
  - 车头时距
  - 排队长度估算

所有函数均为纯函数或仅修改传入的 tracker dict，无全局副作用。
"""
from __future__ import annotations

import math
import time
from collections import deque
from typing import Optional

from inference.engine import DetectionResult

# ─────────────────────────────────────────────────────────────────────────────
# LOS 等级阈值（基于占道率，交通工程标准分类）
# ─────────────────────────────────────────────────────────────────────────────

_LOS_THRESHOLDS: list[tuple[float, str]] = [
    (0.15, "A"),
    (0.35, "B"),
    (0.55, "C"),
    (0.75, "D"),
    (0.90, "E"),
    (1.01, "F"),
]


def occupancy_to_los(occupancy: float) -> str:
    """将占道率（0~1）转换为 LOS 等级（A~F）。"""
    for threshold, grade in _LOS_THRESHOLDS:
        if occupancy < threshold:
            return grade
    return "F"


# ─────────────────────────────────────────────────────────────────────────────
# 占道率
# ─────────────────────────────────────────────────────────────────────────────

def compute_occupancy(
    vehicles: list[DetectionResult],
    roi_x1: int,
    roi_y1: int,
    roi_x2: int,
    roi_y2: int,
) -> float:
    """计算当前帧占道率（0~1）。

    公式：Σ(bbox_w × bbox_h) / ROI_area
    结果裁剪到 [0, 1]。
    """
    roi_area = max((roi_x2 - roi_x1) * (roi_y2 - roi_y1), 1)
    total_bbox_area = 0
    for v in vehicles:
        x1, y1, x2, y2 = v.bbox
        w = max(x2 - x1, 0)
        h = max(y2 - y1, 0)
        total_bbox_area += w * h
    return min(total_bbox_area / roi_area, 1.0)


# ─────────────────────────────────────────────────────────────────────────────
# 速度估算
# ─────────────────────────────────────────────────────────────────────────────

# 每个 tracking_id 保留最近 N 帧中心点历史
_SPEED_HISTORY_FRAMES = 5


def update_speed_history(
    vehicles: list[DetectionResult],
    speed_history: dict,   # {tracking_id: deque[(cx, cy, ts)]}
) -> None:
    """更新速度历史队列（原地修改 speed_history）。每帧调用一次。"""
    now = time.monotonic()
    current_ids: set[int] = set()
    for v in vehicles:
        tid = v.tracking_id
        if tid < 0:
            continue
        current_ids.add(tid)
        if tid not in speed_history:
            speed_history[tid] = deque(maxlen=_SPEED_HISTORY_FRAMES)
        speed_history[tid].append((v.center[0], v.center[1], now))

    # 清理已离开画面的 tracking_id
    dead = set(speed_history.keys()) - current_ids
    for d in dead:
        del speed_history[d]


def estimate_speed_kmh(
    tracking_id: int,
    speed_history: dict,
    px_per_meter: float,
    fps: float,
) -> Optional[float]:
    """估算指定 tracking_id 的速度（km/h）。

    使用最近 N 帧的平均位移除以时间，比相邻两帧更稳定。
    返回 None 表示历史点不足或未标定。
    """
    if px_per_meter <= 0 or fps <= 0:
        return None
    hist = speed_history.get(tracking_id)
    if not hist or len(hist) < 2:
        return None
    oldest = hist[0]
    newest = hist[-1]
    dx = newest[0] - oldest[0]
    dy = newest[1] - oldest[1]
    pixel_dist = math.sqrt(dx * dx + dy * dy)
    elapsed_sec = newest[2] - oldest[2]
    if elapsed_sec <= 0:
        return None
    speed_mps = (pixel_dist / px_per_meter) / elapsed_sec
    return speed_mps * 3.6  # m/s → km/h


def compute_fleet_speeds(
    vehicles: list[DetectionResult],
    speed_history: dict,
    px_per_meter: Optional[float],
    fps: float,
) -> tuple[Optional[float], Optional[float], list[tuple[int, float]]]:
    """批量计算当前帧所有车辆速度。

    返回：(avg_speed_kmh, max_speed_kmh, [(tracking_id, speed_kmh), ...])
    px_per_meter 为 None 时三项均返回 None / 空列表。
    """
    if not px_per_meter:
        return None, None, []
    per_vehicle: list[tuple[int, float]] = []
    for v in vehicles:
        spd = estimate_speed_kmh(v.tracking_id, speed_history, px_per_meter, fps)
        if spd is not None:
            per_vehicle.append((v.tracking_id, spd))
    if not per_vehicle:
        return None, None, []
    speeds = [s for _, s in per_vehicle]
    return sum(speeds) / len(speeds), max(speeds), per_vehicle


# ─────────────────────────────────────────────────────────────────────────────
# 逆行检测
# ─────────────────────────────────────────────────────────────────────────────

_WRONG_WAY_FRAMES = 5       # 连续帧数阈值
_WRONG_WAY_MIN_PX = 20      # 累计位移阈值（防抖）


def update_direction_history(
    vehicles: list[DetectionResult],
    direction_history: dict,  # {tracking_id: deque[dy]}
    speed_history: dict,
) -> None:
    """更新方向历史队列（原地修改 direction_history）。每帧调用一次。

    dy > 0 = 向下（Y 增大），dy < 0 = 向上（Y 减小）。
    利用 speed_history 中已有的相邻帧位置计算 dy，避免重复维护。
    """
    current_ids: set[int] = set()
    for v in vehicles:
        tid = v.tracking_id
        if tid < 0:
            continue
        current_ids.add(tid)
        hist = speed_history.get(tid)
        if hist and len(hist) >= 2:
            dy = hist[-1][1] - hist[-2][1]
            if tid not in direction_history:
                direction_history[tid] = deque(maxlen=_WRONG_WAY_FRAMES + 2)
            direction_history[tid].append(dy)

    dead = set(direction_history.keys()) - current_ids
    for d in dead:
        del direction_history[d]


def detect_wrong_way(
    tracking_id: int,
    direction_history: dict,
    allowed_direction: str,
) -> bool:
    """判断指定车辆是否正在逆行。

    allowed_direction: 'both' | 'down'（仅允许向下）| 'up'（仅允许向上）
    """
    if allowed_direction == "both":
        return False
    hist = direction_history.get(tracking_id)
    if not hist or len(hist) < _WRONG_WAY_FRAMES:
        return False
    recent = list(hist)[-_WRONG_WAY_FRAMES:]
    cumulative = sum(recent)
    if allowed_direction == "down" and cumulative < -_WRONG_WAY_MIN_PX:
        return True
    if allowed_direction == "up" and cumulative > _WRONG_WAY_MIN_PX:
        return True
    return False


def count_wrong_way_vehicles(
    vehicles: list[DetectionResult],
    direction_history: dict,
    allowed_direction: str,
) -> tuple[int, set[int]]:
    """返回 (逆行车辆数, 逆行 tracking_id 集合)。"""
    if allowed_direction == "both":
        return 0, set()
    ids: set[int] = set()
    for v in vehicles:
        if v.tracking_id < 0:
            continue
        if detect_wrong_way(v.tracking_id, direction_history, allowed_direction):
            ids.add(v.tracking_id)
    return len(ids), ids


# ─────────────────────────────────────────────────────────────────────────────
# 车头时距
# ─────────────────────────────────────────────────────────────────────────────

_HEADWAY_WINDOW = 10  # 用于计算均值的最近过线次数


def record_crossing_for_headway(
    headway_state: dict,  # {"last_ts": float | None, "recent": deque[float]}
) -> Optional[float]:
    """车辆穿越计数线时调用，记录时间戳并返回本次车头时距（秒）。

    headway_state 结构：
        {"last_ts": Optional[float], "recent": deque(maxlen=10)}
    """
    now = time.monotonic()
    headway: Optional[float] = None
    if headway_state.get("last_ts") is not None:
        headway = now - headway_state["last_ts"]
        headway_state["recent"].append(headway)
    headway_state["last_ts"] = now
    return headway


def get_avg_headway(headway_state: dict) -> Optional[float]:
    """返回最近 N 次车头时距的均值（秒），不足2次返回 None。"""
    recent: deque = headway_state.get("recent", deque())
    if len(recent) < 2:
        return None
    return sum(recent) / len(recent)


def get_min_headway(headway_state: dict) -> Optional[float]:
    recent: deque = headway_state.get("recent", deque())
    if not recent:
        return None
    return min(recent)


def init_headway_state() -> dict:
    return {"last_ts": None, "recent": deque(maxlen=_HEADWAY_WINDOW)}


# ─────────────────────────────────────────────────────────────────────────────
# 排队长度估算
# ─────────────────────────────────────────────────────────────────────────────

_QUEUE_Y_CLUSTER_PX = 50   # 纵向坐标差 < 此值的静止车辆归为同一组


def estimate_queue_length(parked_vehicles: list[DetectionResult]) -> int:
    """估算静止车辆排队长度（最大聚类的辆数）。

    parked_vehicles: is_parked 为 True 的车辆列表。
    """
    if not parked_vehicles:
        return 0
    centers_y = sorted(v.center[1] for v in parked_vehicles)
    groups: list[list[int]] = [[centers_y[0]]]
    for y in centers_y[1:]:
        if y - groups[-1][-1] < _QUEUE_Y_CLUSTER_PX:
            groups[-1].append(y)
        else:
            groups.append([y])
    return max(len(g) for g in groups)
