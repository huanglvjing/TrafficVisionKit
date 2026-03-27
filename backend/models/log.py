from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from models.base import Base


class SystemLog(Base):
    """系统日志表（4.7 节）。保留30天，每日凌晨3:00清理。"""

    __tablename__ = "system_logs"
    __table_args__ = (
        Index("idx_sl_created", "created_at"),
        Index("idx_sl_device_event", "device_id", "event_type"),
        {
            "mysql_engine": "InnoDB",
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
        },
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    # NULL 表示系统级日志（非设备相关）
    device_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("devices.id", name="fk_sl_device"),
        nullable=True,
    )
    # connected/disconnected/error/warning/info/
    # user_login/user_failed_login/user_password_change/settings_changed
    event_type: Mapped[str] = mapped_column(String(20), nullable=False)
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    # 用户操作类日志携带来源 IP（IPv6 最长 45 字符）
    operator_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
