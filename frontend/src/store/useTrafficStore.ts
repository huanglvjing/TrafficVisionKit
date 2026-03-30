import { create } from 'zustand'
import type { AlertItem, TimeSeriesPoint } from '@/types/models'
import type { DetectionData, VehicleDetection } from '@/types/websocket'

const DEFAULT_DEVICE_ID =
  Number(import.meta.env['VITE_DEFAULT_DEVICE_ID'] ?? '1') || 1

const MAX_HISTORY_POINTS = 60
const CHART_SAMPLE_INTERVAL_MS = 1000
const TRACK_HISTORY_MAX_FRAMES = 30
const TRACK_EXPIRE_MS = 3000

// ── 轨迹点 ────────────────────────────────────────────────────────────────────
export interface TrackPoint {
  cx: number   // 画布坐标（0.5 缩放后）
  cy: number
  ts: number   // Date.now()
}

// ── Store 接口 ─────────────────────────────────────────────────────────────────
interface TrafficState {
  // 视频帧
  currentFrame: string | null
  frameWidth: number
  frameHeight: number
  // 基础检测统计
  vehicleCount: number
  passedCount: number
  passedInCount: number
  passedOutCount: number
  alertLevel: number
  lineY: number
  inferenceMs: number
  vehicles: VehicleDetection[]
  activeAlerts: AlertItem[]
  realtimeHistory: TimeSeriesPoint[]
  // 0002 新增指标
  occupancy: number
  losGrade: string
  avgSpeedKmh: number | null
  avgHeadwaySec: number | null
  queueLength: number
  wrongWayActive: boolean
  speedCalibrated: boolean
  // 实时占道率折线图数据
  realtimeOccupancyHistory: TimeSeriesPoint[]
  // 轨迹画布：tracking_id → 最近30帧历史点（画布坐标，0.5缩放）
  trackHistoryMap: Map<number, TrackPoint[]>
  // 当前高亮的 tracking_id（画布点击联动视频框）
  highlightedTrackId: number | null
  // 设备在线状态
  isDeviceOnline: boolean
  selectedDeviceId: number

  // Actions
  updateFrameAndDetection: (
    base64: string,
    width: number,
    height: number,
    data: DetectionData,
  ) => void
  updateFrame: (base64: string, width?: number, height?: number) => void
  updateDetection: (data: DetectionData) => void
  addAlert: (alert: AlertItem) => void
  resolveAlert: (alertId: number) => void
  setDeviceOffline: () => void
  resetDeviceState: () => void
  setSelectedDeviceId: (id: number) => void
  setHighlightedTrackId: (id: number | null) => void
}

// ── 初始设备状态 ───────────────────────────────────────────────────────────────
const initialDeviceState = {
  currentFrame: null,
  frameWidth: 640,
  frameHeight: 480,
  vehicleCount: 0,
  passedCount: 0,
  passedInCount: 0,
  passedOutCount: 0,
  alertLevel: 0,
  lineY: 240,
  inferenceMs: 0,
  vehicles: [] as VehicleDetection[],
  activeAlerts: [] as AlertItem[],
  realtimeHistory: [] as TimeSeriesPoint[],
  occupancy: 0,
  losGrade: 'A',
  avgSpeedKmh: null,
  avgHeadwaySec: null,
  queueLength: 0,
  wrongWayActive: false,
  speedCalibrated: false,
  realtimeOccupancyHistory: [] as TimeSeriesPoint[],
  trackHistoryMap: new Map<number, TrackPoint[]>(),
  highlightedTrackId: null,
  isDeviceOnline: false,
}

// 画布尺寸（与 TrajectoryCanvas 保持一致）
const CANVAS_W = 320
const CANVAS_H = 240
const SRC_W = 640
const SRC_H = 480

function toCanvasCoords(px: number, py: number): { cx: number; cy: number } {
  return {
    cx: (px / SRC_W) * CANVAS_W,
    cy: (py / SRC_H) * CANVAS_H,
  }
}

let _lastChartTs = 0

