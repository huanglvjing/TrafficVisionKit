"""WebSocket 路由（Phase 4 更新：ws_manager 移至 services/websocket_manager.py）。

路径：
  /ws/stream/{device_id}  — 实时视频帧 + 检测结果（见设计稿 5.2 节）
  /ws/health              — 服务端全局健康数据（每秒广播）
"""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from core.security import decode_access_token
from services.websocket_manager import ws_manager

router = APIRouter(tags=["websocket"])


def _verify_ws_token(token: str | None) -> dict | None:
    if not token:
        return None
    return decode_access_token(token)


@router.websocket("/ws/stream/{device_id}")
async def ws_stream(
    websocket: WebSocket,
    device_id: int,
    token: str | None = Query(default=None),
) -> None:
    """实时视频帧 + 检测结果推送，URL query 参数 ?token=<access_token> 鉴权。"""
    if not _verify_ws_token(token):
        await websocket.close(code=4401)
        return

    await ws_manager.connect_stream(device_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if msg.get("type") == "ping":
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect_stream(device_id, websocket)


@router.websocket("/ws/health")
async def ws_health(
    websocket: WebSocket,
    token: str | None = Query(default=None),
) -> None:
    """服务端全局健康数据推送，每秒广播一次 health_report。"""
    if not _verify_ws_token(token):
        await websocket.close(code=4401)
        return

    await ws_manager.connect_health(websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if msg.get("type") == "ping":
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect_health(websocket)
