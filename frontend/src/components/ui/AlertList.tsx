/**
 * 预警列表（AnimatePresence 滑入/淡出动画，设计稿 8.1 节）
 *
 * Props:
 *   alerts    AlertItem 数组
 *   maxItems  最多展示条数（超出折叠，默认 5）
 *   onResolve 传入时各条预警显示「手动解除」按钮
 */
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertBadge } from './AlertBadge'
import type { AlertItem } from '@/types/models'

interface AlertListProps {
  alerts: AlertItem[]
  maxItems?: number
  onResolve?: (id: number) => void
}

export function AlertList({ alerts, maxItems = 5, onResolve }: AlertListProps) {
  const [expanded, setExpanded] = useState(false)

  if (alerts.length === 0) {
    return (
      <div className="flex h-full min-h-[60px] items-center justify-center rounded-sm border border-dashed border-[#1E2D4A]">
        <p className="text-xs tracking-widest text-text-secondary/40 uppercase">
          无活跃预警
        </p>
      </div>
    )
  }

  const visible = expanded ? alerts : alerts.slice(0, maxItems)
  const hidden = alerts.length - maxItems

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium tracking-widest text-text-secondary uppercase">
          活跃预警 ({alerts.length})
        </span>
        {hidden > 0 && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="text-[10px] text-accent hover:underline"
          >
            +{hidden} 条更多
          </button>
        )}
        {expanded && (
          <button
            onClick={() => setExpanded(false)}
            className="text-[10px] text-text-secondary hover:text-text-primary"
          >
            收起
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {visible.map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <AlertBadge
                level={alert.level}
                alertType={alert.alert_type}
                message={alert.message}
                triggeredAt={alert.triggered_at}
                onResolve={onResolve ? () => onResolve(alert.id) : undefined}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
