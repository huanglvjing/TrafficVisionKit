/**
 * 实时监控仪表盘 — 四列 HUD 重设计
 *
 * ┌────┬──────────────────┬─────────────────────┬─────────────────────┐
 * │侧栏│  左侧数据卡片区   │     视频面板         │  右上：轨迹画布      │
 * │    │  7 张纵向卡片     │  VideoPanel          ├─────────────────────┤
 * │    │                  │  + 叠加层             │  右下：实时折线图    │
 * ├────┴──────────────────┴─────────────────────┴─────────────────────┤
 * │  底部状态条：健康指标 + FPS + 延迟 + 今日累计                       │
 * └──────────────────────────────────────────────────────────────────┘
 */
import { useState, useEffect } from 'react'
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
} from 'framer-motion'
import { useTrafficStore } from '@/store/useTrafficStore'
import { useStreamSocket } from '@/hooks/useStreamSocket'
import { useHealthSocket } from '@/hooks/useHealthSocket'
import { useResolveAlert } from '@/lib/api'
import { alertLevelColor } from '@/lib/utils'
import { AlertList } from '@/components/ui/AlertList'
import { StatusDot } from '@/components/ui/StatusDot'
import { VideoPanel } from '@/components/video/VideoPanel'
import { TrajectoryCanvas } from '@/components/video/TrajectoryCanvas'
import { RealtimeChart } from '@/components/charts/RealtimeChart'
import { HudPanel } from '@/components/ui/HudPanel'
import { HudCorners } from '@/components/video/HudCorners'
import type { HealthReportMsg, DeviceHealthStats, ServerStats } from '@/types/websocket'

// ─────────────────────────────────────────────────────────────────────────────
// 颜色系统
// ─────────────────────────────────────────────────────────────────────────────
const ALERT_COLORS = ['#00D4FF', '#4FC3F7', '#FFD600', '#FF9800', '#F44336', '#FF3B5C']
const ALERT_CN     = ['正常运行', '轻度拥堵', '中度拥堵', '严重拥堵', '极度拥堵', '交通瘫痪']

const LOS_COLOR: Record<string, string> = {
  A: '#34c759', B: '#8bc34a', C: '#ffcc00', D: '#ff9500', E: '#ff3b30', F: '#c0392b',
}
const LOS_LABEL: Record<string, string> = {
  A: '畅通', B: '稳定', C: '临界', D: '不稳定', E: '拥挤', F: '严重拥堵',
}

