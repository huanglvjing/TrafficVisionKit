/** REST API 请求/响应类型（与后端 Pydantic Schema 一一对应）*/

// ── 认证 ──────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  username: string
  password: string
}

export interface UserInfo {
  id: number
  username: string
  full_name: string
  role: 'admin' | 'operator'
  email: string | null
  is_active: boolean
  last_login_at?: string | null
}

export interface TokenResponse {
  access_token: string
  refresh_token?: string | null
  token_type?: string
  expires_in?: number
  user: UserInfo
}

// ── 设备 ──────────────────────────────────────────────────────────────────────

export interface DeviceCreate {
  name: string
  ip_address: string
  location: string
}

export interface DeviceDetail {
  id: number
  name: string
  ip_address: string
  location: string
  is_active: boolean
  last_seen_at: string | null
  total_frames: number
  firmware_version: string | null
  created_at: string
  updated_at: string
}

export interface DeviceSettingsRead {
  id: number
  device_id: number
  line_y: number
  confidence: number
  resolution_w: number
  resolution_h: number
  fps_limit: number
  alert_l2_threshold: number
  alert_l3_threshold: number
  alert_l4_threshold: number
  park_timeout_seconds: number
  calibration_px_per_meter: number | null
  speed_limit_kmh: number
  allowed_direction: 'up' | 'down' | 'both'
  roi_x1: number
  roi_y1: number
  roi_x2: number
  roi_y2: number
  updated_at: string
}

export interface DeviceSettingsUpdate {
  line_y?: number
  confidence?: number
  fps_limit?: number
  alert_l2_threshold?: number
  alert_l3_threshold?: number
  alert_l4_threshold?: number
  park_timeout_seconds?: number
  calibration_px_per_meter?: number
  speed_limit_kmh?: number
  allowed_direction?: 'up' | 'down' | 'both'
  roi_x1?: number
  roi_y1?: number
  roi_x2?: number
  roi_y2?: number
}

// ── 历史数据 ──────────────────────────────────────────────────────────────────

export interface TrafficRecordItem {
  id: number
  device_id: number
  recorded_at: string
  avg_count: number
  max_count: number
  passed_count: number
  passed_in_count: number
  passed_out_count: number
  car_count: number | null
  truck_count: number | null
  bus_count: number | null
  avg_occupancy: number | null
  avg_speed_kmh: number | null
  max_speed_kmh: number | null
  speed_violation_count: number | null
  avg_headway_sec: number | null
  min_headway_sec: number | null
  queue_length: number | null
  los_grade: string | null
  wrong_way_count: number | null
  created_at: string
}

export interface HourlyStatisticsItem {
  id: number
  device_id: number
  hour_at: string
  total_passed: number
  avg_count: number
  peak_count: number
  alert_count: number
  avg_speed_kmh: number | null
  avg_occupancy: number | null
  peak_occupancy: number | null
  speed_violation_count: number | null
  wrong_way_count: number | null
  created_at: string
}

export interface AlertRecord {
  id: number
  device_id: number
  level: number
  alert_type: string
  message: string
  vehicle_count: number | null
  triggered_at: string
  resolved_at: string | null
  duration_seconds: number | null
  is_resolved: boolean
  resolved_by: string | null
}

export interface AlertListResponse {
  total: number
  page: number
  page_size: number
  items: AlertRecord[]
}

export interface HeatmapResponse {
  rows: string[]
  data: number[][]
}

export interface SessionRecord {
  id: number
  device_id: number
  connected_at: string
  disconnected_at: string | null
  duration_seconds: number | null
  frames_received: number
  disconnect_reason: string | null
}

export interface SessionListResponse {
  total: number
  page: number
  page_size: number
  items: SessionRecord[]
}

// ── 系统 & 用户 ───────────────────────────────────────────────────────────────

export interface SystemLogItem {
  id: number
  device_id: number | null
  event_type: string
  message: string
  operator_ip: string | null
  created_at: string
}

export interface SystemLogListResponse {
  total: number
  page: number
  page_size: number
  items: SystemLogItem[]
}

export interface UserCreate {
  username: string
  password: string
  full_name: string
  email?: string
  role: 'admin' | 'operator'
}

export interface UserUpdate {
  full_name?: string
  email?: string
  role?: 'admin' | 'operator'
  is_active?: boolean
}

export interface UserListResponse {
  total: number
  page: number
  page_size: number
  items: UserInfo[]
}

// ── 错误响应 ──────────────────────────────────────────────────────────────────

export interface ApiError {
  code: number
  message: string
  detail?: string
  locked_until?: string
}
