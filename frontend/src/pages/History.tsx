/**
 * 历史数据页面 — HUD 风格重设计
 *
 * 顶部：过滤控制栏（设备 / 日期范围 / 粒度 / 刷新 / CSV 导出）
 * Tab 导航：HUD 风格选项卡
 * 内容：HudPanel 包裹各 Tab 内容
 */
import { useState } from 'react'
import { Download, RefreshCw, TrendingUp, Grid, AlertTriangle, Wifi } from 'lucide-react'
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
import { RealtimeChart } from '@/components/charts/RealtimeChart'
import { HourlyBarChart } from '@/components/charts/HourlyBarChart'
import { HeatmapGrid } from '@/components/charts/HeatmapGrid'
import { DataTable } from '@/components/ui/DataTable'
import { HudPanel } from '@/components/ui/HudPanel'
import type { Column } from '@/components/ui/DataTable'
import type { AlertRecord, SessionRecord } from '@/types/api'

const API_BASE = import.meta.env['VITE_API_BASE_URL'] ?? 'http://localhost:8000'

function today()        { return new Date().toISOString().substring(0, 10) }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().substring(0, 10)
}
function histXFormatter(iso: string) {
  const d = new Date(iso)
  return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

// ── 等级标签 ──────────────────────────────────────────────────────────────────

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

// ── Tab 配置 ──────────────────────────────────────────────────────────────────

type TabId = 'trend' | 'heatmap' | 'alerts' | 'sessions'
const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'trend',    label: '流量趋势',   icon: TrendingUp    },
  { id: 'heatmap',  label: '热力时间图', icon: Grid          },
  { id: 'alerts',   label: '预警记录',   icon: AlertTriangle },
  { id: 'sessions', label: '连接会话',   icon: Wifi          },
]

// ── HUD 按钮 ──────────────────────────────────────────────────────────────────

interface HudBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  accent?: boolean
}

function HudBtn({ active, accent, className = '', children, ...rest }: HudBtnProps) {
  const base =
    'flex items-center gap-1.5 rounded-sm px-3 py-1.5 font-display text-[9px] font-bold tracking-[0.18em] uppercase transition-all'
  if (accent) {
    return (
      <button
        className={`${base} disabled:opacity-40`}
        style={{
          background: 'rgba(0,212,255,0.08)',
          border: '1px solid rgba(0,212,255,0.3)',
          color: '#00D4FF',
        }}
        {...rest}
      >
        {children}
      </button>
    )
  }
  return (
    <button
      className={`${base} ${className}`}
      style={{
        background: active ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${active ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.06)'}`,
        color: active ? '#00D4FF' : 'rgba(122,144,179,0.8)',
        boxShadow: active ? '0 0 8px rgba(0,212,255,0.12)' : 'none',
      }}
      {...rest}
    >
      {children}
    </button>
  )
}

// ── HUD Select / Input ────────────────────────────────────────────────────────

function HudSelect({ className = '', ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`rounded-sm bg-bg-surface px-2.5 py-1.5 font-mono text-[11px] text-text-primary outline-none transition-all ${className}`}
      style={{ border: '1px solid rgba(0,212,255,0.15)' }}
      onFocus={(e) => { e.target.style.border = '1px solid rgba(0,212,255,0.45)' }}
      onBlur={(e)  => { e.target.style.border = '1px solid rgba(0,212,255,0.15)' }}
      {...rest}
    />
  )
}

function HudDateInput({ className = '', ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="date"
      className={`rounded-sm bg-bg-surface px-2 py-1.5 font-mono text-[11px] text-text-primary outline-none transition-all ${className}`}
      style={{ border: '1px solid rgba(0,212,255,0.15)', colorScheme: 'dark' }}
      onFocus={(e) => { e.target.style.border = '1px solid rgba(0,212,255,0.45)' }}
      onBlur={(e)  => { e.target.style.border = '1px solid rgba(0,212,255,0.15)' }}
      {...rest}
    />
  )
}

// ── 空状态 ────────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      className="flex h-40 flex-col items-center justify-center gap-3 rounded-sm"
      style={{ border: '1px dashed rgba(0,212,255,0.12)' }}
    >
      <div className="h-8 w-8 rounded-full" style={{ border: '1px solid rgba(0,212,255,0.15)' }} />
      <p className="font-display text-[9px] tracking-[0.25em] text-text-secondary/35 uppercase">
        NO DATA AVAILABLE
      </p>
    </div>
  )
}

