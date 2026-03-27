from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from models.base import Base

_TABLE_OPTS = {
    "mysql_engine": "InnoDB",
    "mysql_charset": "utf8mb4",
    "mysql_collate": "utf8mb4_unicode_ci",
}


class TrafficRecord(Base):
    """分钟聚合流量表（4.3 节）。每60秒写入一条。保留90天。"""

    __tablename__ = "traffic_records"
    __table_args__ = (
        Index("idx_recorded", "recorded_at"),
        Index("idx_device_recorded", "device_id", "recorded_at"),
        _TABLE_OPTS,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    device_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("devices.id", name="fk_tr_device"),
        nullable=False,
    )
    # 精确到分钟
    recorded_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    avg_count: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="0"
    )
    max_count: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="0"
    )
    # 双向合计 = passed_in_count + passed_out_count
    passed_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    # 向下穿越（进入方向）
    passed_in_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    # 向上穿越（驶出方向）
    passed_out_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    # 车型细分（预留，来自 YOLO class 分类）
    car_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    truck_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    bus_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )


class HourlyStatistics(Base):
    """小时聚合表（4.4 节）。每3600秒从 traffic_records 聚合写入。永久保留。"""

    __tablename__ = "hourly_statistics"
    __table_args__ = (
        UniqueConstraint("device_id", "hour_at", name="uk_device_hour"),
        _TABLE_OPTS,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    device_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("devices.id", name="fk_hs_device"),
        nullable=False,
    )
    # 精确到小时，如 2026-03-25 14:00:00
    hour_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    total_passed: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    avg_count: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="0"
    )
    peak_count: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="0"
    )
    # 用 SMALLINT 而非 TINYINT，避免高频预警场景溢出（设计稿 4.4 节说明）
    alert_count: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="0"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
