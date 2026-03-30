/**
 * MetricsColumn — 左侧 7 张数据卡片列
 *
 * 包含三个内部子组件（StatCard / OccupancyBar / AlertLevelBadge），
 * 均为该列专用，不对外暴露，避免接口冗余。
 */
import { motion } from 'framer-motion'
import { useTrafficStore } from '@/store/useTrafficStore'
import { StatusDot }    from '@/components/ui/StatusDot'
import { RollingNumber } from '@/components/ui/RollingNumber'
import { alertLevelHex } from '@/lib/utils'
import type { DeviceHealthStats } from '@/types/websocket'

// ── 常量 ─────────────────────────────────────────────────────────────────────
const ALERT_CN = ['正常运行', '轻度拥堵', '中度拥堵', '严重拥堵', '极度拥堵', '交通瘫痪']
const LOS_COLOR: Record<string, string> = {
  A: '#34c759', B: '#8bc34a', C: '#ffcc00', D: '#ff9500', E: '#ff3b30', F: '#c0392b',
}
const LOS_LABEL: Record<string, string> = {
  A: '畅通', B: '稳定', C: '临界', D: '不稳定', E: '拥挤', F: '严重拥堵',
}

// ── StatCard ─────────────────────────────────────────────────────────────────
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
      animate={alert ? { borderColor: [accent, `${accent}40`, accent] } : {}}
      transition={{ duration: 1.4, repeat: Infinity }}
    >
      <span className="font-display text-[8px] tracking-[0.18em] text-text-secondary/50 uppercase select-none">
        {label}
      </span>
      {children}
    </motion.div>
  )
}