function buildDetectionFields(
  data: DetectionData,
  currentHistory: TimeSeriesPoint[],
  currentOccHistory: TimeSeriesPoint[],
  currentTrackMap: Map<number, TrackPoint[]>,
): Partial<TrafficState> {
  const nowMs = Date.now()

  // 图表采样（每秒最多1点）
  let realtimeHistory = currentHistory
  let realtimeOccupancyHistory = currentOccHistory
  if (nowMs - _lastChartTs >= CHART_SAMPLE_INTERVAL_MS) {
    _lastChartTs = nowMs
    const timeStr = new Date(nowMs).toISOString()
    realtimeHistory = [
      ...currentHistory,
      { time: timeStr, value: data.vehicle_count },
    ].slice(-MAX_HISTORY_POINTS)
    realtimeOccupancyHistory = [
      ...currentOccHistory,
      { time: timeStr, value: Math.round((data.occupancy ?? 0) * 100) },
    ].slice(-MAX_HISTORY_POINTS)
  }

  // 更新轨迹历史 Map
  const newMap = new Map(currentTrackMap)
  const activeIds = new Set<number>()
  for (const v of data.vehicles ?? []) {
    if (v.tracking_id < 0) continue
    activeIds.add(v.tracking_id)
    const cx_src = (v.bbox[0] + v.bbox[2]) / 2
    const cy_src = (v.bbox[1] + v.bbox[3]) / 2
    const { cx, cy } = toCanvasCoords(cx_src, cy_src)
    const hist = newMap.get(v.tracking_id) ?? []
    const updated = [...hist, { cx, cy, ts: nowMs }]
    newMap.set(v.tracking_id, updated.slice(-TRACK_HISTORY_MAX_FRAMES))
  }
  // 清理超时 tracking_id
  for (const [id, hist] of newMap) {
    if (!activeIds.has(id) && nowMs - (hist.at(-1)?.ts ?? 0) > TRACK_EXPIRE_MS) {
      newMap.delete(id)
    }
  }

  return {
    vehicleCount: data.vehicle_count,
    passedCount: data.passed_count,
    passedInCount: data.passed_in_count,
    passedOutCount: data.passed_out_count,
    alertLevel: data.alert_level,
    lineY: data.line_y,
    inferenceMs: data.inference_ms,
    vehicles: data.vehicles ?? [],
    occupancy: data.occupancy ?? 0,
    losGrade: data.los_grade ?? 'A',
    avgSpeedKmh: data.avg_speed_kmh ?? null,
    avgHeadwaySec: data.avg_headway_sec ?? null,
    queueLength: data.queue_length ?? 0,
    wrongWayActive: data.wrong_way_active ?? false,
    speedCalibrated: data.speed_calibrated ?? false,
    realtimeHistory,
    realtimeOccupancyHistory,
    trackHistoryMap: newMap,
    isDeviceOnline: true,
  }
}

export const useTrafficStore = create<TrafficState>((set) => ({
  ...initialDeviceState,
  selectedDeviceId: DEFAULT_DEVICE_ID,

  updateFrameAndDetection: (base64, width, height, data) =>
    set((s) => ({
      currentFrame: base64,
      frameWidth: width,
      frameHeight: height,
      ...buildDetectionFields(
        data,
        s.realtimeHistory,
        s.realtimeOccupancyHistory,
        s.trackHistoryMap,
      ),
    })),

  updateFrame: (base64, width, height) =>
    set((s) => ({
      currentFrame: base64,
      frameWidth: width ?? s.frameWidth,
      frameHeight: height ?? s.frameHeight,
    })),

  updateDetection: (data) =>
    set((s) =>
      buildDetectionFields(
        data,
        s.realtimeHistory,
        s.realtimeOccupancyHistory,
        s.trackHistoryMap,
      ),
    ),

  addAlert: (alert) =>
    set((state) => {
      if (state.activeAlerts.some((a) => a.id === alert.id)) return state
      return { activeAlerts: [alert, ...state.activeAlerts] }
    }),

  resolveAlert: (alertId) =>
    set((state) => ({
      activeAlerts: state.activeAlerts.filter((a) => a.id !== alertId),
    })),

  setDeviceOffline: () =>
    set({
      isDeviceOnline: false,
      vehicleCount: 0,
      alertLevel: 0,
      occupancy: 0,
      avgSpeedKmh: null,
      wrongWayActive: false,
    }),

  resetDeviceState: () =>
    set({ ...initialDeviceState, trackHistoryMap: new Map() }),

  setSelectedDeviceId: (id) => set({ selectedDeviceId: id }),

  setHighlightedTrackId: (id) => set({ highlightedTrackId: id }),
}))
