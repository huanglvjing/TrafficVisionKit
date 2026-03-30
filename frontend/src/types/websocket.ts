/** WebSocket 消息类型（见设计稿 5.2 节）*/

// ── stream_frame ──────────────────────────────────────────────────────────────

export interface VehicleDetection {
  tracking_id: number
  class_id: number
  class_name: string
  confidence: number
  bbox: [number, number, number, number]
  is_parked: boolean
  is_wrong_way: boolean
  speed_kmh: number | null
}

export interface FrameData {
  data: string       // base64 JPEG
  width: number
  height: number
  seq: number
}

export interface DetectionData {
  vehicle_count: number
  passed_count: number
  passed_in_count: number
  passed_out_count: number
  alert_level: number
  vehicles: VehicleDetection[]
  line_y: number
  inference_ms: number
  // 0002 新增实时指标
  occupancy: number
  los_grade: string
  avg_speed_kmh: number | null
  avg_headway_sec: number | null
  min_headway_sec: number | null
  queue_length: number
  wrong_way_active: boolean
  speed_calibrated: boolean
}

export interface StreamFrameMsg {
  type: 'stream_frame'
  device_id: number
  timestamp: string
  frame: FrameData
  detection: DetectionData
}

// ── alert_event ───────────────────────────────────────────────────────────────

export interface AlertEventPayload {
  id: number
  level: number
  alert_type: string
  message: string
  vehicle_count: number | null
  triggered_at: string
  is_new: boolean
}

export interface AlertEventMsg {
  type: 'alert_event'
  device_id: number
  timestamp: string
  alert: AlertEventPayload
}

// ── alert_resolved ────────────────────────────────────────────────────────────

export interface AlertResolvedPayload {
  id: number
  level: number
  alert_type: string
  resolved_at: string
  duration_seconds: number
  resolved_by: string
}

export interface AlertResolvedMsg {
  type: 'alert_resolved'
  device_id: number
  timestamp: string
  alert: AlertResolvedPayload
}

// ── device_offline ────────────────────────────────────────────────────────────

export interface DeviceOfflineMsg {
  type: 'device_offline'
  device_id: number
  timestamp: string
  reason: string
}

// ── token_expiring ────────────────────────────────────────────────────────────

export interface TokenExpiringMsg {
  type: 'token_expiring'
  expires_in: number
}

// ── ping / pong ───────────────────────────────────────────────────────────────

export interface PingMsg {
  type: 'ping'
  timestamp: string
}

export interface PongMsg {
  type: 'pong'
  timestamp: string
}

// ── health_report ─────────────────────────────────────────────────────────────

export interface ServerStats {
  cpu_percent: number
  memory_percent: number
  gpu_percent: number | null
  gpu_memory_used_mb: number | null
  uptime_seconds: number
}

export interface DeviceHealthStats {
  device_id: number
  is_active: boolean
  fps: number
  raw_queue_size: number
  ws_queue_size: number
  db_queue_size: number
  dropped_frames: number
  avg_inference_ms: number
  vehicle_count: number
  alert_level: number
  degradation_level: number
}

export interface HealthReportMsg {
  type: 'health_report'
  timestamp: string
  server: ServerStats
  devices: DeviceHealthStats[]
}

// ── 联合类型 ──────────────────────────────────────────────────────────────────

export type StreamMsg =
  | StreamFrameMsg
  | AlertEventMsg
  | AlertResolvedMsg
  | DeviceOfflineMsg
  | TokenExpiringMsg
  | PongMsg
