from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from models.base import Base


class ConnectionSession(Base):
    """TCP 连接会话表（4.6 节）。保留90天。"""

    __tablename__ = "connection_sessions"
    __table_args__ = (
        Index("idx_device_connected", "device_id", "connected_at"),
        {
            "mysql_engine": "InnoDB",
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
        },
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    device_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("devices.id", name="fk_cs_device"),
        nullable=False,
    )
    connected_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    disconnected_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, nullable=True
    )
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    frames_received: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    # timeout / reset / error / normal
    disconnect_reason: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )
