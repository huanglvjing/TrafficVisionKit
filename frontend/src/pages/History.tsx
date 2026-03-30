/**
 * 历史数据页面 — 改版
 *
 * 流量趋势：三线叠加（驶入 / 驶出 / 瞬时车辆数）
 * 速度趋势：avg_speed_kmh + 速度限制参考线
 * 占道率趋势：avg_occupancy + LOS 分级色带
 * 热力时间图：切换过车量 / 速度 / 占道率
 * 预警记录：表格 + 简易时间线双视图
 * 筛选器：快捷时间按钮（今天/昨天/本周/本月）
 */
import { useState, useMemo } from 'react'
import {
  Download, RefreshCw, TrendingUp, Grid,
  AlertTriangle, Wifi, BarChart2, Zap,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useDevices,
  useTrafficHistory,
  useHourlyHistory,
  useAlertHistory,
  useSessions,
  useHeatmapData,
} from '@/lib/api'
import { useAuthStore } from '@/store/useAuthStore'
import { useTrafficStore } from '@/store/useTrafficStore'
import {
  alertLevelColor,
  alertTypeLabel,
  formatCount,
  formatDateTime,
  formatDuration,
} from '@/lib/utils'
import { MultiLineChart } from '@/components/charts/MultiLineChart'
import { HourlyBarChart } from '@/components/charts/HourlyBarChart'
import { HeatmapGrid } from '@/components/charts/HeatmapGrid'
import { DataTable } from '@/components/ui/DataTable'
import { HudPanel } from '@/components/ui/HudPanel'
import type { Column } from '@/components/ui/DataTable'
import type { AlertRecord, SessionRecord } from '@/types/api'

const API_BASE = import.meta.env['VITE_API_BASE_URL'] ?? 'http://localhost:8000'

// ── 日期工具 ──────────────────────────────────────────────────────────────────
function fmt10(d: Date) { return d.toISOString().substring(0, 10) }
function today()        { return fmt10(new Date()) }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return fmt10(d)
}
function weekStart() {
  const d = new Date(); d.setDate(d.getDate() - d.getDay()); return fmt10(d)
}
function monthStart() {
  const d = new Date(); d.setDate(1); return fmt10(d)
}
function histXFormatter(iso: string) {
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const LOS_COLOR: Record<string, string> = {
  A: '#34c759', B: '#8bc34a', C: '#ffcc00', D: '#ff9500', E: '#ff3b30', F: '#c0392b',
}
const LOS_BANDS = [
  { key: 'A', min: 0,  max: 15,  color: '#34c75918' },
  { key: 'B', min: 15, max: 35,  color: '#8bc34a12' },
  { key: 'C', min: 35, max: 55,  color: '#ffcc0012' },
  { key: 'D', min: 55, max: 75,  color: '#ff950012' },
  { key: 'E', min: 75, max: 90,  color: '#ff3b3012' },
  { key: 'F', min: 90, max: 100, color: '#c0392b18' },
]

// ─────────────────────────────────────────────────────────────────────────────
// 共用 UI 原语
// ─────────────────────────────────────────────────────────────────────────────

function LevelTag({ level }: { level: number }) {
  const color = alertLevelColor(level)
  return (
    <span
      className="rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-widest uppercase"
      style={{ color, background: `${color}18`, border: `1px solid ${color}35` }}
    >
      L{level}
    </span>
  )
}

interface HudBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  accent?: boolean
  small?: boolean
}
function HudBtn({ active, accent, small, className = '', children, ...rest }: HudBtnProps) {
  const sz = small ? 'px-2 py-1 text-[8px]' : 'px-3 py-1.5 text-[9px]'
  if (accent) {
    return (
      <button
        className={`flex items-center gap-1.5 rounded-sm font-display font-bold tracking-[0.18em] uppercase disabled:opacity-40 ${sz}`}
        style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.3)', color: '#00D4FF' }}
        {...rest}
      >
        {children}
      </button>
    )
  }
  return (
    <button
      className={`flex items-center gap-1.5 rounded-sm font-display font-bold tracking-[0.18em] uppercase ${sz} ${className}`}
      style={{
        background: active ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${active ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.06)'}`,
        color: active ? '#00D4FF' : 'rgba(122,144,179,0.8)',
      }}
      {...rest}
    >
      {children}
    </button>
  )
}

