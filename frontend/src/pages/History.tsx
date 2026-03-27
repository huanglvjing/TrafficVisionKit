/**
 * 历史查询页面（设计稿 9.2 节）
 *
 * 顶部：设备选择 + 日期范围 + 粒度切换（分钟/小时）+ CSV 导出（admin）
 * Tab 1：流量趋势图（分钟=AreaChart，小时=HourlyBarChart）
 * Tab 2：热力时间图（HeatmapGrid）
 * Tab 3：预警记录表（DataTable + is_resolved 过滤）
 * Tab 4：连接会话记录表（DataTable）
 */
import { useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { useDevices, useTrafficHistory, useHourlyHistory, useAlertHistory, useSessions, useHeatmapData } from '@/lib/api'
import { useAuthStore } from '@/store/useAuthStore'
import { useTrafficStore } from '@/store/useTrafficStore'
import { alertLevelColor, alertTypeLabel, formatCount, formatDateTime, formatDuration } from '@/lib/utils'
import { RealtimeChart } from '@/components/charts/RealtimeChart'
import { HourlyBarChart } from '@/components/charts/HourlyBarChart'
import { HeatmapGrid } from '@/components/charts/HeatmapGrid'
import { DataTable } from '@/components/ui/DataTable'
import type { Column } from '@/components/ui/DataTable'
import type { AlertRecord, SessionRecord } from '@/types/api'

const API_BASE = import.meta.env['VITE_API_BASE_URL'] ?? 'http://localhost:8000'

// ── 工具函数 ──────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().substring(0, 10)
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().substring(0, 10)
}

