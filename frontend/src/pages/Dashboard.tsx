/**
 * 实时监控仪表盘（设计稿 8.4 节）
 *
 * 布局：
 *   ┌──────────────────────┬────────────────────┐
 *   │   VideoPanel (4:3)   │  [4 StatCards 2×2] │
 *   │   ScanlineOverlay    │  RealtimeChart      │
 *   │   CountingLine       │  AlertList          │
 *   ├──────────────────────┴────────────────────┤
 *   │  健康数据行（CPU/GPU/队列/FPS/丢帧）        │
 *   └────────────────────────────────────────────┘
 */
import { useState } from 'react'
import { useTrafficStore } from '@/store/useTrafficStore'
import { useStreamSocket } from '@/hooks/useStreamSocket'
import { useHealthSocket } from '@/hooks/useHealthSocket'
import { useResolveAlert } from '@/lib/api'
import { alertLevelLabel } from '@/lib/utils'
import { StatCard } from '@/components/ui/StatCard'
import { AlertList } from '@/components/ui/AlertList'
import { StatusDot } from '@/components/ui/StatusDot'
import { VideoPanel } from '@/components/video/VideoPanel'
import { RealtimeChart } from '@/components/charts/RealtimeChart'
import type { HealthReportMsg, DeviceHealthStats, ServerStats } from '@/types/websocket'

// ── 健康数据行 ─────────────────────────────────────────────────────────────────

interface MetricProps {
  label: string
  value: string | number
  warn?: boolean
  danger?: boolean
}

function HealthMetric({ label, value, warn, danger }: MetricProps) {
  const color = danger
    ? 'text-alert-l4'
    : warn
    ? 'text-alert-l3'
    : 'text-text-primary'
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] tracking-widest text-text-secondary/60 uppercase">{label}</span>
      <span className={`font-mono text-xs font-medium ${color}`}>{value}</span>
    </div>
  )
}

interface HealthRowProps {
  server: ServerStats | null
  device: DeviceHealthStats | null
}

function HealthDataRow({ server, device }: HealthRowProps) {
  const degradationLevel = device?.degradation_level ?? 0

  return (
    <div
      className="flex flex-shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-t border-[#1E2D4A] pt-3"
    >
      {/* 降级状态 */}
      {degradationLevel > 0 && (
        <span
          className="rounded-sm px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase"
          style={{
            background: `rgba(255,${degradationLevel >= 3 ? '0' : degradationLevel === 2 ? '152' : '214'},${degradationLevel >= 3 ? '0' : '0'},0.15)`,
            color: degradationLevel >= 3 ? '#F44336' : degradationLevel === 2 ? '#FF9800' : '#FFD600',
            border: `1px solid`,
            borderColor: degradationLevel >= 3 ? '#F4433640' : degradationLevel === 2 ? '#FF980040' : '#FFD60040',
          }}
        >
          L{degradationLevel} 降级
        </span>
      )}

      {/* 服务器指标 */}
      {server && (
        <>
          <HealthMetric
            label="CPU"
            value={`${server.cpu_percent.toFixed(1)}%`}
            warn={server.cpu_percent > 70}
            danger={server.cpu_percent > 90}
          />
          <HealthMetric
            label="内存"
            value={`${server.memory_percent.toFixed(1)}%`}
            warn={server.memory_percent > 80}
            danger={server.memory_percent > 90}
          />
          {server.gpu_percent !== null && (
            <HealthMetric
              label="GPU"
              value={`${server.gpu_percent?.toFixed(1)}%`}
              warn={server.gpu_percent !== null && server.gpu_percent > 80}
              danger={server.gpu_percent !== null && server.gpu_percent > 95}
            />
          )}
          <HealthMetric
            label="运行时长"
            value={formatUptime(server.uptime_seconds)}
          />
        </>
      )}

      {/* 设备级指标 */}
      {device && (
        <>
          <div className="mx-2 hidden h-4 w-px bg-[#1E2D4A] sm:block" />
          <HealthMetric
            label="FPS"
            value={device.fps.toFixed(1)}
            warn={device.fps < 15 && device.is_active}
            danger={device.fps < 5 && device.is_active}
          />
          <HealthMetric
            label="推理延迟"
            value={`${device.avg_inference_ms.toFixed(1)}ms`}
            warn={device.avg_inference_ms > 40}
            danger={device.avg_inference_ms > 50}
          />
          <HealthMetric
            label="队列(r/w/d)"
            value={`${device.raw_queue_size}/${device.ws_queue_size}/${device.db_queue_size}`}
            warn={device.raw_queue_size >= 2 || device.ws_queue_size >= 2}
          />
          <HealthMetric
            label="丢帧/min"
            value={device.dropped_frames}
            warn={device.dropped_frames > 5}
            danger={device.dropped_frames > 10}
          />
        </>
      )}

      {/* 无数据 */}
      {!server && !device && (
        <span className="text-[10px] text-text-secondary/40">健康数据等待中…</span>
      )}
    </div>
  )
}

