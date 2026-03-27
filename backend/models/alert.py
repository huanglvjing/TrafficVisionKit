from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from models.base import Base


class TrafficAlert(Base):
    """预警记录表（4.5 节）。保留180天。"""

    __tablename__ = "traffic_alerts"
    __table_args__ = (
        Index("idx_device_triggered", "device_id", "triggered_at"),
        Index("idx_unresolved", "is_resolved", "triggered_at"),
        {
            "mysql_engine": "InnoDB",
            "mysql_charset": "utf8mb4",
            "mysql_collate": "utf8mb4_unicode_ci",
        },
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    device_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("devices.id", name="fk_ta_device"),
        nullable=False,
    )
    # 1~5 预警等级；设计稿 4.5 节指定 TINYINT，用 SmallInteger 兼容
    level: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    # congestion / abnormal_stop / flow_spike / flow_zero / device_offline
    alert_type: Mapped[str] = mapped_column(String(30), nullable=False)
    message: Mapped[str] = mapped_column(String(200), nullable=False)
    vehicle_count: Mapped[Optional[int]] = mapped_column(SmallInteger, nullable=True)
    triggered_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    # 解除时计算写入
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_resolved: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="0"
    )
    # auto / manual / timeout
    resolved_by: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
