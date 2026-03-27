"""WebSocket 连接管理器（全局单例）。

从 routers/ws.py 抽出，放在 services/ 层，避免 alert_resolver 反向引用 routers 造成循环导入。
routers/ws.py 改为从此模块导入 ws_manager。
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    """管理所有前端 WebSocket 连接，按 device_id 分组。"""

    def __init__(self) -> None:
        self._stream: dict[int, list[WebSocket]] = {}
        self._health: list[WebSocket] = []

    # ── stream 连接管理 ───────────────────────────────────────────────────────────

    async def connect_stream(self, device_id: int, ws: WebSocket) -> None:
        await ws.accept()
        self._stream.setdefault(device_id, []).append(ws)
        logger.debug(f"[WSManager] stream connected device_id={device_id}")

    def disconnect_stream(self, device_id: int, ws: WebSocket) -> None:
        conns = self._stream.get(device_id, [])
        if ws in conns:
            conns.remove(ws)

    async def broadcast_stream(self, device_id: int, data: dict) -> None:
        """向订阅该设备的所有前端推送帧数据。"""
        dead: list[WebSocket] = []
        for ws in list(self._stream.get(device_id, [])):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_stream(device_id, ws)

    async def broadcast_all_streams(self, data: dict) -> None:
        """向所有在线 stream 连接广播（预警/系统级消息用）。"""
        for device_id in list(self._stream.keys()):
            await self.broadcast_stream(device_id, data)

    # ── health 连接管理 ───────────────────────────────────────────────────────────

    async def connect_health(self, ws: WebSocket) -> None:
        await ws.accept()
        self._health.append(ws)

    def disconnect_health(self, ws: WebSocket) -> None:
        if ws in self._health:
            self._health.remove(ws)

    async def broadcast_health(self, data: dict) -> None:
        dead: list[WebSocket] = []
        for ws in list(self._health):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_health(ws)

    # ── 业务消息推送 ──────────────────────────────────────────────────────────────

    async def push_alert_event(self, device_id: int, alert: dict, is_new: bool = True) -> None:
        """推送预警触发通知（见设计稿 5.2 节 alert_event 消息格式）。"""
        msg = {
            "type": "alert_event",
            "device_id": device_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "alert": {**alert, "is_new": is_new},
        }
        await self.broadcast_stream(device_id, msg)

    async def push_alert_resolved(self, device_id: int, alert: dict) -> None:
        """推送预警解除通知（见设计稿 5.2 节 alert_resolved 消息格式）。"""
        msg = {
            "type": "alert_resolved",
            "device_id": device_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "alert": alert,
        }
        await self.broadcast_stream(device_id, msg)

    async def push_device_offline(self, device_id: int, reason: str) -> None:
        """推送设备离线通知（见设计稿 5.2 节 device_offline 消息格式）。"""
        msg = {
            "type": "device_offline",
            "device_id": device_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "reason": reason,
        }
        await self.broadcast_stream(device_id, msg)


# 全局单例
ws_manager = WebSocketManager()