function formatUptime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// ── 仪表盘主体 ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const selectedDeviceId = useTrafficStore((s) => s.selectedDeviceId)
  const vehicleCount = useTrafficStore((s) => s.vehicleCount)
  const passedCount = useTrafficStore((s) => s.passedCount)
  const alertLevel = useTrafficStore((s) => s.alertLevel)
  const realtimeHistory = useTrafficStore((s) => s.realtimeHistory)
  const activeAlerts = useTrafficStore((s) => s.activeAlerts)
  const inferenceMs = useTrafficStore((s) => s.inferenceMs)
  const isDeviceOnline = useTrafficStore((s) => s.isDeviceOnline)
  const storeResolveAlert = useTrafficStore((s) => s.resolveAlert)

  const { isConnected } = useStreamSocket(selectedDeviceId)

  const [healthReport, setHealthReport] = useState<HealthReportMsg | null>(null)
  useHealthSocket({ onReport: setHealthReport })

  const { mutate: resolveAlertApi } = useResolveAlert()

  const deviceHealth =
    healthReport?.devices.find((d) => d.device_id === selectedDeviceId) ?? null
  const serverHealth = healthReport?.server ?? null

  const handleResolveAlert = (alertId: number) => {
    storeResolveAlert(alertId)
    resolveAlertApi({ id: alertId, resolved_by: 'manual' })
  }

  const deviceStatus = !isConnected
    ? 'offline'
    : isDeviceOnline
    ? alertLevel > 0
      ? 'warning'
      : 'online'
    : 'offline'

  return (
    <div className="flex h-full flex-col overflow-hidden p-4 gap-4">
      {/* 主内容区：视频 + 统计 */}
      <div className="flex flex-1 gap-4 min-h-0">

        {/* ── 左列：视频面板 ── */}
        <div className="flex w-[52%] flex-shrink-0 flex-col gap-2">
          <VideoPanel
            isConnected={isConnected}
            alertLevel={alertLevel}
            droppedFrames={deviceHealth?.dropped_frames}
          />

          {/* 设备状态行 */}
          <div className="flex items-center gap-2">
            <StatusDot status={deviceStatus} size="sm" />
            <span className="text-[10px] text-text-secondary">
              {isConnected ? (isDeviceOnline ? 'STM32 在线' : 'STM32 离线') : 'WebSocket 断开'}
            </span>
            {deviceHealth && (
              <span className="ml-auto font-mono text-[10px] text-text-secondary/60">
                {deviceHealth.fps.toFixed(1)} fps
              </span>
            )}
          </div>
        </div>

        {/* ── 右列：统计 + 图表 + 预警 ── */}
        <div className="flex flex-1 flex-col gap-3 min-h-0">

          {/* 四个统计卡片 */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              title="当前车辆数"
              value={vehicleCount}
              alertLevel={alertLevel}
              animateNumber
            />
            <StatCard
              title="累计过线"
              value={passedCount}
              alertLevel={0}
              animateNumber
            />
            <StatCard
              title="预警等级"
              value={alertLevelLabel(alertLevel)}
              alertLevel={alertLevel}
            />
            <StatCard
              title="推理延迟"
              value={Number(inferenceMs.toFixed(1))}
              unit="ms"
              alertLevel={inferenceMs > 40 ? 2 : 0}
              format={(v) => v.toFixed(1)}
            />
          </div>

          {/* 近 60 秒实时折线图 */}
          <RealtimeChart
            data={realtimeHistory}
            title="近 60s 车辆数"
            height={130}
          />

          {/* 活跃预警列表（可滚动） */}
          <div className="flex-1 overflow-auto min-h-0 pr-1">
            <AlertList
              alerts={activeAlerts}
              maxItems={8}
              onResolve={handleResolveAlert}
            />
          </div>
        </div>
      </div>

      {/* 底部健康数据行 */}
      <HealthDataRow server={serverHealth} device={deviceHealth} />
    </div>
  )
}