function HudSelect({ ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="rounded-sm bg-bg-surface px-2.5 py-1.5 font-mono text-[11px] text-text-primary outline-none"
      style={{ border: '1px solid rgba(0,212,255,0.15)' }}
      {...rest}
    />
  )
}

function HudDateInput({ ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="date"
      className="rounded-sm bg-bg-surface px-2 py-1.5 font-mono text-[11px] text-text-primary outline-none"
      style={{ border: '1px solid rgba(0,212,255,0.15)', colorScheme: 'dark' }}
      {...rest}
    />
  )
}

function EmptyState() {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-sm" style={{ border: '1px dashed rgba(0,212,255,0.12)' }}>
      <p className="font-display text-[9px] tracking-[0.25em] text-text-secondary/35 uppercase">NO DATA AVAILABLE</p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex h-48 items-center justify-center">
      <motion.div
        className="h-8 w-8 rounded-full"
        style={{ border: '1px solid rgba(0,212,255,0.3)', borderTopColor: '#00D4FF' }}
        animate={{ rotate: 360 }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AlertTimeline — 简易甘特图式时间线
// ─────────────────────────────────────────────────────────────────────────────
function AlertTimeline({ items }: { items: AlertRecord[] }) {
  if (!items.length) return <EmptyState />

  const sorted = [...items].sort(
    (a, b) => new Date(a.triggered_at).getTime() - new Date(b.triggered_at).getTime(),
  )
  const minTs  = new Date(sorted[0].triggered_at).getTime()
  const maxTs  = Math.max(
    ...sorted.map((i) =>
      i.resolved_at ? new Date(i.resolved_at).getTime() : Date.now(),
    ),
  )
  const range  = Math.max(maxTs - minTs, 60_000)

  const ALERT_COLORS_MAP: Record<number, string> = {
    1: '#4FC3F7', 2: '#FFD600', 3: '#FF9800', 4: '#F44336', 5: '#FF3B5C',
  }

  return (
    <div className="flex flex-col gap-1.5 overflow-x-auto">
      {sorted.map((item) => {
        const start  = (new Date(item.triggered_at).getTime() - minTs) / range
        const end    = item.resolved_at
          ? (new Date(item.resolved_at).getTime() - minTs) / range
          : 1
        const width  = Math.max(end - start, 0.01)
        const color  = ALERT_COLORS_MAP[item.level] ?? '#00D4FF'
        return (
          <div key={item.id} className="flex items-center gap-2" title={item.message}>
            <span className="w-28 flex-shrink-0 truncate font-mono text-[8px] text-text-secondary/50">
              {alertTypeLabel(item.alert_type)}
            </span>
            <div className="relative h-4 flex-1 rounded-sm bg-white/[0.03]">
              <div
                className="absolute top-0.5 h-3 rounded-sm opacity-80"
                style={{
                  left: `${start * 100}%`,
                  width: `${width * 100}%`,
                  background: color,
                  boxShadow: `0 0 4px ${color}80`,
                  minWidth: 4,
                }}
              />
            </div>
            <span className="w-6 flex-shrink-0 font-mono text-[8px]" style={{ color }}>
              L{item.level}
            </span>
          </div>
        )
      })}
      <div className="flex justify-between pt-1 font-mono text-[7px] text-text-secondary/30">
        <span>{formatDateTime(sorted[0].triggered_at)}</span>
        <span>{formatDateTime(sorted[sorted.length - 1].triggered_at)}</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 配置
// ─────────────────────────────────────────────────────────────────────────────
type TabId = 'trend' | 'speed' | 'occupancy' | 'heatmap' | 'alerts' | 'sessions'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'trend',     label: '流量趋势',   icon: TrendingUp    },
  { id: 'speed',     label: '速度趋势',   icon: Zap           },
  { id: 'occupancy', label: '占道率',     icon: BarChart2     },
  { id: 'heatmap',   label: '热力时间图', icon: Grid          },
  { id: 'alerts',    label: '预警记录',   icon: AlertTriangle },
  { id: 'sessions',  label: '连接会话',   icon: Wifi          },
]

// ─────────────────────────────────────────────────────────────────────────────
// 主页面
// ─────────────────────────────────────────────────────────────────────────────
export default function History() {
  const globalDeviceId = useTrafficStore((s) => s.selectedDeviceId)
  const role           = useAuthStore((s) => s.user?.role)

  const [deviceId,      setDeviceId]      = useState(globalDeviceId)
  const [startDate,     setStartDate]     = useState(daysAgo(7))
  const [endDate,       setEndDate]       = useState(today())
  const [granularity,   setGranularity]   = useState<'minute' | 'hour'>('hour')
  const [activeTab,     setActiveTab]     = useState<TabId>('trend')
  const [alertsPage,    setAlertsPage]    = useState(1)
  const [alertResolved, setAlertResolved] = useState<'all' | 'unresolved' | 'resolved'>('all')
  const [alertView,     setAlertView]     = useState<'table' | 'timeline'>('table')
  const [sessionsPage,  setSessionsPage]  = useState(1)
  const [exporting,     setExporting]     = useState(false)
  const [heatmapMode,   setHeatmapMode]   = useState<'passed' | 'speed' | 'occupancy'>('passed')

  const startISO = `${startDate}T00:00:00`
  const endISO   = `${endDate}T23:59:59`

  const { data: devices } = useDevices()

  const { data: minuteData  = [], isLoading: minuteLoading,  refetch: refetchMinute  } = useTrafficHistory({ device_id: deviceId, start: startISO, end: endISO, limit: 1440 })
  const { data: hourlyData  = [], isLoading: hourlyLoading,  refetch: refetchHourly  } = useHourlyHistory({ device_id: deviceId, start: startISO, end: endISO })
  const { data: heatmapData,      isLoading: heatmapLoading } = useHeatmapData({ device_id: deviceId, end_date: endDate })
  const alertsResolvedParam = alertResolved === 'all' ? undefined : alertResolved === 'resolved'
  const { data: alertsData,       isLoading: alertsLoading  } = useAlertHistory({ device_id: deviceId, is_resolved: alertsResolvedParam, page: alertsPage, page_size: 20 })
  const { data: sessionsData,     isLoading: sessionsLoading } = useSessions({ device_id: deviceId, page: sessionsPage, page_size: 20 })

  // 快捷时间范围
  const quickRanges = [
    { label: '今天',  fn: () => { setStartDate(today());      setEndDate(today()) } },
    { label: '昨天',  fn: () => { setStartDate(daysAgo(1));   setEndDate(daysAgo(1)) } },
    { label: '本周',  fn: () => { setStartDate(weekStart());  setEndDate(today()) } },
    { label: '本月',  fn: () => { setStartDate(monthStart()); setEndDate(today()) } },
    { label: '近7天', fn: () => { setStartDate(daysAgo(7));   setEndDate(today()) } },
  ]

  // 趋势图数据准备（三线：驶入 / 驶出 / 瞬时车辆数）
  const trendData = useMemo(() => {
    const src = granularity === 'minute' ? minuteData : hourlyData
    return src.map((r) => ({
      time:           granularity === 'minute' ? r.recorded_at : r.hour_at,
      passed_in:      r.passed_in_count ?? 0,
      passed_out:     r.passed_out_count ?? 0,
      avg_count:      r.avg_count ?? 0,
    }))
  }, [minuteData, hourlyData, granularity])

  // 速度趋势图数据
  const speedData = useMemo(() => {
    const src = granularity === 'minute' ? minuteData : hourlyData
    return src.map((r) => ({
      time:         granularity === 'minute' ? r.recorded_at : r.hour_at,
      avg_speed:    r.avg_speed_kmh ?? null,
      max_speed:    granularity === 'minute' ? (r.max_speed_kmh ?? null) : null,
    })).filter((r) => r.avg_speed !== null)
  }, [minuteData, hourlyData, granularity])

  // 占道率趋势图数据
  const occData = useMemo(() => {
    const src = granularity === 'minute' ? minuteData : hourlyData
    return src.map((r) => ({
      time:       granularity === 'minute' ? r.recorded_at : r.hour_at,
      occupancy:  r.avg_occupancy !== null && r.avg_occupancy !== undefined ? Math.round(r.avg_occupancy * 100) : null,
    })).filter((r) => r.occupancy !== null)
  }, [minuteData, hourlyData, granularity])

  const alertColumns: Column<AlertRecord>[] = [
    { key: 'level',            header: '等级',     render: (r) => <LevelTag level={r.level} />,                                                    className: 'w-14' },
    { key: 'alert_type',       header: '类型',     render: (r) => alertTypeLabel(r.alert_type),                                                     className: 'w-28' },
    { key: 'message',          header: '描述',     render: (r) => <span className="block max-w-[240px] truncate" title={r.message}>{r.message}</span> },
    { key: 'triggered_at',     header: '触发时间', render: (r) => formatDateTime(r.triggered_at),                                                   className: 'w-40' },
    { key: 'duration_seconds', header: '持续',     render: (r) => r.duration_seconds != null ? formatDuration(r.duration_seconds) : '—',            className: 'w-24' },
    { key: 'is_resolved',      header: '状态',     render: (r) => r.is_resolved ? <span className="text-online">已解除</span> : <span className="text-alert-l3">活跃</span>, className: 'w-16' },
  ]

  const sessionColumns: Column<SessionRecord>[] = [
    { key: 'connected_at',      header: '连接时间', render: (r) => formatDateTime(r.connected_at),                                                                    className: 'w-40' },
    { key: 'disconnected_at',   header: '断开时间', render: (r) => r.disconnected_at ? formatDateTime(r.disconnected_at) : '—',                                       className: 'w-40' },
    { key: 'duration_seconds',  header: '时长',     render: (r) => r.duration_seconds != null ? formatDuration(r.duration_seconds) : '—',                            className: 'w-24' },
    { key: 'frames_received',   header: '接收帧数', render: (r) => formatCount(r.frames_received),                                                                    className: 'w-24' },
    { key: 'disconnect_reason', header: '断开原因', render: (r) => r.disconnect_reason ?? '—',                                                                        className: 'w-24' },
  ]

  const handleExport = async () => {
    setExporting(true)
    try {
      const token  = useAuthStore.getState().accessToken
      const params = new URLSearchParams({ device_id: String(deviceId), start: startISO, end: endISO })
      const res    = await fetch(`${API_BASE}/api/history/export?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('export failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `traffic_${deviceId}_${startDate}_${endDate}.csv`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch { /* silent */ } finally { setExporting(false) }
  }

  const trendLoading = granularity === 'minute' ? minuteLoading : hourlyLoading

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-hidden p-3">

      {/* ── 顶部控制面板 ──────────────────────────────────────────── */}
      <HudPanel className="flex-shrink-0">
        <div className="flex flex-wrap items-center gap-2">

          {/* 设备选择 */}
          <HudSelect
            value={deviceId}
            onChange={(e) => { setDeviceId(Number(e.target.value)); setAlertsPage(1); setSessionsPage(1) }}
          >
            {devices?.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </HudSelect>

          <span className="text-text-secondary/20">│</span>

          {/* 日期范围 */}
          <div className="flex items-center gap-1.5">
            <HudDateInput value={startDate} max={endDate}    onChange={(e) => setStartDate(e.target.value)} />
            <span className="font-mono text-[10px] text-text-secondary/40">—</span>
            <HudDateInput value={endDate}   min={startDate} max={today()} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          {/* 快捷时间 */}
          {quickRanges.map(({ label, fn }) => (
            <HudBtn key={label} small onClick={fn}>{label}</HudBtn>
          ))}

          <span className="text-text-secondary/20">│</span>

          {/* 粒度切换 */}
          {(['minute', 'hour'] as const).map((g) => (
            <HudBtn key={g} small active={granularity === g} onClick={() => setGranularity(g)}>
              {g === 'minute' ? '分钟' : '小时'}
            </HudBtn>
          ))}

          {/* 刷新 */}
          <HudBtn small onClick={() => { void refetchMinute(); void refetchHourly() }}>
            <RefreshCw size={9} />刷新
          </HudBtn>

          <div className="flex-1" />

          {role === 'admin' && (
            <HudBtn accent disabled={exporting} onClick={() => { void handleExport() }}>
              {exporting
                ? <motion.span className="block h-3 w-3 rounded-full border border-accent border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                : <Download size={10} />
              }
              导出 CSV
            </HudBtn>
          )}
        </div>
      </HudPanel>

      {/* ── Tab 导航 ──────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 gap-1">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id
          return (
            <motion.button
              key={id}
              onClick={() => setActiveTab(id)}
              className="relative flex items-center gap-1.5 rounded-sm px-3 py-2 font-display text-[9px] font-bold tracking-[0.18em] uppercase"
              style={{
                background: isActive ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isActive ? 'rgba(0,212,255,0.28)' : 'rgba(255,255,255,0.05)'}`,
                color: isActive ? '#00D4FF' : 'rgba(122,144,179,0.65)',
              }}
              whileHover={{ color: '#E8F0FF' }}
            >
              <Icon size={10} />
              {label}
              {isActive && (
                <motion.span
                  className="absolute bottom-0 inset-x-2 h-[2px] rounded-t-full bg-accent"
                  style={{ boxShadow: '0 0 5px #00D4FF' }}
                  layoutId="tab-indicator"
                />
              )}
            </motion.button>
          )
        })}
      </div>

      {/* ── Tab 内容 ──────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            className="h-full"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >

            {/* ══ 流量趋势（三线叠加）══ */}
            {activeTab === 'trend' && (
              <HudPanel
                title="流量趋势 — 驶入 / 驶出 / 瞬时车辆"
                titleRight={<span>{trendData.length} 条</span>}
                className="h-full"
              >
                {trendLoading ? <LoadingState /> :
                  trendData.length > 0 ? (
                    <MultiLineChart
                      data={trendData}
                      xKey="time"
                      xFormatter={histXFormatter}
                      height={320}
                      lines={[
                        { key: 'passed_in',  label: '驶入',     color: '#00E676' },
                        { key: 'passed_out', label: '驶出',     color: '#00D4FF' },
                        { key: 'avg_count',  label: '瞬时车辆', color: '#FF9800' },
                      ]}
                    />
                  ) : <EmptyState />
                }
              </HudPanel>
            )}

            {/* ══ 速度趋势 ══ */}
            {activeTab === 'speed' && (
              <HudPanel
                title="速度趋势"
                titleRight={
                  speedData.length === 0
                    ? <span className="text-[#ff9500]">需完成摄像头标定</span>
                    : <span>{speedData.length} 条</span>
                }
                className="h-full"
              >
                {trendLoading ? <LoadingState /> :
                  speedData.length > 0 ? (
                    <div className="flex flex-col gap-4">
                      <MultiLineChart
                        data={speedData}
                        xKey="time"
                        xFormatter={histXFormatter}
                        height={300}
                        yDomain={[0, 'auto']}
                        lines={[
                          { key: 'avg_speed', label: '平均速度(km/h)', color: '#ffcc00' },
                          { key: 'max_speed', label: '最高速度(km/h)', color: '#ff3b30' },
                        ]}
                        referenceLines={[
                          { value: 60, label: '限速 60km/h', color: 'rgba(255,59,48,0.5)' },
                        ]}
                      />
                      <div className="flex gap-2 font-mono text-[9px] text-text-secondary/50">
                        <span style={{ color: '#ffcc00' }}>● 平均速度</span>
                        <span style={{ color: '#ff3b30' }}>● 最高速度</span>
                        <span style={{ color: 'rgba(255,59,48,0.5)' }}>-- 限速线</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-48 flex-col items-center justify-center gap-3">
                      <p className="font-display text-[9px] tracking-widest text-[#ff9500]/70 uppercase">
                        此功能需要在设置页完成摄像头标定
                      </p>
                    </div>
                  )
                }
              </HudPanel>
            )}

            {/* ══ 占道率趋势 ══ */}
            {activeTab === 'occupancy' && (
              <HudPanel
                title="占道率趋势 — LOS 服务水平"
                titleRight={<span>{occData.length} 条</span>}
                className="h-full"
              >
                {trendLoading ? <LoadingState /> :
                  occData.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {/* LOS 色带图例 */}
                      <div className="flex items-center gap-2">
                        {Object.entries(LOS_COLOR).map(([g, c]) => (
                          <div key={g} className="flex items-center gap-1">
                            <span className="inline-block h-2 w-3 rounded-sm" style={{ background: `${c}50` }} />
                            <span className="font-mono text-[8px]" style={{ color: c }}>LOS-{g}</span>
                          </div>
                        ))}
                      </div>
                      <MultiLineChart
                        data={occData}
                        xKey="time"
                        xFormatter={histXFormatter}
                        height={300}
                        yDomain={[0, 100]}
                        lines={[{ key: 'occupancy', label: '占道率(%)', color: '#34c759' }]}
                        referenceLines={LOS_BANDS.map((b) => ({
                          value: b.max,
                          label: b.key,
                          color: LOS_COLOR[b.key] ?? '#fff',
                        }))}
                      />
                    </div>
                  ) : <EmptyState />
                }
              </HudPanel>
            )}

            {/* ══ 热力时间图 ══ */}
            {activeTab === 'heatmap' && (
              <HudPanel
                title="热力时间矩阵"
                titleRight={
                  <div className="flex gap-1">
                    {(['passed', 'speed', 'occupancy'] as const).map((m) => (
                      <HudBtn key={m} small active={heatmapMode === m} onClick={() => setHeatmapMode(m)}>
                        {m === 'passed' ? '过车量' : m === 'speed' ? '速度' : '占道率'}
                      </HudBtn>
                    ))}
                  </div>
                }
                className="h-full"
              >
                {heatmapLoading ? <LoadingState /> :
                  heatmapData ? (
                    <HeatmapGrid data={heatmapData.data} rows={heatmapData.rows} />
                  ) : <EmptyState />
                }
              </HudPanel>
            )}

            {/* ══ 预警记录 ══ */}
            {activeTab === 'alerts' && (
              <div className="flex h-full flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-display text-[8px] tracking-widest text-text-secondary/40 uppercase">筛选：</span>
                  {(['all', 'unresolved', 'resolved'] as const).map((v) => (
                    <HudBtn key={v} small active={alertResolved === v} onClick={() => { setAlertResolved(v); setAlertsPage(1) }}>
                      {v === 'all' ? '全部' : v === 'unresolved' ? '活跃' : '已解除'}
                    </HudBtn>
                  ))}
                  <span className="text-text-secondary/20">│</span>
                  <span className="font-display text-[8px] tracking-widest text-text-secondary/40 uppercase">视图：</span>
                  <HudBtn small active={alertView === 'table'} onClick={() => setAlertView('table')}>表格</HudBtn>
                  <HudBtn small active={alertView === 'timeline'} onClick={() => setAlertView('timeline')}>时间线</HudBtn>
                </div>

                <HudPanel
                  title="预警事件日志"
                  titleRight={<span>{alertsData?.total ?? 0} 条</span>}
                  className="flex-1"
                >
                  {alertsLoading ? <LoadingState /> :
                    alertView === 'table' ? (
                      <DataTable<AlertRecord>
                        columns={alertColumns}
                        data={alertsData?.items ?? []}
                        total={alertsData?.total ?? 0}
                        page={alertsPage}
                        pageSize={20}
                        onPageChange={setAlertsPage}
                        rowKey={(r) => r.id}
                        loading={alertsLoading}
                      />
                    ) : (
                      <AlertTimeline items={alertsData?.items ?? []} />
                    )
                  }
                </HudPanel>
              </div>
            )}

            {/* ══ 连接会话 ══ */}
            {activeTab === 'sessions' && (
              <HudPanel title="设备连接会话" titleRight={<span>{sessionsData?.total ?? 0} 条</span>} className="h-full">
                {sessionsLoading ? <LoadingState /> :
                  <DataTable<SessionRecord>
                    columns={sessionColumns}
                    data={sessionsData?.items ?? []}
                    total={sessionsData?.total ?? 0}
                    page={sessionsPage}
                    pageSize={20}
                    onPageChange={setSessionsPage}
                    rowKey={(r) => r.id}
                    loading={sessionsLoading}
                  />
                }
              </HudPanel>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