// ── 加载状态 ──────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex h-40 items-center justify-center">
      <div className="relative flex h-10 w-10 items-center justify-center">
        <motion.div
          className="absolute h-full w-full rounded-full"
          style={{ border: '1px solid rgba(0,212,255,0.3)' }}
          animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
        <div className="h-1.5 w-1.5 rounded-full bg-accent/60" />
      </div>
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────────────────

export default function History() {
  const globalDeviceId = useTrafficStore((s) => s.selectedDeviceId)
  const role           = useAuthStore((s) => s.user?.role)

  const [deviceId,      setDeviceId]      = useState(globalDeviceId)
  const [startDate,     setStartDate]     = useState(daysAgo(7))
  const [endDate,       setEndDate]       = useState(today)
  const [granularity,   setGranularity]   = useState<'minute' | 'hour'>('hour')
  const [activeTab,     setActiveTab]     = useState<TabId>('trend')
  const [alertsPage,    setAlertsPage]    = useState(1)
  const [alertResolved, setAlertResolved] = useState<'all' | 'unresolved' | 'resolved'>('all')
  const [sessionsPage,  setSessionsPage]  = useState(1)
  const [exporting,     setExporting]     = useState(false)

  const startISO = `${startDate}T00:00:00`
  const endISO   = `${endDate}T23:59:59`

  const { data: devices } = useDevices()

  const { data: minuteData  = [], isLoading: minuteLoading,  refetch: refetchMinute  } = useTrafficHistory({ device_id: deviceId, start: startISO, end: endISO, limit: 1440 })
  const { data: hourlyData  = [], isLoading: hourlyLoading,  refetch: refetchHourly  } = useHourlyHistory({ device_id: deviceId, start: startISO, end: endISO })
  const { data: heatmapData,      isLoading: heatmapLoading }                           = useHeatmapData({ device_id: deviceId, end_date: endDate })
  const alertsResolvedParam = alertResolved === 'all' ? undefined : alertResolved === 'resolved'
  const { data: alertsData,       isLoading: alertsLoading  }                           = useAlertHistory({ device_id: deviceId, is_resolved: alertsResolvedParam, page: alertsPage, page_size: 20 })
  const { data: sessionsData,     isLoading: sessionsLoading }                           = useSessions({ device_id: deviceId, page: sessionsPage, page_size: 20 })

  const alertColumns: Column<AlertRecord>[] = [
    { key: 'level',        header: '等级',     render: (r) => <LevelTag level={r.level} />, className: 'w-14' },
    { key: 'alert_type',   header: '类型',     render: (r) => alertTypeLabel(r.alert_type), className: 'w-24' },
    { key: 'message',      header: '描述',     render: (r) => <span className="block max-w-[240px] truncate" title={r.message}>{r.message}</span> },
    { key: 'triggered_at', header: '触发时间', render: (r) => formatDateTime(r.triggered_at), className: 'w-40' },
    { key: 'duration_seconds', header: '持续', render: (r) => r.duration_seconds != null ? formatDuration(r.duration_seconds) : '—', className: 'w-24' },
    { key: 'is_resolved',  header: '状态',     render: (r) => r.is_resolved ? <span className="text-online">已解除</span> : <span className="text-alert-l3">活跃</span>, className: 'w-16' },
  ]

  const sessionColumns: Column<SessionRecord>[] = [
    { key: 'connected_at',    header: '连接时间', render: (r) => formatDateTime(r.connected_at),    className: 'w-40' },
    { key: 'disconnected_at', header: '断开时间', render: (r) => r.disconnected_at ? formatDateTime(r.disconnected_at) : '—', className: 'w-40' },
    { key: 'duration_seconds', header: '时长',   render: (r) => r.duration_seconds != null ? formatDuration(r.duration_seconds) : '—', className: 'w-24' },
    { key: 'frames_received', header: '接收帧数', render: (r) => formatCount(r.frames_received),   className: 'w-24' },
    { key: 'disconnect_reason', header: '断开原因', render: (r) => r.disconnect_reason ?? '—',     className: 'w-24' },
  ]

  const handleExport = async () => {
    setExporting(true)
    try {
      const token  = useAuthStore.getState().accessToken
      const params = new URLSearchParams({ device_id: String(deviceId), start: startISO, end: endISO })
      const res    = await fetch(`${API_BASE}/api/history/export?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Export failed')
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
    <div className="flex h-full flex-col gap-3 overflow-hidden p-3">

      {/* ── 顶部控制面板 ─────────────────────────────────────────── */}
      <HudPanel title="数据筛选" titleRight={
        <span className="font-mono text-[8px] text-text-secondary/35">
          {startDate} → {endDate}
        </span>
      } className="flex-shrink-0">
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

          <span className="text-text-secondary/25">·</span>

          {/* 日期范围 */}
          <div className="flex items-center gap-1.5">
            <HudDateInput
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="font-mono text-[10px] text-text-secondary/40">—</span>
            <HudDateInput
              value={endDate}
              min={startDate}
              max={today()}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <span className="text-text-secondary/25">·</span>

          {/* 粒度 */}
          <div className="flex gap-1">
            {(['minute', 'hour'] as const).map((g) => (
              <HudBtn key={g} active={granularity === g} onClick={() => setGranularity(g)}>
                {g === 'minute' ? '分钟' : '小时'}
              </HudBtn>
            ))}
          </div>

          {/* 刷新 */}
          <HudBtn onClick={() => { void refetchMinute(); void refetchHourly() }}>
            <RefreshCw size={10} />
            刷新
          </HudBtn>

          <div className="flex-1" />

          {/* CSV 导出 */}
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

      {/* ── Tab 导航 ─────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 gap-1">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id
          return (
            <motion.button
              key={id}
              onClick={() => setActiveTab(id)}
              className="relative flex items-center gap-2 rounded-sm px-4 py-2.5 font-display text-[9px] font-bold tracking-[0.18em] uppercase transition-all"
              style={{
                background: isActive ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isActive ? 'rgba(0,212,255,0.28)' : 'rgba(255,255,255,0.05)'}`,
                color: isActive ? '#00D4FF' : 'rgba(122,144,179,0.65)',
                boxShadow: isActive ? '0 0 12px rgba(0,212,255,0.12), inset 0 0 8px rgba(0,212,255,0.04)' : 'none',
              }}
              whileHover={{ color: isActive ? '#00D4FF' : 'rgba(232,240,255,0.8)' }}
            >
              <Icon size={11} />
              {label}
              {isActive && (
                <motion.span
                  className="absolute bottom-0 inset-x-2 h-[2px] rounded-t-full bg-accent"
                  style={{ boxShadow: '0 0 6px #00D4FF' }}
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
            transition={{ duration: 0.2 }}
          >

            {/* ── 流量趋势 ── */}
            {activeTab === 'trend' && (
              <HudPanel
                title={granularity === 'minute' ? '分钟级流量趋势' : '小时级流量趋势'}
                titleRight={
                  trendLoading ? null :
                  <span>{granularity === 'minute' ? minuteData.length : hourlyData.length} 条记录</span>
                }
                className="h-full"
              >
                {trendLoading ? <LoadingState /> :
                  granularity === 'minute' ? (
                    minuteData.length > 0 ?
                      <RealtimeChart data={minuteData.map((r) => ({ time: r.recorded_at, value: r.avg_count }))} height={280} xFormatter={histXFormatter} />
                      : <EmptyState />
                  ) : (
                    hourlyData.length > 0 ?
                      <HourlyBarChart data={hourlyData} height={280} />
                      : <EmptyState />
                  )
                }
              </HudPanel>
            )}

            {/* ── 热力时间图 ── */}
            {activeTab === 'heatmap' && (
              <HudPanel title="热力时间矩阵" className="h-full">
                {heatmapLoading ? <LoadingState /> :
                  heatmapData ? <HeatmapGrid data={heatmapData.data} rows={heatmapData.rows} /> : <EmptyState />
                }
              </HudPanel>
            )}

            {/* ── 预警记录 ── */}
            {activeTab === 'alerts' && (
              <div className="flex h-full flex-col gap-3">
                {/* 筛选 */}
                <div className="flex items-center gap-2">
                  <span className="font-display text-[9px] tracking-[0.18em] text-text-secondary/50 uppercase">
                    筛选：
                  </span>
                  {(['all', 'unresolved', 'resolved'] as const).map((v) => (
                    <HudBtn
                      key={v}
                      active={alertResolved === v}
                      onClick={() => { setAlertResolved(v); setAlertsPage(1) }}
                    >
                      {v === 'all' ? '全部' : v === 'unresolved' ? '活跃' : '已解除'}
                    </HudBtn>
                  ))}
                </div>
                <HudPanel title="预警事件日志" titleRight={<span>{alertsData?.total ?? 0} 条</span>} className="flex-1">
                  {alertsLoading ? <LoadingState /> :
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
                  }
                </HudPanel>
              </div>
            )}

            {/* ── 连接会话 ── */}
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
