/**
 * HTTP 客户端与 TanStack Query hooks。
 *
 * 职责：
 *  1. 创建 axios 实例，自动注入 Authorization Header
 *  2. 响应拦截器：401 → 静默刷新 Token → 重试原请求，刷新失败跳登录页
 *  3. 导出所有 TanStack Query hooks（useQuery / useMutation）
 */
import axios from 'axios'
import type { AxiosInstance } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/useAuthStore'
import type {
  AlertListResponse,
  AlertRecord,
  DeviceCreate,
  DeviceDetail,
  DeviceSettingsRead,
  DeviceSettingsUpdate,
  HeatmapResponse,
  HourlyStatisticsItem,
  LoginRequest,
  SessionListResponse,
  SystemLogListResponse,
  TokenResponse,
  TrafficRecordItem,
  UserCreate,
  UserInfo,
  UserListResponse,
  UserUpdate,
} from '@/types/api'

const API_BASE = import.meta.env['VITE_API_BASE_URL'] ?? 'http://localhost:8000'

// ── axios 实例 ────────────────────────────────────────────────────────────────

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE,
  withCredentials: true,   // 自动携带 refresh_token Cookie
  timeout: 15_000,
})

// 请求拦截器：注入 Bearer Token
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 响应拦截器：401 → 刷新 Token → 重试
let _refreshing = false
let _pendingQueue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = []

const flushQueue = (err: unknown, token: string | null) => {
  _pendingQueue.forEach(({ resolve, reject }) =>
    err ? reject(err) : resolve(token!)
  )
  _pendingQueue = []
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as typeof error.config & { _retry?: boolean }
    const isRefreshUrl = original.url?.includes('/api/auth/refresh')
    
    // 如果是 401 且已经在 refresh 路由本身，直接返回错误（避免无限循环）
    if (error.response?.status === 401 && isRefreshUrl) {
      useAuthStore.getState().clearAuth()
      return Promise.reject(error)
    }
    
    // 如果不是 401 或已经重试过，直接返回错误
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    if (_refreshing) {
      return new Promise<string>((resolve, reject) =>
        _pendingQueue.push({ resolve, reject })
      ).then((token) => {
        original.headers.Authorization = `Bearer ${token}`
        return apiClient(original)
      })
    }

    original._retry = true
    _refreshing = true

    try {
      // 尝试从备份中读取 refresh token（用于通过 Header 发送）
      const refreshTokenBackup = localStorage.getItem('refresh_token_backup')
      
      const { data } = await axios.post<TokenResponse>(
        `${API_BASE}/api/auth/refresh`,
        {},
        { 
          withCredentials: true,
          headers: refreshTokenBackup ? { 'X-Refresh-Token': refreshTokenBackup } : {},
        }
      )
      useAuthStore.getState().setTokens(data.access_token, data.refresh_token || refreshTokenBackup, data.user)
      flushQueue(null, data.access_token)
      original.headers.Authorization = `Bearer ${data.access_token}`
      return apiClient(original)
    } catch (refreshErr) {
      flushQueue(refreshErr, null)
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
      return Promise.reject(refreshErr)
    } finally {
      _refreshing = false
    }
  }
)

// ── 认证 ──────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<TokenResponse>('/api/auth/login', data).then((r) => r.data),

  refresh: () =>
    apiClient.post<TokenResponse>('/api/auth/refresh').then((r) => r.data),

  logout: () => apiClient.post('/api/auth/logout'),

  me: () => apiClient.get<UserInfo>('/api/auth/me').then((r) => r.data),
}

// ── 设备 ──────────────────────────────────────────────────────────────────────

export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: () =>
      apiClient.get<DeviceDetail[]>('/api/devices').then((r) => r.data),
  })
}

export function useDeviceDetail(id: number) {
  return useQuery({
    queryKey: ['device', id],
    queryFn: () =>
      apiClient.get<DeviceDetail>(`/api/devices/${id}`).then((r) => r.data),
    enabled: id > 0,
  })
}

export function useDeviceSettings(id: number) {
  return useQuery({
    queryKey: ['device', id, 'settings'],
    queryFn: () =>
      apiClient
        .get<DeviceSettingsRead>(`/api/devices/${id}/settings`)
        .then((r) => r.data),
    enabled: id > 0,
  })
}

