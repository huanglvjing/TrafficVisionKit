/**
 * BottomStatusBar — 全宽底部状态条
 * 展示：连接状态、服务器 CPU/MEM/GPU、设备 FPS/延迟/队列、今日累计过线
 */
import { motion } from 'framer-motion'
import { HudCorners } from '@/components/video/HudCorners'
import { StatusDot }  from '@/components/ui/StatusDot'
import { RollingNumber } from '@/components/ui/RollingNumber'
import type { DeviceHealthStats, ServerStats } from '@/types/websocket'

function formatUptime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// ── 带进度条的指标项（CPU/MEM/GPU）─────────────────────────────────────────
function HealthBarGauge({
  label, value, max = 100, unit = '%', warn, danger,
}: {
  label: string; value: number; max?: number; unit?: string
  warn?: number; danger?: number
}) {
  const pct = (value / max) * 100
  let color = '#00E676'
  if (danger !== undefined && value >= danger) color = '#F44336'
  else if (warn !== undefined && value >= warn) color = '#FF9800'
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-1">
        <span className="font-display text-[8px] tracking-[0.18em] text-text-secondary/55 uppercase">
          {label}
        </span>
        <span className="font-mono text-[10px] font-medium tabular-nums" style={{ color }}>
          {Number.isFinite(value) ? value.toFixed(value < 10 ? 1 : 0) : '--'}{unit}
        </span>
      </div>
      <div className="h-[3px] overflow-hidden rounded-full bg-white/[0.04]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color, boxShadow: `0 0 4px ${color}60` }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ── 纯文字指标项（FPS/延迟/队列）──────────────────────────────────────────
function HealthText({
  label, value, warn, danger,
}: {
  label: string; value: string; warn?: boolean; danger?: boolean
}) {
  const color = danger ? '#F44336' : warn ? '#FF9800' : undefined
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-display text-[8px] tracking-[0.18em] text-text-secondary/55 uppercase">
        {label}
      </span>
      <span
        className="font-mono text-[10px] font-medium text-text-primary tabular-nums"
        style={{ color }}
      >
        {value}
      </span>
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────
interface Props {
  server: ServerStats | null
  device: DeviceHealthStats | null
  isConnected: boolean
  deviceStatus: 'online' | 'offline' | 'warning'
  passedCount: number
}

export function BottomStatusBar({ server, device, isConnected, deviceStatus, passedCount }: Props) {
  return (
    <div
      className="relative flex flex-shrink-0 items-center gap-4 overflow-hidden rounded-sm bg-bg-panel px-4 py-2"
      style={{ border: '1px solid rgba(0,212,255,0.08)' }}
    >
      <HudCorners color="#00D4FF" length={8} thickness={1} pulse={false} />

      {/* 连接状态 */}
      <div
        className="flex flex-shrink-0 items-center gap-2 border-r pr-4"
        style={{ borderColor: 'rgba(0,212,255,0.1)' }}
      >
        <StatusDot status={deviceStatus} size="sm" />
        <span className="font-display text-[9px] tracking-[0.15em] text-text-secondary/70 uppercase">
          {isConnected ? (device?.is_active ? 'ONLINE' : 'IDLE') : 'OFFLINE'}
        </span>
      </div>

      {/* 服务器资源 */}
      {server && (
        <div
          className="grid w-44 flex-shrink-0 grid-cols-3 gap-x-3 gap-y-1 border-r pr-4"
          style={{ borderColor: 'rgba(0,212,255,0.1)' }}
        >
          <HealthBarGauge label="CPU" value={server.cpu_percent}    warn={70} danger={90} />
          <HealthBarGauge label="MEM" value={server.memory_percent} warn={80} danger={90} />
          <HealthBarGauge label="GPU" value={server.gpu_percent ?? 0} warn={80} danger={95} />
        </div>
      )}

      {/* 设备指标 */}
      {device && (
        <div
          className="flex flex-shrink-0 items-center gap-4 border-r pr-4"
          style={{ borderColor: 'rgba(0,212,255,0.1)' }}
        >
          <HealthText
            label="FPS"  value={device.fps.toFixed(1)}
            warn={device.fps < 15 && device.is_active}
            danger={device.fps < 5 && device.is_active}
          />
          <HealthText
            label="延迟" value={`${device.avg_inference_ms.toFixed(1)}ms`}
            warn={device.avg_inference_ms > 40}
            danger={device.avg_inference_ms > 50}
          />
          <HealthText
            label="丢帧" value={String(device.dropped_frames)}
            warn={device.dropped_frames > 5}
            danger={device.dropped_frames > 10}
          />
          <HealthText
            label="队列"
            value={`${device.raw_queue_size}/${device.ws_queue_size}/${device.db_queue_size}`}
            warn={device.raw_queue_size >= 2 || device.ws_queue_size >= 2}
          />
        </div>
      )}

      {/* 今日累计过线 */}
      <div className="flex flex-shrink-0 items-center gap-2">
        <span className="font-display text-[8px] tracking-[0.18em] text-text-secondary/40 uppercase">
          今日过线
        </span>
        <span style={{ textShadow: '0 0 8px #00D4FF40' }}>
          <RollingNumber
            value={passedCount}
            color="#00D4FF"
            className="font-mono text-sm font-bold tabular-nums"
          />
        </span>
        <span className="font-display text-[8px] text-text-secondary/30">辆</span>
      </div>

      {/* 运行时长（右对齐） */}
      {server && (
        <div className="ml-auto flex-shrink-0">
          <HealthText label="运行时长" value={formatUptime(server.uptime_seconds)} />
        </div>
      )}
    </div>
  )
}
