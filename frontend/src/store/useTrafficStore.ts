import { create } from 'zustand'
import type { AlertItem, TimeSeriesPoint } from '@/types/models'
import type { DetectionData } from '@/types/websocket'

const DEFAULT_DEVICE_ID =
  Number(import.meta.env['VITE_DEFAULT_DEVICE_ID'] ?? '1') || 1

const MAX_HISTORY_POINTS = 60

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
  // 活跃预警列表
  activeAlerts: AlertItem[]
  // 近 60 秒实时车辆数折线图数据
  realtimeHistory: TimeSeriesPoint[]
  // 设备在线状态
  isDeviceOnline: boolean
  // 当前选中设备 ID
  selectedDeviceId: number

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
  activeAlerts: [] as AlertItem[],
  realtimeHistory: [] as TimeSeriesPoint[],
  isDeviceOnline: false,
}

export const useTrafficStore = create<TrafficState>((set) => ({
  ...initialDeviceState,
  selectedDeviceId: DEFAULT_DEVICE_ID,

  updateFrame: (base64, width, height) =>
    set((s) => ({
      currentFrame: base64,
      frameWidth: width ?? s.frameWidth,
      frameHeight: height ?? s.frameHeight,
    })),

  updateDetection: (data) =>
    set((state) => {
      const now = new Date().toISOString()
      const point: TimeSeriesPoint = { time: now, value: data.vehicle_count }
      const history = [...state.realtimeHistory, point].slice(-MAX_HISTORY_POINTS)
      return {
        vehicleCount: data.vehicle_count,
        passedCount: data.passed_count,
        passedInCount: data.passed_in_count,
        passedOutCount: data.passed_out_count,
        alertLevel: data.alert_level,
        lineY: data.line_y,
        inferenceMs: data.inference_ms,
        realtimeHistory: history,
        isDeviceOnline: true,
      }
    }),

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
