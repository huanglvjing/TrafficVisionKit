from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
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


class Device(Base):
    """设备主表（4.1 节）。"""

    __tablename__ = "devices"
    __table_args__ = (
        UniqueConstraint("ip_address", name="uk_ip"),
        _TABLE_OPTS,
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    # STM32 固定 IP，作为设备识别依据
    ip_address: Mapped[str] = mapped_column(String(20), nullable=False)
    location: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="0"
    )
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    total_frames: Mapped[int] = mapped_column(
        BigInteger, nullable=False, server_default="0"
    )
    firmware_version: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )


class DeviceSettings(Base):
    """设备配置表（4.2 节）。每台设备对应一条记录，一对一关系。"""

    __tablename__ = "device_settings"
    __table_args__ = (
        UniqueConstraint("device_id", name="uk_device"),
        _TABLE_OPTS,
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("devices.id", name="fk_ds_device"),
        nullable=False,
    )
    # 虚拟计数线 Y 坐标（像素），默认图像竖向中点
    line_y: Mapped[int] = mapped_column(Integer, nullable=False, server_default="240")
    # YOLO 置信度阈值，范围 0.1~0.9
    confidence: Mapped[float] = mapped_column(
        Float, nullable=False, server_default="0.5"
    )
    resolution_w: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="640"
    )
    resolution_h: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="480"
    )
    # fps_limit：服务端入队帧率上限（令牌桶限流用）
    fps_limit: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="30"
    )
    alert_l2_threshold: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="5"
    )
    alert_l3_threshold: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="10"
    )
    alert_l4_threshold: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="15"
    )
    # 异常停车判定静止秒数
    park_timeout_seconds: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="30"
    )
    # ── 0002 迁移新增字段 ─────────────────────────────────────────────────────
    # 速度标定系数（像素/米），NULL 表示未标定
    calibration_px_per_meter: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # 超速阈值（km/h）
    speed_limit_kmh: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="60"
    )
    # 允许行驶方向（用于逆行检测）
    allowed_direction: Mapped[str] = mapped_column(
        Enum("up", "down", "both", name="direction_enum"),
        nullable=False,
        server_default="both",
    )
    # ROI 矩形坐标（像素空间，默认覆盖全帧）
    roi_x1: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default="0")
    roi_y1: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default="0")
    roi_x2: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default="640")
    roi_y2: Mapped[int] = mapped_column(SmallInteger, nullable=False, server_default="480")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )
