import { create } from 'zustand'
import type { AlertItem, TimeSeriesPoint } from '@/types/models'
import type { DetectionData, VehicleDetection } from '@/types/websocket'

const DEFAULT_DEVICE_ID =
  Number(import.meta.env['VITE_DEFAULT_DEVICE_ID'] ?? '1') || 1

const MAX_HISTORY_POINTS = 60
/** 图表最小采样间隔（毫秒）：每秒最多 1 个数据点，避免帧率驱动的刷屏 */
const CHART_SAMPLE_INTERVAL_MS = 1000

interface TrafficState {
  // 当前帧（base64 JPEG）
  currentFrame: string | null
  // 帧分辨率（来自 stream_frame.frame）
  frameWidth: number
  frameHeight: number
  // 检测统计
  vehicleCount: number
  passedCount: number
  passedInCount: number
  passedOutCount: number
  alertLevel: number
  lineY: number
  inferenceMs: number
  // 当前帧所有检测到的车辆（供前端 Canvas 绘制 HUD 检测框）
  vehicles: VehicleDetection[]
  // 活跃预警列表
  activeAlerts: AlertItem[]
  // 近 60 秒实时车辆数折线图数据（每秒 1 点）
  realtimeHistory: TimeSeriesPoint[]
  // 设备在线状态
  isDeviceOnline: boolean
  // 当前选中设备 ID
  selectedDeviceId: number

  /**
   * 同时更新视频帧 + 检测统计，合并为一次 set 调用，
   * 避免两次独立 set 产生双倍渲染。
   */
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
}

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
  isDeviceOnline: false,
}

/** 上次写入图表的时间戳（模块级，跨渲染复用） */
let _lastChartTs = 0

/** 从 DetectionData 构建检测字段的纯函数（供两个 action 复用） */
function buildDetectionFields(
  data: DetectionData,
  currentHistory: TimeSeriesPoint[],
): Partial<TrafficState> {
  const nowMs = Date.now()
  let realtimeHistory = currentHistory
  if (nowMs - _lastChartTs >= CHART_SAMPLE_INTERVAL_MS) {
    _lastChartTs = nowMs
    const point: TimeSeriesPoint = {
      time: new Date(nowMs).toISOString(),
      value: data.vehicle_count,
    }
    realtimeHistory = [...currentHistory, point].slice(-MAX_HISTORY_POINTS)
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
    realtimeHistory,
    isDeviceOnline: true,
  }
}

export const useTrafficStore = create<TrafficState>((set) => ({
  ...initialDeviceState,
  selectedDeviceId: DEFAULT_DEVICE_ID,

  /** 帧 + 检测数据一次合并更新，减少 React 渲染次数 */
  updateFrameAndDetection: (base64, width, height, data) =>
    set((s) => ({
      currentFrame: base64,
      frameWidth: width,
      frameHeight: height,
      ...buildDetectionFields(data, s.realtimeHistory),
    })),

  updateFrame: (base64, width, height) =>
    set((s) => ({
      currentFrame: base64,
      frameWidth: width ?? s.frameWidth,
      frameHeight: height ?? s.frameHeight,
    })),

  updateDetection: (data) =>
    set((s) => buildDetectionFields(data, s.realtimeHistory)),

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
    set({ isDeviceOnline: false, vehicleCount: 0, alertLevel: 0 }),

  resetDeviceState: () => set(initialDeviceState),

  setSelectedDeviceId: (id) => set({ selectedDeviceId: id }),
}))