export function useCreateDevice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: DeviceCreate) =>
      apiClient.post<DeviceDetail>('/api/devices', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['devices'] }),
  })
}

export function useUpdateDeviceSettings(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: DeviceSettingsUpdate) =>
      apiClient
        .put<DeviceSettingsRead>(`/api/devices/${id}/settings`, data)
        .then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['device', id, 'settings'] }),
  })
}

export function useUpdateDevice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; location?: string } }) =>
      apiClient.put<DeviceDetail>(`/api/devices/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['devices'] }),
  })
}

export function useDeleteDevice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/api/devices/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['devices'] }),
  })
}

// ── 历史数据 ──────────────────────────────────────────────────────────────────

export interface TrafficHistoryParams {
  device_id: number
  start: string
  end: string
  limit?: number
}

export function useTrafficHistory(params: TrafficHistoryParams) {
  return useQuery({
    queryKey: ['history', 'traffic', params],
    queryFn: () =>
      apiClient
        .get<TrafficRecordItem[]>('/api/history/traffic', { params })
        .then((r) => r.data),
    enabled: params.device_id > 0,
  })
}

export interface HourlyHistoryParams {
  device_id: number
  start: string
  end: string
}

export function useHourlyHistory(params: HourlyHistoryParams) {
  return useQuery({
    queryKey: ['history', 'hourly', params],
    queryFn: () =>
      apiClient
        .get<HourlyStatisticsItem[]>('/api/history/traffic/hourly', { params })
        .then((r) => r.data),
    enabled: params.device_id > 0,
  })
}

export interface AlertHistoryParams {
  device_id?: number
  is_resolved?: boolean
  page?: number
  page_size?: number
}

export function useAlertHistory(params: AlertHistoryParams) {
  return useQuery({
    queryKey: ['history', 'alerts', params],
    queryFn: () =>
      apiClient
        .get<AlertListResponse>('/api/history/alerts', { params })
        .then((r) => r.data),
  })
}

export function useResolveAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, resolved_by }: { id: number; resolved_by: string }) =>
      apiClient
        .put<AlertRecord>(`/api/history/alerts/${id}/resolve`, { resolved_by })
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['history', 'alerts'] }),
  })
}

export interface HeatmapParams {
  device_id: number
  end_date?: string
}

export function useHeatmapData(params: HeatmapParams) {
  return useQuery({
    queryKey: ['history', 'heatmap', params],
    queryFn: () =>
      apiClient
        .get<HeatmapResponse>('/api/history/heatmap', { params })
        .then((r) => r.data),
    enabled: params.device_id > 0,
  })
}

export interface SessionsParams {
  device_id?: number
  page?: number
  page_size?: number
}

export function useSessions(params: SessionsParams) {
  return useQuery({
    queryKey: ['history', 'sessions', params],
    queryFn: () =>
      apiClient
        .get<SessionListResponse>('/api/history/sessions', { params })
        .then((r) => r.data),
  })
}

// ── 系统 & 用户 ───────────────────────────────────────────────────────────────

export interface LogsParams {
  device_id?: number
  event_type?: string
  start?: string
  end?: string
  page?: number
  page_size?: number
}

export function useSystemLogs(params: LogsParams) {
  return useQuery({
    queryKey: ['system', 'logs', params],
    queryFn: () =>
      apiClient
        .get<SystemLogListResponse>('/api/system/logs', { params })
        .then((r) => r.data),
  })
}

export interface UsersParams {
  page?: number
  page_size?: number
}

export function useUsers(params: UsersParams = {}) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () =>
      apiClient
        .get<UserListResponse>('/api/users', { params })
        .then((r) => r.data),
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UserCreate) =>
      apiClient.post<UserInfo>('/api/users', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useUpdateUser(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UserUpdate) =>
      apiClient.put<UserInfo>(`/api/users/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiClient.delete(`/api/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useResetPassword(id: number) {
  return useMutation({
    mutationFn: (newPassword: string) =>
      apiClient.put(`/api/users/${id}/password`, { new_password: newPassword }),
  })
}
