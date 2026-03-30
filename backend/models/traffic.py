from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    CHAR,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    SmallInteger,
    String,
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
    """分钟聚合流量表。每60秒写入一条。保留90天。"""

    __tablename__ = "traffic_records"
    __table_args__ = (
        Index("idx_recorded", "recorded_at"),
        Index("idx_device_recorded", "device_id", "recorded_at"),
        _TABLE_OPTS,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    device_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("devices.id", name="fk_tr_device"), nullable=False
    )
    recorded_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    avg_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default="0")
    max_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default="0")
    passed_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    passed_in_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    passed_out_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    car_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    truck_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    bus_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # ── 0002 迁移新增字段（全部允许 NULL，老数据不受影响）────────────────────
    avg_occupancy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_speed_kmh: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    max_speed_kmh: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    speed_violation_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    avg_headway_sec: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    min_headway_sec: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    queue_length: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    los_grade: Mapped[Optional[str]] = mapped_column(CHAR(1), nullable=True)
    wrong_way_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )


class HourlyStatistics(Base):
    """小时聚合表。每3600秒从 traffic_records 聚合写入。永久保留。"""

    __tablename__ = "hourly_statistics"
    __table_args__ = (
        UniqueConstraint("device_id", "hour_at", name="uk_device_hour"),
        _TABLE_OPTS,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    device_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("devices.id", name="fk_hs_device"), nullable=False
    )
    hour_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    total_passed: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    avg_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default="0")
    peak_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default="0")
    alert_count: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default="0")
    # ── 0002 迁移新增 ─────────────────────────────────────────────────────────
    avg_speed_kmh: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_occupancy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    peak_occupancy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    speed_violation_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    wrong_way_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )


class SpeedEvent(Base):
    """超速事件明细表（0002 新增）。保留90天。"""

    __tablename__ = "speed_events"
    __table_args__ = (
        Index("idx_se_device_occurred", "device_id", "occurred_at"),
        _TABLE_OPTS,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    device_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("devices.id", name="fk_se_device"), nullable=False
    )
    tracking_id: Mapped[int] = mapped_column(Integer, nullable=False)
    speed_kmh: Mapped[float] = mapped_column(Float, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    bbox_snapshot: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class TrajectoryHeatmapSnapshot(Base):
    """轨迹热力图快照表（0002 新增）。每10分钟一条。"""

    __tablename__ = "trajectory_heatmap_snapshots"
    __table_args__ = (
        Index("idx_ths_device_snap", "device_id", "snapshot_at"),
        _TABLE_OPTS,
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    device_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("devices.id", name="fk_ths_device"), nullable=False
    )
    snapshot_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    heatmap_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
