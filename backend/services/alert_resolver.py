"""预警触发与自动解除逻辑（见设计稿第 9 节）。

AlertResolver 全局单例，内部维护：
  active_alerts    : {device_id: {alert_type: alert_id}}   — 各设备当前未解除预警
  hysteresis_counter: {alert_id: {"below_since": float}}   — 拥堵迟滞解除计时
  congestion_state : {device_id: {"level": int, "since": float}}  — 拥堵触发持续确认
  flow_zero_state  : {device_id: {"since": float | None}}  — 零流量计时
  park_alerted_ids : {device_id: set[int]}                 — 已触发停车预警的 tracking_id

预警等级对应表（design doc 4.5 节）：
  1=信息, 2=轻微（L2拥堵）, 3=中度（L3拥堵/停车）, 4=严重（L4拥堵）, 5=紧急
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Optional

from database import AsyncSessionLocal
from models import TrafficAlert

logger = logging.getLogger(__name__)

# 拥堵触发持续时间（秒）和迟滞解除时间（秒）
_CONGESTION_TRIGGER_S = 10.0
_CONGESTION_HYSTERESIS_S = 30.0

# 零流量触发时间（秒）= 5 分钟
_FLOW_ZERO_TRIGGER_S = 300.0


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class AlertResolver:
    """全局单例，负责所有预警的触发、防重、解除和 WS 广播。"""

    def __init__(self) -> None:
        # {device_id: {alert_type: alert_id}}
        self._active: dict[int, dict[str, int]] = {}
        # 拥堵迟滞：{alert_id: float}，记录开始低于阈值的时间戳
        self._hysteresis: dict[int, float] = {}
        # 拥堵触发确认：{device_id: {"level": int, "since": float}}
        self._congestion_state: dict[int, dict] = {}
        # 零流量计时：{device_id: float | None}
        self._flow_zero_since: dict[int, Optional[float]] = {}
        # 已触发停车预警的 tracking_id：{device_id: set[int]}
        self._parked_alerted: dict[int, set] = {}

    # ── 外部接口 ─────────────────────────────────────────────────────────────────

    def get_park_alerted_ids(self, device_id: int) -> set[int]:
        return self._parked_alerted.get(device_id, set())

    async def check_congestion(
        self,
        device_id: int,
        vehicle_count: int,
        settings_cache: dict,
    ) -> None:
        """检查拥堵预警触发/解除（每帧调用）。"""
        l2 = settings_cache.get("alert_l2_threshold", 5)
        l3 = settings_cache.get("alert_l3_threshold", 10)
        l4 = settings_cache.get("alert_l4_threshold", 15)

        # 判断当前应触发等级
        if vehicle_count >= l4:
            target_level, threshold = 4, l4
        elif vehicle_count >= l3:
            target_level, threshold = 3, l3
        elif vehicle_count >= l2:
            target_level, threshold = 2, l2
        else:
            target_level, threshold = 0, 0

        now = time.monotonic()
        state = self._congestion_state.get(device_id)

        if target_level > 0:
            if state is None or state["level"] != target_level:
                # 等级变化，重置持续计时
                self._congestion_state[device_id] = {"level": target_level, "since": now}
            else:
                # 同等级持续中
                duration = now - state["since"]
                if duration >= _CONGESTION_TRIGGER_S:
                    await self._trigger_congestion(device_id, target_level, vehicle_count)
            # 如有活跃拥堵预警，重置迟滞解除计时
            active_id = self._active.get(device_id, {}).get("congestion")
            if active_id and active_id in self._hysteresis:
                del self._hysteresis[active_id]
        else:
            # 车辆数低于所有阈值
            self._congestion_state.pop(device_id, None)
            active_id = self._active.get(device_id, {}).get("congestion")
            if active_id:
                # 迟滞解除
                if active_id not in self._hysteresis:
                    self._hysteresis[active_id] = now
                elif now - self._hysteresis[active_id] >= _CONGESTION_HYSTERESIS_S:
                    await self._resolve_alert(active_id, device_id, "congestion", "auto")

    async def check_flow_zero(self, device_id: int, vehicle_count: int) -> None:
        """检查零流量预警（每帧调用，设备在线时）。"""
        now = time.monotonic()
        if vehicle_count > 0:
            # 有车辆，重置零流量计时
            self._flow_zero_since[device_id] = None
            # 如有未解除 flow_zero 预警，自动解除
            active_id = self._active.get(device_id, {}).get("flow_zero")
            if active_id:
                await self._resolve_alert(active_id, device_id, "flow_zero", "auto")
        else:
            since = self._flow_zero_since.get(device_id)
            if since is None:
                self._flow_zero_since[device_id] = now
            elif now - since >= _FLOW_ZERO_TRIGGER_S:
                await self._trigger_alert(
                    device_id=device_id,
                    alert_type="flow_zero",
                    level=2,
                    message=f"设备 {device_id} 连续 5 分钟无车辆检测",
                    vehicle_count=0,
                )

    async def on_parking_triggered(self, device_id: int, tracking_id: int, vehicle_count: int) -> None:
        """停车预警触发（由 dispatch_loop 在检测到新停车时调用）。"""
        # 为每个 tracking_id 创建独立预警（alert_type 加 tracking_id 后缀区分）
        alert_type = f"abnormal_stop_{tracking_id}"
        await self._trigger_alert(
            device_id=device_id,
            alert_type=alert_type,
            level=3,
            message=f"设备 {device_id} 检测到车辆（tracking_id={tracking_id}）异常停车超过静止时限",
            vehicle_count=vehicle_count,
        )
        self._parked_alerted.setdefault(device_id, set()).add(tracking_id)

    async def on_parking_recovered(self, device_id: int, tracking_id: int) -> None:
        """停车解除（车辆恢复移动或消失）。"""
        alert_type = f"abnormal_stop_{tracking_id}"
        active_id = self._active.get(device_id, {}).get(alert_type)
        if active_id:
            await self._resolve_alert(active_id, device_id, alert_type, "auto")
        self._parked_alerted.get(device_id, set()).discard(tracking_id)

    async def on_device_offline(self, device_id: int) -> None:
        """设备离线：触发 device_offline 预警，解除所有其他活跃预警。"""
        await self._trigger_alert(
            device_id=device_id,
            alert_type="device_offline",
            level=5,
            message=f"设备 {device_id} TCP 连接断开",
            vehicle_count=None,
        )
        # 设备离线时清理内存状态
        self._congestion_state.pop(device_id, None)
        self._flow_zero_since.pop(device_id, None)
        self._parked_alerted.pop(device_id, None)

    async def on_device_online(self, device_id: int) -> None:
        """设备重新上线：解除 device_offline 预警。"""
        active_id = self._active.get(device_id, {}).get("device_offline")
        if active_id:
            await self._resolve_alert(active_id, device_id, "device_offline", "auto")

    async def check_flow_spike(
        self, device_id: int, passed_count: int, avg_per_min: float
    ) -> None:
        """流量突增检测（每 60s 聚合后由 aggregator 调用，见设计稿 9.1 节）。

        Args:
            device_id:   设备 ID
            passed_count: 本分钟实际过线车辆总数
            avg_per_min:  历史同期每分钟均值（已由 aggregator 从 hourly_statistics 计算）
        触发条件：passed_count > avg_per_min × 3
        解除条件：passed_count < avg_per_min × 1.5
        """
        if avg_per_min <= 0:
            return

        if passed_count > avg_per_min * 3.0:
            await self._trigger_alert(
                device_id=device_id,
                alert_type="flow_spike",
                level=3,
                message=(
                    f"设备 {device_id} 本分钟过线车辆数 {passed_count} 辆，"
                    f"超过历史同期均值 {avg_per_min:.1f}/min 的 300%"
                ),
                vehicle_count=passed_count,
            )
        else:
            # 检查是否需要解除已有 flow_spike 预警
            active_id = self._active.get(device_id, {}).get("flow_spike")
            if active_id and passed_count < avg_per_min * 1.5:
                await self._resolve_alert(active_id, device_id, "flow_spike", "auto")

    # ── 内部实现 ─────────────────────────────────────────────────────────────────

    async def _trigger_congestion(
        self, device_id: int, level: int, vehicle_count: int
    ) -> None:
        level_names = {2: "二级", 3: "三级", 4: "四级"}
        threshold_map = {2: "alert_l2_threshold", 3: "alert_l3_threshold", 4: "alert_l4_threshold"}
        await self._trigger_alert(
            device_id=device_id,
            alert_type="congestion",
            level=level,
            message=f"设备 {device_id} 当前车辆数 {vehicle_count} 辆，达到{level_names.get(level, '')}拥堵预警阈值",
            vehicle_count=vehicle_count,
        )

    async def _trigger_alert(
        self,
        device_id: int,
        alert_type: str,
        level: int,
        message: str,
        vehicle_count: Optional[int],
    ) -> None:
        """写入预警到数据库，防重复，广播 WS 消息。"""
        # 防重：同设备同类型有未解除预警则跳过
        if self._active.get(device_id, {}).get(alert_type):
            return

        now = _utcnow()
        try:
            async with AsyncSessionLocal() as session:
                alert = TrafficAlert(
                    device_id=device_id,
                    level=level,
                    alert_type=alert_type,
                    message=message,
                    vehicle_count=vehicle_count,
                    triggered_at=now,
                    is_resolved=False,
                )
                session.add(alert)
                await session.commit()
                await session.refresh(alert)
                alert_id = alert.id
        except Exception as exc:
            logger.error(f"[AlertResolver] DB write failed for {alert_type}: {exc}")
            return

        self._active.setdefault(device_id, {})[alert_type] = alert_id
        logger.info(f"[AlertResolver] triggered {alert_type} L{level} device={device_id} id={alert_id}")

        # WS 广播
        try:
            from services.websocket_manager import ws_manager
            await ws_manager.push_alert_event(device_id, {
                "id": alert_id,
                "level": level,
                "alert_type": alert_type,
                "message": message,
                "vehicle_count": vehicle_count,
                "triggered_at": now.isoformat(),
            })
        except Exception as exc:
            logger.warning(f"[AlertResolver] WS push failed: {exc}")

    async def _resolve_alert(
        self,
        alert_id: int,
        device_id: int,
        alert_type: str,
        resolved_by: str,
    ) -> None:
        """更新数据库解除预警，广播 WS 消息。"""
        now = _utcnow()
        try:
            from sqlalchemy import select
            async with AsyncSessionLocal() as session:
                from models import TrafficAlert as TA
                result = await session.execute(select(TA).where(TA.id == alert_id))
                alert = result.scalar_one_or_none()
                if alert is None:
                    return
                alert.is_resolved = True
                alert.resolved_at = now
                alert.resolved_by = resolved_by
                alert.duration_seconds = int((now - alert.triggered_at).total_seconds())
                await session.commit()
        except Exception as exc:
            logger.error(f"[AlertResolver] resolve DB failed alert_id={alert_id}: {exc}")
            return

        # 从内存活跃表移除
        if self._active.get(device_id, {}).get(alert_type) == alert_id:
            del self._active[device_id][alert_type]
        self._hysteresis.pop(alert_id, None)

        logger.info(f"[AlertResolver] resolved {alert_type} L? device={device_id} id={alert_id} by={resolved_by}")

        # WS 广播
        try:
            from services.websocket_manager import ws_manager
            await ws_manager.push_alert_resolved(device_id, {
                "id": alert_id,
                "alert_type": alert_type,
                "resolved_at": now.isoformat(),
                "resolved_by": resolved_by,
            })
        except Exception as exc:
            logger.warning(f"[AlertResolver] WS push resolve failed: {exc}")


# 全局单例
alert_resolver = AlertResolver()
