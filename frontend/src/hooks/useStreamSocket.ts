/**
 * 视频流 WebSocket Hook。
 *
 * 功能：
 *   - 订阅 /ws/stream/{deviceId}
 *   - 接收 stream_frame / alert_event / alert_resolved / device_offline / token_expiring
 *   - deviceId 切换时：断开旧连接 → 重置 Store → 建立新连接
 *   - close code 4401：刷新 Token → 重连；刷新失败 → 跳转登录页
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWebSocket } from './useWebSocket'
import { useAuthStore } from '@/store/useAuthStore'
import { useTrafficStore } from '@/store/useTrafficStore'
import { authApi } from '@/lib/api'
import type {
  AlertEventMsg,
  AlertResolvedMsg,
  DeviceOfflineMsg,
  StreamFrameMsg,
  StreamMsg,
  TokenExpiringMsg,
} from '@/types/websocket'

const WS_BASE = import.meta.env['VITE_WS_BASE_URL'] ?? 'ws://localhost:8000'

interface UseStreamSocketReturn {
  isConnected: boolean
}

export function useStreamSocket(deviceId: number): UseStreamSocketReturn {
  const navigate = useNavigate()
  const { updateFrame, updateDetection, addAlert, resolveAlert, setDeviceOffline, resetDeviceState } =
    useTrafficStore()
  const { setTokens, clearAuth } = useAuthStore()

  // 当前连接使用的 Token（刷新后更新以触发 URL 重算）
  const [activeToken, setActiveToken] = useState(
    () => useAuthStore.getState().accessToken
  )

  // 订阅 store 中 token 变化（登录后设置、刷新后更新）
  useEffect(() => {
    return useAuthStore.subscribe((s) => {
      if (s.accessToken && s.accessToken !== activeToken) {
        setActiveToken(s.accessToken)
      }
    })
  }, [activeToken])

  const wsUrl =
    activeToken && deviceId > 0
      ? `${WS_BASE}/ws/stream/${deviceId}?token=${activeToken}`
      : null

  // deviceId 切换时重置设备状态
  useEffect(() => {
    resetDeviceState()
  }, [deviceId, resetDeviceState])

  const handleMessage = useCallback(
    (raw: unknown) => {
      const msg = raw as StreamMsg
      switch (msg.type) {
        case 'stream_frame': {
          const m = msg as StreamFrameMsg
          updateFrame(m.frame.data, m.frame.width, m.frame.height)
          updateDetection(m.detection)
          break
        }
        case 'alert_event': {
          const m = msg as AlertEventMsg
          addAlert({ ...m.alert, device_id: m.device_id })
          break
        }
        case 'alert_resolved': {
          const m = msg as AlertResolvedMsg
          resolveAlert(m.alert.id)
          break
        }
        case 'device_offline': {
          const _m = msg as DeviceOfflineMsg
          void _m
          setDeviceOffline()
          break
        }
        case 'token_expiring': {
          // 后端提前 5 分钟通知，静默刷新 Token
          const _m = msg as TokenExpiringMsg
          void _m
          authApi
            .refresh()
            .then((data) => {
              setTokens(data.access_token, data.user)
              setActiveToken(data.access_token)
            })
            .catch(() => {
              // 刷新失败：等 4401 触发时再强制登出
            })
          break
        }
        default:
          break
      }
    },
    [updateFrame, updateDetection, addAlert, resolveAlert, setDeviceOffline, setTokens]
  )

  const handleClose = useCallback(
    async (code: number) => {
      if (code !== 4401) return

      // Token 过期：静默刷新
      try {
        const data = await authApi.refresh()
        setTokens(data.access_token, data.user)
        setActiveToken(data.access_token)   // 触发 URL 变化 → useWebSocket 重连
      } catch {
        clearAuth()
        navigate('/login', { replace: true })
      }
    },
    [setTokens, clearAuth, navigate]
  )

  const { isConnected } = useWebSocket({
    url: wsUrl,
    onMessage: handleMessage,
    onClose: handleClose,
    enabled: !!activeToken && deviceId > 0,
  })

  return { isConnected }
}