function histXFormatter(iso: string): string {
  const d = new Date(iso)
  const mo = (d.getMonth() + 1).toString().padStart(2, '0')
  const dd = d.getDate().toString().padStart(2, '0')
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${mo}/${dd} ${hh}:${mm}`
}

// ── 预警等级小标签 ────────────────────────────────────────────────────────────

function LevelTag({ level }: { level: number }) {
  const color = alertLevelColor(level)
  return (
    <span
      className="rounded-sm px-1.5 py-0.5 text-[9px] font-bold tracking-widest uppercase"
      style={{ color, background: `${color}20`, border: `1px solid ${color}40` }}
    >
      L{level}
    </span>
  )
}

// ── Tab 标签栏 ────────────────────────────────────────────────────────────────

type TabId = 'trend' | 'heatmap' | 'alerts' | 'sessions'
const TABS: { id: TabId; label: string }[] = [
  { id: 'trend', label: '流量趋势' },
  { id: 'heatmap', label: '热力时间图' },
  { id: 'alerts', label: '预警记录' },
  { id: 'sessions', label: '连接会话' },
]

// ── 页面主体 ──────────────────────────────────────────────────────────────────

export default function History() {
  const globalDeviceId = useTrafficStore((s) => s.selectedDeviceId)
  const role = useAuthStore((s) => s.user?.role)

  // ── 顶部控制状态 ──
  const [deviceId, setDeviceId] = useState(globalDeviceId)
  const [startDate, setStartDate] = useState(daysAgo(7))
  const [endDate, setEndDate] = useState(today)
  const [granularity, setGranularity] = useState<'minute' | 'hour'>('hour')
  const [activeTab, setActiveTab] = useState<TabId>('trend')

  // ── Tab-specific 状态 ──
  const [alertsPage, setAlertsPage] = useState(1)
  const [alertResolved, setAlertResolved] = useState<'all' | 'unresolved' | 'resolved'>('all')
  const [sessionsPage, setSessionsPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  const startISO = `${startDate}T00:00:00`
  const endISO = `${endDate}T23:59:59`

  // ── 设备列表 ──
  const { data: devices } = useDevices()

  // ── 流量趋势 ──
  const { data: minuteData = [], isLoading: minuteLoading, refetch: refetchMinute } = useTrafficHistory({
    device_id: deviceId,
    start: startISO,
    end: endISO,
    limit: 1440,
  })
  const { data: hourlyData = [], isLoading: hourlyLoading, refetch: refetchHourly } = useHourlyHistory({
    device_id: deviceId,
    start: startISO,
    end: endISO,
  })

  // ── 热力图 ──
  const { data: heatmapData, isLoading: heatmapLoading } = useHeatmapData({
    device_id: deviceId,
    end_date: endDate,
  })

  // ── 预警记录 ──
  const alertsResolvedParam =
    alertResolved === 'all' ? undefined : alertResolved === 'resolved'
  const { data: alertsData, isLoading: alertsLoading } = useAlertHistory({
    device_id: deviceId,
    is_resolved: alertsResolvedParam,
    page: alertsPage,
    page_size: 20,
  })

  // ── 连接会话 ──
  const { data: sessionsData, isLoading: sessionsLoading } = useSessions({
    device_id: deviceId,
    page: sessionsPage,
    page_size: 20,
  })

  // ── 预警列表表格列 ──
  const alertColumns: Column<AlertRecord>[] = [
    {
      key: 'level',
      header: '等级',
      render: (row) => <LevelTag level={row.level} />,
      className: 'w-14',
    },
    {
      key: 'alert_type',
      header: '类型',
      render: (row) => alertTypeLabel(row.alert_type),
      className: 'w-24',
    },
    {
      key: 'message',
      header: '描述',
      render: (row) => (
        <span className="block max-w-[240px] truncate" title={row.message}>
          {row.message}
        </span>
      ),
    },
    {
      key: 'triggered_at',
      header: '触发时间',
      render: (row) => formatDateTime(row.triggered_at),
      className: 'w-40',
    },
    {
      key: 'duration_seconds',
      header: '持续时长',
      render: (row) =>
        row.duration_seconds != null ? formatDuration(row.duration_seconds) : '—',
      className: 'w-24',
    },
    {
      key: 'is_resolved',
      header: '状态',
      render: (row) =>
        row.is_resolved ? (
          <span className="text-online">已解除</span>
        ) : (
          <span className="text-alert-l3">活跃</span>
        ),
      className: 'w-16',
    },
  ]

  // ── 会话列表表格列 ──
  const sessionColumns: Column<SessionRecord>[] = [
    {
      key: 'connected_at',
      header: '连接时间',
      render: (row) => formatDateTime(row.connected_at),
      className: 'w-40',
    },
    {
      key: 'disconnected_at',
      header: '断开时间',
      render: (row) =>
        row.disconnected_at ? formatDateTime(row.disconnected_at) : '—',
      className: 'w-40',
    },
    {
      key: 'duration_seconds',
      header: '持续时长',
      render: (row) =>
        row.duration_seconds != null ? formatDuration(row.duration_seconds) : '—',
      className: 'w-24',
    },
    {
      key: 'frames_received',
      header: '接收帧数',
      render: (row) => formatCount(row.frames_received),
      className: 'w-24',
    },
    {
      key: 'disconnect_reason',
      header: '断开原因',
      render: (row) => row.disconnect_reason ?? '—',
      className: 'w-24',
    },
  ]

  // ── CSV 导出 ──
  const handleExport = async () => {
    setExporting(true)
    try {
      const token = useAuthStore.getState().accessToken
      const params = new URLSearchParams({
        device_id: String(deviceId),
        start: startISO,
        end: endISO,
      })
      const res = await fetch(`${API_BASE}/api/history/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `traffic_${deviceId}_${startDate}_${endDate}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // 静默失败；可添加 Toast 提示
    } finally {
      setExporting(false)
    }
  }

  const trendLoading = granularity === 'minute' ? minuteLoading : hourlyLoading

  return (
    <div className="flex h-full flex-col overflow-hidden p-4 gap-4">

      {/* ── 顶部控制栏 ── */}
      <div className="flex flex-wrap items-center gap-3">

        {/* 设备选择 */}
        <select
          value={deviceId}
          onChange={(e) => { setDeviceId(Number(e.target.value)); setAlertsPage(1); setSessionsPage(1) }}
          className="rounded-sm bg-bg-surface px-2.5 py-1.5 text-xs text-text-primary ring-1 ring-[#1E2D4A] outline-none focus:ring-accent/50"
        >
          {devices?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        {/* 日期范围 */}
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-sm bg-bg-surface px-2 py-1.5 text-xs text-text-primary ring-1 ring-[#1E2D4A] outline-none focus:ring-accent/50"
          />
          <span className="text-xs text-text-secondary">—</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={today()}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-sm bg-bg-surface px-2 py-1.5 text-xs text-text-primary ring-1 ring-[#1E2D4A] outline-none focus:ring-accent/50"
          />
        </div>

        {/* 粒度切换（仅在趋势 Tab 有意义，但始终显示） */}
        <div className="flex rounded-sm ring-1 ring-[#1E2D4A] overflow-hidden">
          {(['minute', 'hour'] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={[
                'px-3 py-1.5 text-[10px] font-medium tracking-widest transition uppercase',
                granularity === g
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-secondary hover:text-text-primary',
              ].join(' ')}
            >
              {g === 'minute' ? '分钟' : '小时'}
            </button>
          ))}
        </div>

        {/* 刷新 */}
        <button
          onClick={() => {
            void refetchMinute()
            void refetchHourly()
          }}
          className="flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[10px] text-text-secondary ring-1 ring-[#1E2D4A] transition hover:text-text-primary uppercase"
        >
          <RefreshCw size={11} />
          刷新
        </button>

        <div className="flex-1" />

        {/* CSV 导出（admin only） */}
        {role === 'admin' && (
          <button
            onClick={() => { void handleExport() }}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-sm bg-accent/5 px-3 py-1.5 text-[10px] font-medium text-accent ring-1 ring-accent/30 transition hover:bg-accent/10 disabled:opacity-40 uppercase"
          >
            {exporting ? (
              <span className="h-3 w-3 animate-spin rounded-full border border-accent border-t-transparent" />
            ) : (
              <Download size={11} />
            )}
            导出 CSV
          </button>
        )}
      </div>

      {/* ── Tab 导航 ── */}
      <div className="flex border-b border-[#1E2D4A] gap-0">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={[
              'relative px-4 py-2 text-xs font-medium tracking-wider transition',
              activeTab === id
                ? 'text-accent'
                : 'text-text-secondary hover:text-text-primary',
            ].join(' ')}
          >
            {label}
            {activeTab === id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-t-sm" />
            )}
          </button>
        ))}
      </div>

      {/* ── Tab 内容 ── */}
      <div className="flex-1 overflow-auto min-h-0">

        {/* Tab 1：流量趋势 */}
        {activeTab === 'trend' && (
          <div className="h-full flex flex-col gap-2">
            {trendLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              </div>
            ) : granularity === 'minute' ? (
              minuteData.length > 0 ? (
                <RealtimeChart
                  data={minuteData.map((r) => ({ time: r.recorded_at, value: r.avg_count }))}
                  height={280}
                  title={`分钟流量 / avg_count（${minuteData.length} 条）`}
                  xFormatter={histXFormatter}
                />
              ) : (
                <EmptyState />
              )
            ) : (
              hourlyData.length > 0 ? (
                <HourlyBarChart data={hourlyData} height={280} />
              ) : (
                <EmptyState />
              )
            )}
          </div>
        )}

        {/* Tab 2：热力时间图 */}
        {activeTab === 'heatmap' && (
          <div>
            {heatmapLoading ? (
              <div className="flex h-40 items-center justify-center">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              </div>
            ) : heatmapData ? (
              <HeatmapGrid data={heatmapData.data} rows={heatmapData.rows} />
            ) : (
              <EmptyState />
            )}
          </div>
        )}

        {/* Tab 3：预警记录 */}
        {activeTab === 'alerts' && (
          <div className="flex flex-col gap-3">
            {/* 筛选器 */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-secondary">筛选：</span>
              {(['all', 'unresolved', 'resolved'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => { setAlertResolved(v); setAlertsPage(1) }}
                  className={[
                    'rounded-sm px-2.5 py-1 text-[10px] transition',
                    alertResolved === v
                      ? 'bg-accent/10 text-accent ring-1 ring-accent/40'
                      : 'text-text-secondary ring-1 ring-[#1E2D4A] hover:text-text-primary',
                  ].join(' ')}
                >
                  {v === 'all' ? '全部' : v === 'unresolved' ? '活跃' : '已解除'}
                </button>
              ))}
            </div>

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
          </div>
        )}

        {/* Tab 4：连接会话 */}
        {activeTab === 'sessions' && (
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
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-40 items-center justify-center rounded-sm border border-dashed border-[#1E2D4A]">
      <p className="text-xs text-text-secondary/40">该时段暂无数据</p>
    </div>
  )
}