function formatUptime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// ─────────────────────────────────────────────────────────────────────────────
// RollingNumber — 数字滚动动画
// ─────────────────────────────────────────────────────────────────────────────
function RollingNumber({
  value,
  color = 'inherit',
  className = '',
  format,
}: {
  value: number
  color?: string
  className?: string
  format?: (v: number) => string
}) {
  const mv = useMotionValue(0)
  const display = useTransform(mv, (v) =>
    format ? format(v) : Math.round(v).toLocaleString('zh-CN'),
  )
  useEffect(() => {
    const ctrl = animate(mv, value, { duration: 0.45, ease: 'easeOut' })
    return ctrl.stop
  }, [mv, value])
  return (
    <motion.span className={className} style={{ color }}>
      {display}
    </motion.span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// StatCard — 统一数据卡片
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({
  label,
  children,
  accent = '#00D4FF',
  alert,
  className = '',
}: {
  label: string
  children: React.ReactNode
  accent?: string
  alert?: boolean
  className?: string
}) {
  return (
    <motion.div
      className={`relative flex flex-col gap-1.5 rounded-sm px-3 py-2.5 ${className}`}
      style={{
        background: `${accent}06`,
        border: `1px solid ${alert ? accent : 'rgba(0,212,255,0.12)'}`,
        boxShadow: alert ? `0 0 8px ${accent}25` : 'none',
      }}
      animate={
        alert
          ? { borderColor: [accent, `${accent}40`, accent] }
          : {}
      }
      transition={{ duration: 1.4, repeat: Infinity }}
    >
      <span className="font-display text-[8px] tracking-[0.18em] text-text-secondary/50 uppercase">
        {label}
      </span>
      {children}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// OccupancyBar — 占道率进度条
// ─────────────────────────────────────────────────────────────────────────────
function OccupancyBar({ occupancy, losGrade }: { occupancy: number; losGrade: string }) {
  const pct   = Math.round(occupancy * 100)
  const color = LOS_COLOR[losGrade] ?? '#00D4FF'
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span
          className="font-mono text-xl font-bold tabular-nums leading-none"
          style={{ color, textShadow: `0 0 10px ${color}50` }}
        >
          <RollingNumber value={pct} color={color} format={(v) => `${Math.round(v)}%`} />
        </span>
        <span
          className="rounded-sm px-1.5 py-0.5 font-display text-[8px] font-bold tracking-widest"
          style={{
            background: `${color}18`,
            border: `1px solid ${color}40`,
            color,
          }}
        >
          LOS-{losGrade} {LOS_LABEL[losGrade]}
        </span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
        <motion.div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ background: color, boxShadow: `0 0 6px ${color}70` }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AlertLevelBadge — 简化版预警等级（卡片内）
// ─────────────────────────────────────────────────────────────────────────────
function AlertLevelBadge({ level }: { level: number }) {
  const clamped = Math.min(Math.max(level, 0), 5)
  const color   = ALERT_COLORS[clamped]
  const label   = ALERT_CN[clamped]
  return (
    <div className="flex items-center gap-2.5">
      <motion.div
        className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
        style={{ background: `${color}14`, border: `2px solid ${color}` }}
        animate={
          clamped > 0
            ? { boxShadow: [`0 0 6px ${color}30`, `0 0 18px ${color}60`, `0 0 6px ${color}30`] }
            : {}
        }
        transition={{ duration: 1.2, repeat: Infinity }}
      >
        {clamped > 0 && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ border: `1px solid ${color}` }}
            animate={{ scale: [1, 1.7], opacity: [0.4, 0] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
        )}
        <span
          className="font-display text-sm font-black"
          style={{ color, textShadow: `0 0 8px ${color}80` }}
        >
          L{clamped}
        </span>
      </motion.div>
      <div className="flex flex-col gap-0.5">
        <motion.span
          className="font-display text-[10px] font-bold tracking-widest uppercase"
          style={{ color }}
          animate={clamped > 0 ? { opacity: [1, 0.5, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {label}
        </motion.span>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((l) => (
            <div
              key={l}
              className="h-[10px] w-2.5 rounded-sm"
              style={{
                background: l <= clamped ? ALERT_COLORS[l] : 'rgba(255,255,255,0.04)',
                border: `1px solid ${l <= clamped ? ALERT_COLORS[l] : 'rgba(255,255,255,0.08)'}`,
                boxShadow: l <= clamped ? `0 0 4px ${ALERT_COLORS[l]}60` : 'none',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HealthBarGauge / HealthText — 底部状态栏用
// ─────────────────────────────────────────────────────────────────────────────
function HealthBarGauge({
  label, value, max = 100, unit = '%', warn, danger,
}: {
  label: string; value: number; max?: number; unit?: string; warn?: number; danger?: number
}) {
  const pct   = (value / max) * 100
  let color   = '#00E676'
  if (danger !== undefined && value >= danger) color = '#F44336'
  else if (warn !== undefined && value >= warn) color = '#FF9800'
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-1">
        <span className="font-display text-[8px] tracking-[0.18em] text-text-secondary/55 uppercase">{label}</span>
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

function HealthText({
  label, value, warn, danger,
}: {
  label: string; value: string; warn?: boolean; danger?: boolean
}) {
  const color = danger ? '#F44336' : warn ? '#FF9800' : undefined
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-display text-[8px] tracking-[0.18em] text-text-secondary/55 uppercase">{label}</span>
      <span className="font-mono text-[10px] font-medium text-text-primary tabular-nums" style={{ color }}>
        {value}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BottomStatusBar — 全宽底部状态条
// ─────────────────────────────────────────────────────────────────────────────
function BottomStatusBar({
  server, device, isConnected, deviceStatus, passedCount,
}: {
  server: ServerStats | null
  device: DeviceHealthStats | null
  isConnected: boolean
  deviceStatus: 'online' | 'offline' | 'warning'
  passedCount: number
}) {
  return (
    <div
      className="relative flex flex-shrink-0 items-center gap-4 overflow-hidden rounded-sm bg-bg-panel px-4 py-2"
      style={{ border: '1px solid rgba(0,212,255,0.08)' }}
    >
      <HudCorners color="#00D4FF" length={8} thickness={1} pulse={false} />

      {/* 连接状态 */}
      <div className="flex flex-shrink-0 items-center gap-2 border-r pr-4" style={{ borderColor: 'rgba(0,212,255,0.1)' }}>
        <StatusDot status={deviceStatus} size="sm" />
        <span className="font-display text-[9px] tracking-[0.15em] text-text-secondary/70 uppercase">
          {isConnected ? (device?.is_active ? 'ONLINE' : 'IDLE') : 'OFFLINE'}
        </span>
      </div>

      {/* 服务器指标 */}
      {server && (
        <div className="grid w-40 flex-shrink-0 grid-cols-3 gap-x-3 gap-y-1 border-r pr-4" style={{ borderColor: 'rgba(0,212,255,0.1)' }}>
          <HealthBarGauge label="CPU"  value={server.cpu_percent}    warn={70} danger={90} />
          <HealthBarGauge label="MEM"  value={server.memory_percent} warn={80} danger={90} />
          <HealthBarGauge label="GPU"  value={server.gpu_percent ?? 0} warn={80} danger={95} />
        </div>
      )}

      {/* 设备指标 */}
      {device && (
        <div className="flex flex-shrink-0 items-center gap-4 border-r pr-4" style={{ borderColor: 'rgba(0,212,255,0.1)' }}>
          <HealthText
            label="FPS" value={device.fps.toFixed(1)}
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
            label="队列" value={`${device.raw_queue_size}/${device.ws_queue_size}/${device.db_queue_size}`}
            warn={device.raw_queue_size >= 2 || device.ws_queue_size >= 2}
          />
        </div>
      )}

      {/* 今日累计过线 */}
      <div className="flex flex-shrink-0 items-center gap-2">
        <span className="font-display text-[8px] tracking-[0.18em] text-text-secondary/40 uppercase">今日过线</span>
        <span
          className="font-mono text-sm font-bold tabular-nums"
          style={{ color: '#00D4FF', textShadow: '0 0 8px #00D4FF40' }}
        >
          <RollingNumber value={passedCount} color="#00D4FF" />
        </span>
        <span className="font-display text-[8px] text-text-secondary/30">辆</span>
      </div>

      {server && (
        <div className="ml-auto flex-shrink-0">
          <HealthText label="运行时长" value={formatUptime(server.uptime_seconds)} />
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 右侧活跃预警面板
// ─────────────────────────────────────────────────────────────────────────────
function AlertPanel({
  activeAlerts,
  alertLevel,
  onResolve,
}: {
  activeAlerts: import('@/types/models').AlertItem[]
  alertLevel: number
  onResolve: (id: number) => void
}) {
  const clamped  = Math.min(Math.max(alertLevel, 0), 5)
  const color    = ALERT_COLORS[clamped]
  const flashAnim =
    clamped >= 4
      ? { opacity: [1, 0.25, 1] }
      : clamped >= 3
      ? { opacity: [1, 0.5, 1] }
      : {}
  const flashDuration = clamped >= 4 ? 0.5 : 1.0

  return (
    <motion.div
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm bg-bg-panel"
      style={{ border: `1px solid ${clamped > 0 ? color : 'rgba(0,212,255,0.1)'}` }}
      animate={clamped > 1 ? { boxShadow: [`0 0 0px ${color}00`, `0 0 14px ${color}40`, `0 0 0px ${color}00`] } : {}}
      transition={{ duration: flashDuration, repeat: Infinity }}
    >
      <HudCorners color={clamped > 0 ? color : '#00D4FF'} length={10} thickness={1} pulse={false} />

      {/* 标题 */}
      <motion.div
        className="flex flex-shrink-0 items-center justify-between border-b px-3 py-[7px]"
        style={{ borderColor: clamped > 0 ? `${color}30` : 'rgba(0,212,255,0.1)' }}
        animate={clamped >= 3 ? flashAnim : {}}
        transition={{ duration: flashDuration, repeat: Infinity }}
      >
        <div className="flex items-center gap-2">
          <motion.span
            className="block h-[5px] w-[5px] rounded-full"
            style={{
              background: clamped > 0 ? color : '#34c759',
              boxShadow: `0 0 5px ${clamped > 0 ? color : '#34c759'}`,
            }}
            animate={clamped > 0 ? { opacity: [1, 0.2, 1] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className="font-display text-[9px] font-bold tracking-[0.22em] text-text-secondary uppercase">
            活跃预警
          </span>
        </div>
        <AnimatePresence>
          {activeAlerts.length > 0 && (
            <motion.span
              key="cnt"
              className="rounded-sm px-1.5 py-0.5 font-mono text-[8px] font-bold"
              style={{
                background: `${color}18`,
                border: `1px solid ${color}40`,
                color,
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              {activeAlerts.length}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto p-2">
        <AlertList alerts={activeAlerts} maxItems={10} onResolve={onResolve} />
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 主仪表盘
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const selectedDeviceId   = useTrafficStore((s) => s.selectedDeviceId)
  const vehicleCount       = useTrafficStore((s) => s.vehicleCount)
  const passedInCount      = useTrafficStore((s) => s.passedInCount)
  const passedOutCount     = useTrafficStore((s) => s.passedOutCount)
  const passedCount        = useTrafficStore((s) => s.passedCount)
  const alertLevel         = useTrafficStore((s) => s.alertLevel)
  const realtimeHistory    = useTrafficStore((s) => s.realtimeHistory)
  const realtimeOccHistory = useTrafficStore((s) => s.realtimeOccupancyHistory)
  const activeAlerts       = useTrafficStore((s) => s.activeAlerts)
  const isDeviceOnline     = useTrafficStore((s) => s.isDeviceOnline)
  const lineY              = useTrafficStore((s) => s.lineY)
  const storeResolveAlert  = useTrafficStore((s) => s.resolveAlert)
  // 0002 新增指标
  const occupancy          = useTrafficStore((s) => s.occupancy)
  const losGrade           = useTrafficStore((s) => s.losGrade)
  const avgSpeedKmh        = useTrafficStore((s) => s.avgSpeedKmh)
  const avgHeadwaySec      = useTrafficStore((s) => s.avgHeadwaySec)
  const queueLength        = useTrafficStore((s) => s.queueLength)
  const wrongWayActive     = useTrafficStore((s) => s.wrongWayActive)
  const speedCalibrated    = useTrafficStore((s) => s.speedCalibrated)

  const { isConnected } = useStreamSocket(selectedDeviceId)
  const [healthReport, setHealthReport] = useState<HealthReportMsg | null>(null)
  useHealthSocket({ onReport: setHealthReport })
  const { mutate: resolveAlertApi } = useResolveAlert()

  const deviceHealth = healthReport?.devices.find((d) => d.device_id === selectedDeviceId) ?? null
  const serverHealth = healthReport?.server ?? null

  const handleResolveAlert = (alertId: number) => {
    storeResolveAlert(alertId)
    resolveAlertApi({ id: alertId, resolved_by: 'manual' })
  }

  const deviceStatus: 'online' | 'offline' | 'warning' = !isConnected
    ? 'offline'
    : isDeviceOnline
    ? alertLevel > 0 ? 'warning' : 'online'
    : 'offline'

  const alertColor = alertLevelColor(alertLevel)

  // 预警等级强度相关样式
  const videoBorderColor =
    alertLevel >= 3 ? ALERT_COLORS[Math.min(alertLevel, 5)] : '#00D4FF'

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden p-2.5">

      {/* ═══ 主内容区（三大列） ════════════════════════════════════════════ */}
      <div className="flex min-h-0 flex-1 gap-2">

        {/* ══ LEFT — 7 张数据卡片 ══════════════════════════════════════════ */}
        <div className="flex w-[200px] flex-shrink-0 flex-col gap-2">

          {/* 卡片 1：当前车辆数 */}
          <StatCard
            label="当前车辆"
            accent={alertColor}
            alert={alertLevel > 0}
          >
            <div className="flex items-baseline gap-1.5">
              <span
                className="font-mono text-3xl font-black tabular-nums leading-none"
                style={{ color: alertColor, textShadow: `0 0 12px ${alertColor}50` }}
              >
                <RollingNumber value={vehicleCount} color={alertColor} />
              </span>
              <span className="font-display text-[9px] text-text-secondary/50">辆</span>
            </div>
          </StatCard>

          {/* 卡片 2：累计过线（分方向） */}
          <StatCard label="累计过线">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 font-mono text-[9px] text-[#00E676]/70">
                  <span>↑</span><span>驶入</span>
                </span>
                <span className="font-mono text-sm font-bold text-[#00E676] tabular-nums">
                  <RollingNumber value={passedInCount} color="#00E676" />
                </span>
              </div>
              <div className="h-px bg-white/[0.05]" />
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 font-mono text-[9px] text-[#00D4FF]/70">
                  <span>↓</span><span>驶出</span>
                </span>
                <span className="font-mono text-sm font-bold text-[#00D4FF] tabular-nums">
                  <RollingNumber value={passedOutCount} color="#00D4FF" />
                </span>
              </div>
            </div>
          </StatCard>

          {/* 卡片 3：占道率 + LOS */}
          <StatCard
            label="道路占用率"
            accent={LOS_COLOR[losGrade] ?? '#00D4FF'}
            alert={losGrade === 'E' || losGrade === 'F'}
          >
            <OccupancyBar occupancy={occupancy} losGrade={losGrade} />
          </StatCard>

          {/* 卡片 4：平均速度 */}
          <StatCard label="平均速度" accent="#ffcc00">
            {speedCalibrated && avgSpeedKmh !== null ? (
              <div className="flex items-baseline gap-1">
                <span
                  className="font-mono text-2xl font-bold tabular-nums leading-none"
                  style={{ color: '#ffcc00', textShadow: '0 0 10px #ffcc0040' }}
                >
                  <RollingNumber value={avgSpeedKmh} color="#ffcc00" format={(v) => v.toFixed(1)} />
                </span>
                <span className="font-display text-[9px] text-text-secondary/50">km/h</span>
              </div>
            ) : (
              <span className="font-mono text-[11px] text-text-secondary/40">
                {speedCalibrated ? '—' : '未标定'}
              </span>
            )}
          </StatCard>

          {/* 卡片 5：车头时距 */}
          <StatCard label="车头时距" accent="#a78bfa">
            {avgHeadwaySec !== null ? (
              <div className="flex items-baseline gap-1">
                <span
                  className="font-mono text-2xl font-bold tabular-nums leading-none"
                  style={{ color: '#a78bfa', textShadow: '0 0 10px #a78bfa40' }}
                >
                  <RollingNumber value={avgHeadwaySec} color="#a78bfa" format={(v) => v.toFixed(1)} />
                </span>
                <span className="font-display text-[9px] text-text-secondary/50">s</span>
                {avgHeadwaySec < 1.5 && (
                  <span className="ml-1 rounded-sm bg-[#ff9500]/10 px-1 font-display text-[7px] text-[#ff9500]">
                    密集
                  </span>
                )}
              </div>
            ) : (
              <span className="font-mono text-[11px] text-text-secondary/40">—</span>
            )}
          </StatCard>

          {/* 卡片 6：当前预警等级 */}
          <StatCard
            label="预警状态"
            accent={alertColor}
            alert={alertLevel > 1}
          >
            <AlertLevelBadge level={alertLevel} />
          </StatCard>

          {/* 卡片 7：设备状态 */}
          <StatCard label="设备状态" className="mt-auto">
            <div className="flex items-center gap-2">
              <StatusDot status={deviceStatus} size="sm" />
              <div className="flex flex-col">
                <span className="font-display text-[9px] font-bold tracking-[0.15em] text-text-primary uppercase">
                  {isConnected ? (isDeviceOnline ? '在线' : 'STM32 离线') : '未连接'}
                </span>
                <span className="font-mono text-[8px] text-text-secondary/40">
                  DEV-{String(selectedDeviceId).padStart(2, '0')}
                </span>
              </div>
              {deviceHealth && (
                <span className="ml-auto font-mono text-[10px] tabular-nums text-text-secondary/55">
                  {deviceHealth.fps.toFixed(1)} fps
                </span>
              )}
            </div>
            {/* 逆行 / 排队警示标签 */}
            <div className="mt-1.5 flex flex-wrap gap-1">
              {wrongWayActive && (
                <span className="rounded-sm bg-[#ff2d55]/10 px-1.5 py-0.5 font-display text-[7px] font-bold text-[#ff2d55] border border-[#ff2d55]/30">
                  逆行检测
                </span>
              )}
              {queueLength >= 3 && (
                <span className="rounded-sm bg-[#ff9500]/10 px-1.5 py-0.5 font-display text-[7px] font-bold text-[#ff9500] border border-[#ff9500]/30">
                  排队 {queueLength} 辆
                </span>
              )}
            </div>
          </StatCard>

        </div>

        {/* ══ CENTER — 视频面板 ═════════════════════════════════════════════ */}
        <motion.div
          className="min-h-0 flex-1"
          animate={
            alertLevel >= 3
              ? {
                  filter: [
                    `drop-shadow(0 0 0px ${videoBorderColor}00)`,
                    `drop-shadow(0 0 12px ${videoBorderColor}80)`,
                    `drop-shadow(0 0 0px ${videoBorderColor}00)`,
                  ],
                }
              : {}
          }
          transition={{ duration: alertLevel >= 4 ? 0.5 : 1.2, repeat: Infinity }}
        >
          <VideoPanel
            isConnected={isConnected}
            alertLevel={alertLevel}
            droppedFrames={deviceHealth?.dropped_frames}
            fps={deviceHealth?.fps}
            deviceId={selectedDeviceId}
          />
        </motion.div>

        {/* ══ RIGHT — 轨迹画布 + 折线图 + 预警列表 ════════════════════════ */}
        <div className="flex w-[300px] flex-shrink-0 flex-col gap-2">

          {/* 轨迹画布 */}
          <HudPanel
            title="轨迹投影"
            titleRight={
              <span className="font-mono text-[8px] text-text-secondary/40">
                {useTrafficStore.getState().trackHistoryMap.size} tracks
              </span>
            }
            noPadding
            className="flex-shrink-0"
          >
            <TrajectoryCanvas lineY={lineY} className="h-[160px] w-full" />
          </HudPanel>

          {/* 实时折线图：车辆数 + 占道率双线 */}
          <HudPanel
            title="实时趋势"
            titleRight={
              <span className="font-mono text-[8px] text-text-secondary/40">
                {realtimeHistory.length} pts
              </span>
            }
            className="flex-shrink-0"
          >
            <div className="flex flex-col gap-2">
              <RealtimeChart
                data={realtimeHistory}
                height={56}
                color="#00D4FF"
                yDomain={[0, 'auto']}
              />
              <div className="h-px bg-white/[0.04]" />
              <RealtimeChart
                data={realtimeOccHistory}
                height={46}
                color={LOS_COLOR[losGrade] ?? '#34c759'}
                yDomain={[0, 100]}
              />
              <div className="flex justify-between font-mono text-[8px] text-text-secondary/35">
                <span style={{ color: '#00D4FF' }}>● 车辆数</span>
                <span style={{ color: LOS_COLOR[losGrade] }}>● 占道率%</span>
              </div>
            </div>
          </HudPanel>

          {/* 活跃预警列表 */}
          <AlertPanel
            activeAlerts={activeAlerts}
            alertLevel={alertLevel}
            onResolve={handleResolveAlert}
          />

        </div>
      </div>

      {/* ═══ 底部全宽状态条 ═══════════════════════════════════════════════ */}
      <BottomStatusBar
        server={serverHealth}
        device={deviceHealth}
        isConnected={isConnected}
        deviceStatus={deviceStatus}
        passedCount={passedCount}
      />

    </div>
  )
}
