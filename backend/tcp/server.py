"""asyncio TCP Server（见设计稿第 10.3、12.3 节）。

职责：
- 监听 TCP_HOST:TCP_PORT
- 通过远端 IP 查询数据库，确定 device_id（未注册 IP 直接断开）
- 调用 PipelineManager.on_device_connected / on_device_disconnected 管理 Pipeline 生命周期
- 读取帧 → 令牌桶限流 → 写入 raw_queue（满则丢帧）
- 处理心跳（回 ACK）和版本上报
- 记录 connection_session 和 system_logs
"""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone

from sqlalchemy import select

from database import AsyncSessionLocal
from models import ConnectionSession, Device, SystemLog
from tcp.protocol import ACK_HEARTBEAT, FrameParseError, FrameType, read_frame

logger = logging.getLogger(__name__)

# 60 秒内无任何帧（包括心跳）则判定超时断开
HEARTBEAT_TIMEOUT = 60.0


class TCPServer:
    """asyncio TCP Server，单例，由 main.py lifespan 启动/关闭。"""

    def __init__(self, host: str, port: int) -> None:
        self._host = host
        self._port = port
        self._server: asyncio.Server | None = None
        self._pipeline_manager = None  # 延迟注入，避免循环导入

    def set_pipeline_manager(self, manager) -> None:
        self._pipeline_manager = manager

    async def start(self) -> None:
        self._server = await asyncio.start_server(
            self._handle_client,
            self._host,
            self._port,
        )
        logger.info(f"[TCPServer] listening on {self._host}:{self._port}")

    async def stop(self) -> None:
        if self._server:
            self._server.close()
            await self._server.wait_closed()
            logger.info("[TCPServer] stopped")

    async def _lookup_device(self, remote_ip: str) -> int | None:
        """查询数据库，返回 device_id（未注册返回 None）。"""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Device).where(Device.ip_address == remote_ip)
            )
            device = result.scalar_one_or_none()
            return device.id if device is not None else None

    async def _write_log(self, event_type: str, message: str, device_id: int | None = None) -> None:
        async with AsyncSessionLocal() as session:
            session.add(SystemLog(
                device_id=device_id,
                event_type=event_type,
                message=message,
                created_at=datetime.now(timezone.utc).replace(tzinfo=None),
            ))
            await session.commit()

    async def _save_session(
        self,
        device_id: int,
        connected_at: datetime,
        frames_received: int,
        reason: str,
    ) -> None:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        async with AsyncSessionLocal() as session:
            session.add(ConnectionSession(
                device_id=device_id,
                connected_at=connected_at,
                disconnected_at=now,
                duration_seconds=int((now - connected_at).total_seconds()),
                frames_received=frames_received,
                disconnect_reason=reason,
            ))
            await session.commit()

    async def _handle_client(
        self,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
    ) -> None:
        peername = writer.get_extra_info("peername")
        remote_ip = peername[0] if peername else "unknown"
        logger.info(f"[TCPServer] new connection from {remote_ip}")

        device_id = await self._lookup_device(remote_ip)
        if device_id is None:
            await self._write_log("warning", f"未知设备尝试连接（IP: {remote_ip}），已拒绝")
            logger.warning(f"[TCPServer] unknown device {remote_ip}, closing")
            writer.close()
            return

        connected_at = datetime.now(timezone.utc).replace(tzinfo=None)
        frames_received = 0
        disconnect_reason = "normal"

        await self._write_log("connected", f"设备 {device_id} TCP 连接建立（IP: {remote_ip}）", device_id)

        if self._pipeline_manager:
            await self._pipeline_manager.on_device_connected(device_id, remote_ip)

        # 设备上线：解除 device_offline 预警
        from services.alert_resolver import alert_resolver
        await alert_resolver.on_device_online(device_id)

        ctx = self._pipeline_manager.get_context(device_id) if self._pipeline_manager else None

        try:
            while True:
                try:
                    frame_type, payload = await asyncio.wait_for(
                        read_frame(reader), timeout=HEARTBEAT_TIMEOUT
                    )
                except asyncio.TimeoutError:
                    logger.warning(f"[TCPServer] device {device_id} heartbeat timeout")
                    disconnect_reason = "timeout"
                    break

                if frame_type == FrameType.HEARTBEAT:
                    writer.write(ACK_HEARTBEAT)
                    await writer.drain()

                elif frame_type == FrameType.VERSION:
                    version_str = payload.decode("ascii", errors="replace")
                    logger.info(f"[TCPServer] device {device_id} firmware version: {version_str}")
                    await self._write_log(
                        "info",
                        f"设备 {device_id} 固件版本上报：{version_str}",
                        device_id,
                    )

                elif frame_type == FrameType.IMAGE:
                    frames_received += 1
                    if ctx is None:
                        continue

                    # 读取热缓存配置中的 fps_limit
                    fps_limit = ctx.settings_cache.get("fps_limit", 30)

                    # 令牌桶限流
                    if not ctx.consume_token(fps_limit):
                        continue  # 丢帧

                    # raw_queue 满则丢帧（非阻塞入队）
                    try:
                        ctx.raw_queue.put_nowait(payload)
                    except asyncio.QueueFull:
                        ctx.stats.dropped_frames += 1

        except EOFError:
            disconnect_reason = "normal"
        except FrameParseError as exc:
            logger.error(f"[TCPServer] device {device_id} frame parse error: {exc}")
            disconnect_reason = "error"
        except Exception as exc:
            logger.exception(f"[TCPServer] device {device_id} unexpected error: {exc}")
            disconnect_reason = "error"
        finally:
            writer.close()
            await self._write_log(
                "disconnected",
                f"设备 {device_id} TCP 连接断开（原因: {disconnect_reason}，收帧: {frames_received}）",
                device_id,
            )
            await self._save_session(device_id, connected_at, frames_received, disconnect_reason)
            if self._pipeline_manager:
                await self._pipeline_manager.on_device_disconnected(device_id)
            # 设备离线：触发 device_offline 预警，广播 WS 离线通知
            from services.alert_resolver import alert_resolver
            from services.websocket_manager import ws_manager
            await alert_resolver.on_device_offline(device_id)
            await ws_manager.push_device_offline(device_id, disconnect_reason)
            logger.info(f"[TCPServer] device {device_id} disconnected ({disconnect_reason})")