// ── OccupancyBar ─────────────────────────────────────────────────────────────
function OccupancyBar({ occupancy, losGrade }: { occupancy: number; losGrade: string }) {
  const pct   = Math.round(occupancy * 100)
  const color = LOS_COLOR[losGrade] ?? '#00D4FF'
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span style={{ textShadow: `0 0 10px ${color}50` }}>
          <RollingNumber
            value={pct}
            color={color}
            className="font-mono text-xl font-bold tabular-nums leading-none"
            format={(v) => `${Math.round(v)}%`}
          />
        </span>
        <span
          className="rounded-sm px-1.5 py-0.5 font-display text-[8px] font-bold tracking-widest"
          style={{ background: `${color}18`, border: `1px solid ${color}40`, color }}
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

// ── AlertLevelBadge ──────────────────────────────────────────────────────────
function AlertLevelBadge({ level }: { level: number }) {
  const clamped = Math.min(Math.max(level, 0), 5)
  const color   = alertLevelHex(clamped)
  const label   = ALERT_CN[clamped]
  return (
    <div className="flex items-center gap-2.5">
      {/* 圆环 + 等级数字 */}
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
        {/* 等级文字 */}
        <motion.span
          className="font-display text-[10px] font-bold tracking-widest uppercase"
          style={{ color }}
          animate={clamped > 0 ? { opacity: [1, 0.5, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {label}
        </motion.span>
        {/* 5 格等级条 */}
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((l) => {
            const barColor = alertLevelHex(l)
            return (
              <div
                key={l}
                className="h-[10px] w-2.5 rounded-sm transition-all duration-300"
                style={{
                  background: l <= clamped ? barColor : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${l <= clamped ? barColor : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: l <= clamped ? `0 0 4px ${barColor}60` : 'none',
                }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── VehicleGauge — 车辆数圆弧仪表 ────────────────────────────────────────────
function VehicleGauge({ count, color }: { count: number; color: string }) {
  const MAX_VEHICLES = 50
  const R   = 18
  const C   = 2 * Math.PI * R   // ≈ 113.1
  const fill = Math.min((count / MAX_VEHICLES) * C, C)
  return (
    <svg
      width={44} height={44}
      viewBox="0 0 44 44"
      className="-ml-1 flex-shrink-0"
      aria-hidden
    >
      {/* 背景环 */}
      <circle cx={22} cy={22} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
      {/* 填充弧 */}
      <circle
        cx={22} cy={22} r={R} fill="none"
        stroke={color} strokeWidth={3} strokeLinecap="round"
        strokeDasharray={`${fill} ${C}`}
        transform="rotate(-90 22 22)"
        style={{ transition: 'stroke-dasharray 0.5s ease, stroke 0.3s ease' }}
      />
    </svg>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────────
interface MetricsColumnProps {
  /** WebSocket 连接状态（来自 Dashboard 的 useStreamSocket） */
  isConnected: boolean
  deviceHealth: DeviceHealthStats | null
}

export function MetricsColumn({ isConnected, deviceHealth }: MetricsColumnProps) {
  const selectedDeviceId = useTrafficStore((s) => s.selectedDeviceId)
  const vehicleCount     = useTrafficStore((s) => s.vehicleCount)
  const passedInCount    = useTrafficStore((s) => s.passedInCount)
  const passedOutCount   = useTrafficStore((s) => s.passedOutCount)
  const alertLevel       = useTrafficStore((s) => s.alertLevel)
  const isDeviceOnline   = useTrafficStore((s) => s.isDeviceOnline)
  const occupancy        = useTrafficStore((s) => s.occupancy)
  const losGrade         = useTrafficStore((s) => s.losGrade)
  const avgSpeedKmh      = useTrafficStore((s) => s.avgSpeedKmh)
  const speedCalibrated  = useTrafficStore((s) => s.speedCalibrated)
  const avgHeadwaySec    = useTrafficStore((s) => s.avgHeadwaySec)
  const wrongWayActive   = useTrafficStore((s) => s.wrongWayActive)
  const queueLength      = useTrafficStore((s) => s.queueLength)

  const alertColor = alertLevelHex(alertLevel)
  const losColor   = LOS_COLOR[losGrade] ?? '#00D4FF'

  const deviceStatusLabel = isConnected
    ? (isDeviceOnline ? '在线' : 'STM32 离线')
    : '未连接'
  const deviceStatus: 'online' | 'offline' | 'warning' =
    !isConnected ? 'offline' :
    isDeviceOnline ? (alertLevel > 0 ? 'warning' : 'online') : 'offline'

  return (
    <div className="flex w-[210px] flex-shrink-0 flex-col gap-2">

      {/* ── 卡片 1：当前车辆数（含圆弧仪表） ─────────────────────────────── */}
      <StatCard label="当前车辆" accent={alertColor} alert={alertLevel > 0}>
        <div className="flex items-center gap-1">
          <VehicleGauge count={vehicleCount} color={alertColor} />
          <div className="flex flex-col">
            <div
              className="font-mono text-3xl font-black tabular-nums leading-none"
              style={{ color: alertColor, textShadow: `0 0 12px ${alertColor}50` }}
            >
              <RollingNumber value={vehicleCount} color={alertColor} />
            </div>
            <span className="font-display text-[8px] text-text-secondary/40">辆 在场</span>
          </div>
        </div>
      </StatCard>

      {/* ── 卡片 2：累计过线（分方向） ───────────────────────────────────── */}
      <StatCard label="累计过线">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 font-mono text-[9px] text-[#00E676]/70">
              <span>↑</span><span>驶入</span>
            </span>
            <RollingNumber
              value={passedInCount}
              color="#00E676"
              className="font-mono text-sm font-bold tabular-nums"
            />
          </div>
          <div className="h-px bg-white/[0.05]" />
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 font-mono text-[9px] text-[#00D4FF]/70">
              <span>↓</span><span>驶出</span>
            </span>
            <RollingNumber
              value={passedOutCount}
              color="#00D4FF"
              className="font-mono text-sm font-bold tabular-nums"
            />
          </div>
        </div>
      </StatCard>

      {/* ── 卡片 3：占道率 + LOS ─────────────────────────────────────────── */}
      <StatCard
        label="道路占用率"
        accent={losColor}
        alert={losGrade === 'E' || losGrade === 'F'}
      >
        <OccupancyBar occupancy={occupancy} losGrade={losGrade} />
      </StatCard>

      {/* ── 卡片 4：平均速度 ──────────────────────────────────────────────── */}
      <StatCard label="平均速度" accent="#ffcc00">
        {speedCalibrated && avgSpeedKmh !== null ? (
          <div className="flex items-baseline gap-1">
            <span style={{ textShadow: '0 0 10px #ffcc0040' }}>
              <RollingNumber
                value={avgSpeedKmh}
                color="#ffcc00"
                className="font-mono text-2xl font-bold tabular-nums leading-none"
                format={(v) => v.toFixed(1)}
              />
            </span>
            <span className="font-display text-[9px] text-text-secondary/50">km/h</span>
          </div>
        ) : (
          <span className="font-mono text-[11px] text-text-secondary/40">
            {speedCalibrated ? '—' : '未标定'}
          </span>
        )}
      </StatCard>

      {/* ── 卡片 5：车头时距 ──────────────────────────────────────────────── */}
      <StatCard label="车头时距" accent="#a78bfa">
        {avgHeadwaySec !== null ? (
          <div className="flex items-baseline gap-1">
            <span style={{ textShadow: '0 0 10px #a78bfa40' }}>
              <RollingNumber
                value={avgHeadwaySec}
                color="#a78bfa"
                className="font-mono text-2xl font-bold tabular-nums leading-none"
                format={(v) => v.toFixed(1)}
              />
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

      {/* ── 卡片 6：预警状态 ──────────────────────────────────────────────── */}
      <StatCard label="预警状态" accent={alertColor} alert={alertLevel > 1}>
        <AlertLevelBadge level={alertLevel} />
      </StatCard>

      {/* ── 卡片 7：设备状态（推至底部） ────────────────────────────────── */}
      <StatCard label="设备状态" className="mt-auto">
        <div className="flex items-center gap-2">
          <StatusDot status={deviceStatus} size="sm" />
          <div className="flex flex-col">
            <span className="font-display text-[9px] font-bold tracking-[0.15em] text-text-primary uppercase">
              {deviceStatusLabel}
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
        {/* 逆行 / 排队 状态标签 */}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {wrongWayActive && (
            <span className="rounded-sm border border-[#ff2d55]/30 bg-[#ff2d55]/10 px-1.5 py-0.5 font-display text-[7px] font-bold text-[#ff2d55]">
              逆行检测
            </span>
          )}
          {queueLength >= 3 && (
            <span className="rounded-sm border border-[#ff9500]/30 bg-[#ff9500]/10 px-1.5 py-0.5 font-display text-[7px] font-bold text-[#ff9500]">
              排队 {queueLength} 辆
            </span>
          )}
        </div>
      </StatCard>

    </div>
  )
}
