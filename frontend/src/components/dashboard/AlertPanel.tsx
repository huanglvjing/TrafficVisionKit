/**
 * AlertPanel — 活跃预警面板（右侧列底部）
 * 根据当前预警等级动态改变边框颜色和呼吸闪烁效果。
 */
import { motion, AnimatePresence } from 'framer-motion'
import { HudCorners } from '@/components/video/HudCorners'
import { AlertList }  from '@/components/ui/AlertList'
import { alertLevelHex } from '@/lib/utils'
import type { AlertItem } from '@/types/models'

interface Props {
  activeAlerts: AlertItem[]
  alertLevel: number
  onResolve: (id: number) => void
}

export function AlertPanel({ activeAlerts, alertLevel, onResolve }: Props) {
  const clamped = Math.min(Math.max(alertLevel, 0), 5)
  const color   = alertLevelHex(clamped)

  const flashAnim =
    clamped >= 4 ? { opacity: [1, 0.25, 1] } :
    clamped >= 3 ? { opacity: [1, 0.5,  1] } : {}
  const flashDuration = clamped >= 4 ? 0.5 : 1.0

  return (
    <motion.div
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-sm bg-bg-panel"
      style={{ border: `1px solid ${clamped > 0 ? color : 'rgba(0,212,255,0.1)'}` }}
      animate={
        clamped > 1
          ? { boxShadow: [`0 0 0px ${color}00`, `0 0 14px ${color}40`, `0 0 0px ${color}00`] }
          : {}
      }
      transition={{ duration: flashDuration, repeat: Infinity }}
    >
      <HudCorners
        color={clamped > 0 ? color : '#00D4FF'}
        length={10} thickness={1} pulse={false}
      />

      {/* 标题行 */}
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

      {/* 预警列表 */}
      <div className="flex-1 overflow-y-auto p-2">
        <AlertList alerts={activeAlerts} maxItems={10} onResolve={onResolve} />
      </div>
    </motion.div>
  )
}
