/**
 * Dashboard — 实时监控仪表盘（主布局）
 *
 * ┌──────────┬─────────────────────┬──────────────────────┐
 * │ 指标列    │   视频面板           │  轨迹画布              │
 * │ 7 张卡片  │   VideoPanel        ├──────────────────────┤
 * │          │                     │  实时折线图             │
 * │          │                     ├──────────────────────┤
 * │          │                     │  活跃预警列表           │
 * ├──────────┴─────────────────────┴──────────────────────┤
 * │               底部全宽状态条                             │
 * └────────────────────────────────────────────────────────┘
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTrafficStore }  from '@/store/useTrafficStore'
import { useStreamSocket }  from '@/hooks/useStreamSocket'
import { useHealthSocket }  from '@/hooks/useHealthSocket'
import { useResolveAlert }  from '@/lib/api'
import { alertLevelHex }    from '@/lib/utils'
import { VideoPanel }        from '@/components/video/VideoPanel'
import { TrajectoryCanvas }  from '@/components/video/TrajectoryCanvas'
import { RealtimeChart }     from '@/components/charts/RealtimeChart'
import { HudPanel }          from '@/components/ui/HudPanel'
import { MetricsColumn }     from '@/components/dashboard/MetricsColumn'
import { AlertPanel }        from '@/components/dashboard/AlertPanel'
import { BottomStatusBar }   from '@/components/dashboard/BottomStatusBar'
import type { HealthReportMsg } from '@/types/websocket'

const LOS_COLOR: Record<string, string> = {
  A: '#34c759', B: '#8bc34a', C: '#ffcc00', D: '#ff9500', E: '#ff3b30', F: '#c0392b',
}

export default function Dashboard() {
  // ── store ─────────────────────────────────────────────────────────────────
  const selectedDeviceId   = useTrafficStore((s) => s.selectedDeviceId)
  const alertLevel         = useTrafficStore((s) => s.alertLevel)
  const activeAlerts       = useTrafficStore((s) => s.activeAlerts)
  const isDeviceOnline     = useTrafficStore((s) => s.isDeviceOnline)
  const lineY              = useTrafficStore((s) => s.lineY)
  const realtimeHistory    = useTrafficStore((s) => s.realtimeHistory)
  const realtimeOccHistory = useTrafficStore((s) => s.realtimeOccupancyHistory)
  const passedCount        = useTrafficStore((s) => s.passedCount)
  const losGrade           = useTrafficStore((s) => s.losGrade)
  const storeResolveAlert  = useTrafficStore((s) => s.resolveAlert)
  // 正确的 reactive 订阅，不用 getState()
  const trackCount         = useTrafficStore((s) => s.trackHistoryMap.size)

  // ── sockets ───────────────────────────────────────────────────────────────
  const { isConnected }       = useStreamSocket(selectedDeviceId)
  const [healthReport, setHealthReport] = useState<HealthReportMsg | null>(null)
  useHealthSocket({ onReport: setHealthReport })
  const { mutate: resolveAlertApi } = useResolveAlert()

  // ── 派生状态 ──────────────────────────────────────────────────────────────
  const deviceHealth = healthReport?.devices.find((d) => d.device_id === selectedDeviceId) ?? null
  const serverHealth = healthReport?.server ?? null

  const deviceStatus: 'online' | 'offline' | 'warning' = !isConnected
    ? 'offline'
    : isDeviceOnline
    ? alertLevel > 0 ? 'warning' : 'online'
    : 'offline'

  const videoBorderColor = alertLevel >= 3 ? alertLevelHex(Math.min(alertLevel, 5)) : '#00D4FF'

  const handleResolveAlert = (alertId: number) => {
    storeResolveAlert(alertId)
    resolveAlertApi({ id: alertId, resolved_by: 'manual' })
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden p-2.5">

      {/* ═══ 主内容区（三大列）═════════════════════════════════════════════ */}
      <div className="flex min-h-0 flex-1 gap-2">

        {/* ── LEFT：指标卡片列 ─────────────────────────────────────────── */}
        <MetricsColumn isConnected={isConnected} deviceHealth={deviceHealth} />

        {/* ── CENTER：视频面板 ─────────────────────────────────────────── */}
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

        {/* ── RIGHT：轨迹画布 + 折线图 + 预警列表 ─────────────────────── */}
        <div className="flex w-[300px] flex-shrink-0 flex-col gap-2">

          {/* 轨迹画布（noPadding 保证 canvas 铺满，default aspect-[4/3]） */}
          <HudPanel
            title="轨迹投影"
            titleRight={
              <span className="font-mono text-[8px] text-text-secondary/40">
                {trackCount} tracks
              </span>
            }
            noPadding
            className="flex-shrink-0"
          >
            <TrajectoryCanvas lineY={lineY} />
          </HudPanel>

          {/* 实时折线图：车辆数 + 占道率 */}
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
                <span style={{ color: LOS_COLOR[losGrade] ?? '#34c759' }}>● 占道率%</span>
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

      {/* ═══ 底部全宽状态条 ════════════════════════════════════════════════ */}
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
