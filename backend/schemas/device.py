"""设备管理相关 Schema。"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Device ──────────────────────────────────────────────────────────────────────

class DeviceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    ip_address: str = Field(..., pattern=r"^\d{1,3}(\.\d{1,3}){3}$")
    location: str = Field(..., min_length=1, max_length=100)


class DeviceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=50)
    location: Optional[str] = Field(default=None, min_length=1, max_length=100)


class DeviceResponse(BaseModel):
    id: int
    name: str
    ip_address: str
    location: str
    is_active: bool
    last_seen_at: Optional[datetime]
    total_frames: int
    firmware_version: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── DeviceSettings ───────────────────────────────────────────────────────────────

class DeviceSettingsUpdate(BaseModel):
    line_y: Optional[int] = Field(default=None, ge=0, le=4096)
    confidence: Optional[float] = Field(default=None, ge=0.1, le=0.9)
    resolution_w: Optional[int] = Field(default=None, ge=160, le=3840)
    resolution_h: Optional[int] = Field(default=None, ge=120, le=2160)
    fps_limit: Optional[int] = Field(default=None, ge=1, le=60)
    alert_l2_threshold: Optional[int] = Field(default=None, ge=1, le=100)
    alert_l3_threshold: Optional[int] = Field(default=None, ge=1, le=100)
    alert_l4_threshold: Optional[int] = Field(default=None, ge=1, le=100)
    park_timeout_seconds: Optional[int] = Field(default=None, ge=5, le=3600)
    # 0002 新增
    calibration_px_per_meter: Optional[float] = Field(default=None, gt=0)
    speed_limit_kmh: Optional[int] = Field(default=None, ge=10, le=200)
    allowed_direction: Optional[str] = Field(default=None, pattern=r"^(up|down|both)$")
    roi_x1: Optional[int] = Field(default=None, ge=0, le=3840)
    roi_y1: Optional[int] = Field(default=None, ge=0, le=2160)
    roi_x2: Optional[int] = Field(default=None, ge=0, le=3840)
    roi_y2: Optional[int] = Field(default=None, ge=0, le=2160)


class DeviceSettingsResponse(BaseModel):
    id: int
    device_id: int
    line_y: int
    confidence: float
    resolution_w: int
    resolution_h: int
    fps_limit: int
    alert_l2_threshold: int
    alert_l3_threshold: int
    alert_l4_threshold: int
    park_timeout_seconds: int
    calibration_px_per_meter: Optional[float]
    speed_limit_kmh: int
    allowed_direction: str
    roi_x1: int
    roi_y1: int
    roi_x2: int
    roi_y2: int
    updated_at: datetime

    model_config = {"from_attributes": True}
