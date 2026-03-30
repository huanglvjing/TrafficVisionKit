"""历史数据查询相关 Schema（流量、告警、会话、热力图）。"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── TrafficRecord ────────────────────────────────────────────────────────────────

class TrafficRecordResponse(BaseModel):
    id: int
    device_id: int
    recorded_at: datetime
    avg_count: int
    max_count: int
    passed_count: int
    passed_in_count: int
    passed_out_count: int
    avg_occupancy: Optional[float]
    avg_speed_kmh: Optional[float]
    max_speed_kmh: Optional[float]
    speed_violation_count: Optional[int]
    avg_headway_sec: Optional[float]
    min_headway_sec: Optional[float]
    queue_length: Optional[int]
    los_grade: Optional[str]
    wrong_way_count: Optional[int]

    model_config = {"from_attributes": True}


# ── HourlyStatistics ─────────────────────────────────────────────────────────────

class HourlyStatisticsResponse(BaseModel):
    id: int
    device_id: int
    hour_at: datetime
    total_passed: int
    avg_count: int
    peak_count: int
    alert_count: int
    avg_speed_kmh: Optional[float]
    avg_occupancy: Optional[float]
    peak_occupancy: Optional[float]
    speed_violation_count: Optional[int]
    wrong_way_count: Optional[int]

    model_config = {"from_attributes": True}


# ── TrafficAlert ─────────────────────────────────────────────────────────────────

class AlertResponse(BaseModel):
    id: int
    device_id: int
    alert_type: str
    level: int
    message: str
    vehicle_count: Optional[int]
    triggered_at: datetime
    resolved_at: Optional[datetime]
    duration_seconds: Optional[int]
    is_resolved: bool
    resolved_by: Optional[str]

    model_config = {"from_attributes": True}


class AlertListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[AlertResponse]


class AlertResolveRequest(BaseModel):
    resolved_by: str = Field(default="manual", pattern=r"^(manual|auto|timeout)$")


# ── ConnectionSession ────────────────────────────────────────────────────────────

class SessionResponse(BaseModel):
    id: int
    device_id: int
    connected_at: datetime
    disconnected_at: Optional[datetime]
    duration_seconds: Optional[int]
    frames_received: int
    disconnect_reason: Optional[str]

    model_config = {"from_attributes": True}


class SessionListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[SessionResponse]


# ── 热力图 ────────────────────────────────────────────────────────────────────────

class HeatmapResponse(BaseModel):
    rows: list[str] = Field(description="行标签，周一到周日：['Mon','Tue','Wed','Thu','Fri','Sat','Sun']")
    data: list[list[float]] = Field(description="7x24 矩阵，单元格为该小时 total_passed 均值")
