/**
 * 实时监控仪表盘 — HUD 科技风重设计
 *
 * 布局（三列 + 底部健康栏）：
 * ┌──────────────┬────────────────────────────┬──────────────┐
 * │  LEFT 21%    │      CENTER flex-1         │  RIGHT 23%   │
 * │              │                            │              │
 * │  环形仪表     │   ┌──────────────────┐    │  预警等级     │
 * │  （车辆数）   │   │  VideoPanel      │    │  推理延迟     │
 * │              │   │  全 HUD 风格      │    │  队列状态     │
 * │  流量统计     │   └──────────────────┘    │              │
 * │  ↑驶入  ↓驶出 │                            │  活跃预警列表 │
 * │  累计过线     │   近 60s 折线图             │              │
 * └──────────────┴────────────────────────────┴──────────────┘
 * ├─────────────────── 底部系统健康栏 ───────────────────────┤
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion'
import { useTrafficStore } from '@/store/useTrafficStore'
import { useStreamSocket } from '@/hooks/useStreamSocket'
import { useHealthSocket } from '@/hooks/useHealthSocket'
import { useResolveAlert } from '@/lib/api'
import { alertLevelLabel, alertLevelColor } from '@/lib/utils'
import { AlertList } from '@/components/ui/AlertList'
import { StatusDot } from '@/components/ui/StatusDot'
import { VideoPanel } from '@/components/video/VideoPanel'
import { RealtimeChart } from '@/components/charts/RealtimeChart'
import { CircularGauge } from '@/components/ui/CircularGauge'
import { HudCorners } from '@/components/video/HudCorners'
import { HudPanel } from '@/components/ui/HudPanel'
import type { HealthReportMsg, DeviceHealthStats, ServerStats } from '@/types/websocket'

// ─────────────────────────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────────────────────────

function formatUptime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// ─────────────────────────────────────────────────────────────────────────────
// 小型滚动数字
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
// 流量方向指标（带动画箭头）
// ─────────────────────────────────────────────────────────────────────────────

interface FlowRowProps {
  direction: 'in' | 'out'
  value: number
  label: string
}

function FlowRow({ direction, value, label }: FlowRowProps) {
  const isIn   = direction === 'in'
  const accent = isIn ? '#00E676' : '#00D4FF'

  return (
    <div className="flex items-center gap-2.5">
      {/* 图标方块 */}
      <motion.div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-sm"
        style={{
          background: `${accent}12`,
          border: `1px solid ${accent}28`,
        }}
        animate={{
          boxShadow: [
            `0 0 4px ${accent}1a`,
            `0 0 10px ${accent}50`,
            `0 0 4px ${accent}1a`,
          ],
        }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.span
          className="font-mono text-sm font-bold leading-none"
          style={{ color: accent }}
          animate={{ y: isIn ? [-1.5, 1.5, -1.5] : [1.5, -1.5, 1.5] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          {isIn ? '↑' : '↓'}
        </motion.span>
      </motion.div>

      {/* 数值 */}
      <div className="flex min-w-0 flex-col gap-0">
        <span className="text-[9px] tracking-[0.18em] text-text-secondary/55 uppercase">{label}</span>
        <span
          className="font-mono text-xl font-bold leading-none tabular-nums"
          style={{ color: accent, textShadow: `0 0 10px ${accent}40` }}
        >
          <RollingNumber value={value} color={accent} />
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 预警等级显示器
// ─────────────────────────────────────────────────────────────────────────────

const ALERT_COLORS = ['#00D4FF', '#4FC3F7', '#FFD600', '#FF9800', '#F44336', '#FF3B5C']
const ALERT_CN    = ['正常运行', '轻度拥堵', '中度拥堵', '严重拥堵', '极度拥堵', '交通瘫痪']

function AlertLevelDisplay({ level }: { level: number }) {
  const clamped = Math.min(Math.max(level, 0), 5)
  const color   = ALERT_COLORS[clamped]
  const label   = ALERT_CN[clamped]

  return (
    <div className="flex flex-col items-center gap-3 py-1">
      {/* 环形涟漪 + 中心圆 */}
      <div className="relative flex items-center justify-center">
        {clamped > 0 && (
          <>
            {[0, 0.6].map((delay) => (
              <motion.div
                key={delay}
                className="absolute rounded-full"
                style={{ width: 52, height: 52, border: `1px solid ${color}` }}
                animate={{ scale: [1, 2.0], opacity: [0.45, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut', delay }}
              />
            ))}
          </>
        )}

        <motion.div
          className="relative flex h-[52px] w-[52px] items-center justify-center rounded-full"
          style={{
            background: `${color}12`,
            border: `2px solid ${color}`,
          }}
          animate={
            clamped > 0
              ? {
                  boxShadow: [
                    `0 0 8px ${color}30`,
                    `0 0 22px ${color}65`,
                    `0 0 8px ${color}30`,
                  ],
                }
              : { boxShadow: `0 0 8px ${color}30` }
          }
          transition={{ duration: 1.2, repeat: Infinity }}
        >
          <span
            className="font-display text-xl font-black leading-none"
            style={{ color, textShadow: `0 0 10px ${color}70` }}
          >
            L{clamped}
          </span>
        </motion.div>
      </div>

      {/* 文字标签 */}
      <motion.p
        className="font-display text-[10px] font-bold tracking-[0.18em] uppercase"
        style={{ color }}
        animate={clamped > 0 ? { opacity: [1, 0.55, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {label}
      </motion.p>

      {/* 5 格等级条 */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((l) => (
          <motion.div
            key={l}
            className="h-[14px] w-3 rounded-sm"
            style={{
              background: l <= clamped ? `${ALERT_COLORS[l]}` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${l <= clamped ? ALERT_COLORS[l] : 'rgba(255,255,255,0.08)'}`,
              boxShadow: l <= clamped ? `0 0 5px ${ALERT_COLORS[l]}60` : 'none',
            }}
            animate={l === clamped && clamped > 0 ? { opacity: [0.7, 1, 0.7] } : {}}
            transition={{ duration: 0.8, repeat: Infinity, delay: l * 0.12 }}
          />
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 推理延迟进度条
// ─────────────────────────────────────────────────────────────────────────────

function InferenceBar({ value }: { value: number }) {
  const MAX_MS  = 50
  const pct     = Math.min(value / MAX_MS, 1) * 100
  let barColor  = '#00E676'
  if (value > 40) barColor = '#F44336'
  else if (value > 30) barColor = '#FF9800'
  else if (value > 20) barColor = '#FFD600'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span
          className="font-mono text-2xl font-bold tabular-nums leading-none"
          style={{ color: barColor, textShadow: `0 0 12px ${barColor}50` }}
        >
          <RollingNumber value={value} color={barColor} format={(v) => v.toFixed(1)} />
        </span>
        <span className="font-mono text-[10px] text-text-secondary/60">ms</span>
      </div>

      {/* 进度条 */}
      <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
        <motion.div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ background: barColor, boxShadow: `0 0 6px ${barColor}70` }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>

      <div className="flex justify-between font-mono text-[8px] text-text-secondary/30">
        <span>0</span>
        <span>25ms</span>
        <span>50ms</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 系统健康仪表（底部栏）
// ─────────────────────────────────────────────────────────────────────────────

interface HealthBarGaugeProps {
  label: string
  value: number
  max?: number
  unit?: string
  warn?: number
  danger?: number
}

function HealthBarGauge({ label, value, max = 100, unit = '%', warn, danger }: HealthBarGaugeProps) {
  const pct  = (value / max) * 100
  let color  = '#00E676'
  if (danger !== undefined && value >= danger) color = '#F44336'
  else if (warn !== undefined && value >= warn) color = '#FF9800'

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-1">
        <span className="font-display text-[8px] tracking-[0.18em] text-text-secondary/55 uppercase">
          {label}
        </span>
        <span className="font-mono text-[10px] font-medium tabular-nums" style={{ color }}>
          {typeof value === 'number' && Number.isFinite(value)
            ? value.toFixed(value < 10 ? 1 : 0)
            : '--'}
          {unit}
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

interface HealthTextProps {
  label: string
  value: string
  warn?: boolean
  danger?: boolean
}

function HealthText({ label, value, warn, danger }: HealthTextProps) {
  const color = danger ? 'var(--color-alert-l4)' : warn ? 'var(--color-alert-l3)' : undefined
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-display text-[8px] tracking-[0.18em] text-text-secondary/55 uppercase">
        {label}
      </span>
      <span className="font-mono text-[10px] font-medium text-text-primary" style={{ color }}>
        {value}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 底部健康数据栏
// ─────────────────────────────────────────────────────────────────────────────

function HealthBar({
  server,
  device,
  isConnected,
  deviceStatus,
}: {
  server: ServerStats | null
  device: DeviceHealthStats | null
  isConnected: boolean
  deviceStatus: 'online' | 'offline' | 'warning'
}) {
  const degradationLevel = device?.degradation_level ?? 0

  return (
    <div
      className="relative flex flex-shrink-0 items-start gap-4 overflow-hidden rounded-sm bg-bg-panel px-4 py-3"
      style={{ border: '1px solid rgba(0,212,255,0.08)' }}
    >
      <HudCorners color="#00D4FF" length={8} thickness={1} pulse={false} />

      {/* 连接状态 */}
      <div className="flex flex-shrink-0 items-center gap-2 border-r pr-4" style={{ borderColor: 'rgba(0,212,255,0.1)' }}>
        <StatusDot status={deviceStatus} size="sm" />
        <span className="font-display text-[9px] tracking-[0.15em] text-text-secondary/70 uppercase">
          {isConnected
            ? device?.is_active ? 'ONLINE' : 'IDLE'
            : 'OFFLINE'}
        </span>
      </div>

      {/* 降级标签 */}
      {degradationLevel > 0 && (
        <div className="flex flex-shrink-0 items-center self-center border-r pr-4" style={{ borderColor: 'rgba(0,212,255,0.1)' }}>
          <span
            className="rounded-sm px-2 py-0.5 font-display text-[8px] font-bold tracking-[0.2em] uppercase"
            style={{
              background: `${ALERT_COLORS[Math.min(degradationLevel + 1, 5)]}15`,
              color: ALERT_COLORS[Math.min(degradationLevel + 1, 5)],
              border: `1px solid ${ALERT_COLORS[Math.min(degradationLevel + 1, 5)]}35`,
            }}
          >
            L{degradationLevel} 降级
          </span>
        </div>
      )}

      {/* 服务器指标 */}
      {server && (
        <div className="grid flex-1 grid-cols-3 gap-x-4 gap-y-1 border-r pr-4" style={{ borderColor: 'rgba(0,212,255,0.1)' }}>
          <HealthBarGauge label="CPU" value={server.cpu_percent} warn={70} danger={90} />
          <HealthBarGauge label="内存" value={server.memory_percent} warn={80} danger={90} />
          {server.gpu_percent !== null ? (
            <HealthBarGauge label="GPU" value={server.gpu_percent ?? 0} warn={80} danger={95} />
          ) : (
            <HealthBarGauge label="GPU" value={0} />
          )}
        </div>
      )}

      {/* 设备级指标 */}
      {device && (
        <div className="flex flex-shrink-0 items-start gap-4">
          <HealthText
            label="FPS"
            value={device.fps.toFixed(1)}
            warn={device.fps < 15 && device.is_active}
            danger={device.fps < 5 && device.is_active}
          />
          <HealthText
            label="延迟"
            value={`${device.avg_inference_ms.toFixed(1)}ms`}
            warn={device.avg_inference_ms > 40}
            danger={device.avg_inference_ms > 50}
          />
          <HealthText
            label="队列"
            value={`${device.raw_queue_size}/${device.ws_queue_size}/${device.db_queue_size}`}
            warn={device.raw_queue_size >= 2 || device.ws_queue_size >= 2}
          />
          <HealthText
            label="丢帧/min"
            value={String(device.dropped_frames)}
            warn={device.dropped_frames > 5}
            danger={device.dropped_frames > 10}
          />
        </div>
      )}

      {server && (
        <div className="ml-auto flex-shrink-0">
          <HealthText label="运行时长" value={formatUptime(server.uptime_seconds)} />
        </div>
      )}

      {!server && !device && (
        <span className="self-center text-[9px] text-text-secondary/35">健康数据等待中…</span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 主仪表盘
// ─────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const selectedDeviceId  = useTrafficStore((s) => s.selectedDeviceId)
  const vehicleCount      = useTrafficStore((s) => s.vehicleCount)
  const passedCount       = useTrafficStore((s) => s.passedCount)
  const passedInCount     = useTrafficStore((s) => s.passedInCount)
  const passedOutCount    = useTrafficStore((s) => s.passedOutCount)
  const alertLevel        = useTrafficStore((s) => s.alertLevel)
  const realtimeHistory   = useTrafficStore((s) => s.realtimeHistory)
  const activeAlerts      = useTrafficStore((s) => s.activeAlerts)
  const inferenceMs       = useTrafficStore((s) => s.inferenceMs)
  const isDeviceOnline    = useTrafficStore((s) => s.isDeviceOnline)
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

  const deviceStatus: 'online' | 'offline' | 'warning' = !isConnected
    ? 'offline'
    : isDeviceOnline
    ? alertLevel > 0
      ? 'warning'
      : 'online'
    : 'offline'

  const alertColor = alertLevelColor(alertLevel)

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden p-3">

      {/* ── 主内容区（三列） ────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 gap-3">

        {/* ════ LEFT COLUMN — 环形仪表 + 流量统计 ════ */}
        <div className="flex w-[21%] flex-shrink-0 flex-col gap-3">

          {/* 车辆数环形仪表 */}
          <HudPanel
            title="当前车辆"
            titleRight={
              <span
                className="font-display text-[8px] tracking-[0.15em] uppercase"
                style={{ color: alertColor }}
              >
                {alertLevelLabel(alertLevel)}
              </span>
            }
            cornerColor={alertLevel > 0 ? alertColor : '#00D4FF'}
            className="flex-shrink-0"
          >
            <div className="flex flex-col items-center gap-2 py-1">
              {/* 仪表 */}
              <div className="relative">
                {/* 外圈涟漪（仅有车辆时显示） */}
                {vehicleCount > 0 && (
                  <>
                    {[0, 0.8].map((delay) => (
                      <motion.div
                        key={delay}
                        className="absolute inset-0 m-auto rounded-full"
                        style={{
                          width: 120,
                          height: 120,
                          border: `1px solid ${alertColor}`,
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          position: 'absolute',
                        }}
                        animate={{ scale: [1, 1.5], opacity: [0.3, 0] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut', delay }}
                      />
                    ))}
                  </>
                )}
                <CircularGauge
                  value={vehicleCount}
                  max={50}
                  color={alertLevel > 0 ? alertColor : '#00D4FF'}
                  size={148}
                  label="辆"
                  sublabel={`MAX 50`}
                  warnThreshold={30}
                  dangerThreshold={45}
                />
              </div>

              {/* 累计过线 */}
              <div
                className="flex w-full items-center justify-between rounded-sm px-2 py-1.5"
                style={{ background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.1)' }}
              >
                <span className="font-display text-[8px] tracking-[0.18em] text-text-secondary/55 uppercase">
                  累计
                </span>
                <span className="font-mono text-sm font-bold text-text-primary tabular-nums">
                  <RollingNumber value={passedCount} />
                </span>
              </div>
            </div>
          </HudPanel>

          {/* 方向流量统计 */}
          <HudPanel title="流量方向" className="flex-shrink-0">
            <div className="flex flex-col gap-3">
              <FlowRow direction="in"  value={passedInCount}  label="驶入" />
              <div className="h-px" style={{ background: 'rgba(0,212,255,0.07)' }} />
              <FlowRow direction="out" value={passedOutCount} label="驶出" />
            </div>
          </HudPanel>

          {/* 连接状态 */}
          <HudPanel title="设备状态" className="flex-shrink-0">
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
          </HudPanel>

        </div>

        {/* ════ CENTER COLUMN — 视频 + 图表 ════ */}
        <div className="flex min-h-0 flex-1 flex-col gap-3">

          {/* 视频面板（填充剩余高度） */}
          <div className="min-h-0 flex-1">
            <VideoPanel
              isConnected={isConnected}
              alertLevel={alertLevel}
              droppedFrames={deviceHealth?.dropped_frames}
              fps={deviceHealth?.fps}
              deviceId={selectedDeviceId}
            />
          </div>

          {/* 近 60s 折线图 */}
          <HudPanel title="近 60s 车流量" titleRight={
            <span className="font-mono text-[8px] text-text-secondary/40">
              {realtimeHistory.length} pts
            </span>
          } className="flex-shrink-0">
            <RealtimeChart data={realtimeHistory} height={76} />
          </HudPanel>

        </div>

        {/* ════ RIGHT COLUMN — 预警 + 性能 + 预警列表 ════ */}
        <div className="flex w-[23%] flex-shrink-0 flex-col gap-3">

          {/* 预警等级 */}
          <HudPanel
            title="预警状态"
            cornerColor={alertLevel > 0 ? alertColor : '#00D4FF'}
            className="flex-shrink-0"
          >
            <AlertLevelDisplay level={alertLevel} />
          </HudPanel>

          {/* 推理延迟 */}
          <HudPanel title="推理延迟" className="flex-shrink-0">
            <InferenceBar value={inferenceMs} />

            {/* 队列状态 */}
            {deviceHealth && (
              <div
                className="mt-3 flex items-center justify-between rounded-sm px-2 py-1.5"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <span className="font-display text-[8px] tracking-[0.15em] text-text-secondary/50 uppercase">
                  Queue R/W/D
                </span>
                <span
                  className="font-mono text-[10px] tabular-nums"
                  style={{
                    color:
                      deviceHealth.raw_queue_size >= 4 || deviceHealth.ws_queue_size >= 4
                        ? 'var(--color-alert-l4)'
                        : deviceHealth.raw_queue_size >= 2 || deviceHealth.ws_queue_size >= 2
                        ? 'var(--color-alert-l3)'
                        : 'rgba(122,144,179,0.7)',
                  }}
                >
                  {deviceHealth.raw_queue_size}/{deviceHealth.ws_queue_size}/{deviceHealth.db_queue_size}
                </span>
              </div>
            )}
          </HudPanel>

          {/* 活跃预警列表（可滚动，填充剩余高度） */}
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-sm bg-bg-panel" style={{ border: '1px solid rgba(0,212,255,0.1)' }}>
            <HudCorners color="#00D4FF" length={10} thickness={1} pulse={false} />

            {/* 标题 */}
            <div
              className="flex flex-shrink-0 items-center justify-between border-b px-3 py-[7px]"
              style={{ borderColor: 'rgba(0,212,255,0.1)' }}
            >
              <div className="flex items-center gap-2">
                {activeAlerts.length > 0 ? (
                  <motion.span
                    className="block h-[5px] w-[5px] rounded-full bg-alert-l4"
                    style={{ boxShadow: '0 0 5px var(--color-alert-l4)' }}
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                ) : (
                  <span className="block h-[5px] w-[5px] rounded-full bg-online" style={{ boxShadow: '0 0 5px var(--color-online)' }} />
                )}
                <span className="font-display text-[9px] font-bold tracking-[0.22em] text-text-secondary uppercase">
                  活跃预警
                </span>
              </div>
              <AnimatePresence>
                {activeAlerts.length > 0 && (
                  <motion.span
                    key="count"
                    className="rounded-sm px-1.5 py-0.5 font-mono text-[8px] font-bold text-alert-l4"
                    style={{ background: 'rgba(244,67,54,0.1)', border: '1px solid rgba(244,67,54,0.25)' }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    {activeAlerts.length}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {/* 列表 */}
            <div className="flex-1 overflow-y-auto p-2">
              <AlertList
                alerts={activeAlerts}
                maxItems={8}
                onResolve={handleResolveAlert}
              />
            </div>
          </div>

        </div>
      </div>

      {/* ── 底部系统健康栏 ──────────────────────────────────────── */}
      <HealthBar
        server={serverHealth}
        device={deviceHealth}
        isConnected={isConnected}
        deviceStatus={deviceStatus}
      />

    </div>
  )
}
