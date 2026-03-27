"""WebSocket 路由（Phase 6 完整版）。

路径：
  /ws/stream/{device_id}  — 实时视频帧 + 检测结果（见设计稿 5.2 节）
  /ws/health              — 服务端全局健康数据（每秒由 health_reporter 广播）

鉴权：URL query 参数 ?token=<access_token>，握手阶段验证，失败发送 close code 4401。

stream 连接额外功能：
  - ping/pong 心跳（双向，前端每 30s 发一次）
  - token_expiring 通知：Token 有效期剩余 ≤5 分钟时主动推送（每连接只推一次）
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from core.security import decode_access_token
from services.websocket_manager import ws_manager

router = APIRouter(tags=["websocket"])

# Token 即将过期提醒的提前量（秒）
_TOKEN_EXPIRY_WARN_BEFORE_S = 300  # 5 分钟
# 过期检查间隔（秒）
_TOKEN_CHECK_INTERVAL_S = 30


def _verify_ws_token(token: str | None) -> dict | None:
    """解码 WS token，无效/过期返回 None。"""
    if not token:
        return None
    return decode_access_token(token)


async def _token_expiry_loop(websocket: WebSocket, payload: dict) -> None:
    """每 30 秒检查一次 Token 有效期，剩余 ≤5 分钟时推送 token_expiring（只推一次）。

    见设计稿 6.4 节：服务端在 Token 有效期剩余 5 分钟时下发通知，
    前端在后台静默刷新后主动断连并用新 Token 重连。
    """
    warned = False
    try:
        while True:
            await asyncio.sleep(_TOKEN_CHECK_INTERVAL_S)
            remaining = payload.get("exp", 0) - datetime.now(timezone.utc).timestamp()
            if remaining <= _TOKEN_EXPIRY_WARN_BEFORE_S and not warned:
                warned = True
                try:
                    await websocket.send_json({
                        "type": "token_expiring",
                        "expires_in": int(max(remaining, 0)),
                    })
                except Exception:
                    break
    except asyncio.CancelledError:
        pass


# ── /ws/stream/{device_id} ────────────────────────────────────────────────────

@router.websocket("/ws/stream/{device_id}")
async def ws_stream(
    websocket: WebSocket,
    device_id: int,
    token: str | None = Query(default=None),
) -> None:
    """实时视频帧 + 检测结果推送。

    帧数据由 ws_push_loop 通过 ws_manager.broadcast_stream() 广播，
    本路由只负责：鉴权握手、ping/pong 心跳、token_expiring 通知。
    """
    payload = _verify_ws_token(token)
    if not payload:
        await websocket.close(code=4401)
        return

    await ws_manager.connect_stream(device_id, websocket)

    # Token 即将过期通知（后台协程，连接断开时取消）
    expiry_task = asyncio.create_task(
        _token_expiry_loop(websocket, payload),
        name=f"token_expiry_{device_id}",
    )

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
        expiry_task.cancel()
        ws_manager.disconnect_stream(device_id, websocket)


# ── /ws/health ────────────────────────────────────────────────────────────────

@router.websocket("/ws/health")
async def ws_health(
    websocket: WebSocket,
    token: str | None = Query(default=None),
) -> None:
    """服务端全局健康数据订阅。

    health_report 由 services/health_reporter.py 每秒广播，
    本路由只负责：鉴权握手、ping/pong 心跳、连接注册/注销。
    """
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
