"""虚拟线双向计数（纯函数，无副作用）。

设计稿 3.3 节规范：
- bbox 中心点 Y 从 < line_y 变为 >= line_y → 向下穿越 → passed_in_count++（进入方向）
- bbox 中心点 Y 从 >= line_y 变为 < line_y → 向上穿越 → passed_out_count++（驶出方向）
- 同一 tracking_id 在连续帧中保持一致的计数跟踪
- 离开画面的 tracking_id 从 tracker 中移除
"""
from __future__ import annotations

from inference.engine import DetectionResult


def count_crossings(
    vehicles: list[DetectionResult],
    line_y: int,
    crossing_tracker: dict,
) -> tuple[int, int]:
    """
    对当前帧的车辆列表执行虚拟线过线判断。

    参数：
        vehicles        : 当前帧 DetectionResult 列表
        line_y          : 虚拟计数线 Y 坐标（像素）
        crossing_tracker: 跨帧状态字典（原地修改），格式：
                          {tracking_id: {"prev_cy": int}}

    返回：
        (in_count, out_count) 本帧新增的进入和驶出计数
    """
    in_count = 0
    out_count = 0
    current_ids: set[int] = set()

    for v in vehicles:
        tid = v.tracking_id
        if tid < 0:
            continue
        cy = v.center[1]
        current_ids.add(tid)

        if tid in crossing_tracker:
            prev_cy = crossing_tracker[tid]["prev_cy"]
            # 向下穿越（进入方向）：前一帧在线上方，当前帧在线上或以下
            if prev_cy < line_y <= cy:
                in_count += 1
            # 向上穿越（驶出方向）：前一帧在线上或以下，当前帧在线上方
            elif prev_cy >= line_y > cy:
                out_count += 1

        crossing_tracker[tid] = {"prev_cy": cy}

    # 清理已离开画面的 tracking_id（ByteTrack 不再追踪）
    dead_ids = set(crossing_tracker.keys()) - current_ids
    for dead_id in dead_ids:
        del crossing_tracker[dead_id]

    return in_count, out_count
