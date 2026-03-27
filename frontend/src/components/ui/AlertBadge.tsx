/**
 * 单条预警卡片（设计稿 8.1 节）
 *
 * Props:
 *   level        预警等级 0~5
 *   alertType    congestion / abnormal_stop / flow_spike / flow_zero / device_offline
 *   message      预警详情文字
 *   triggeredAt  ISO 时间字符串
 *   onResolve    传入时显示「手动解除」按钮
 */
import { alertLevelColor, alertLevelLabel, alertTypeLabel, formatDateTime } from '@/lib/utils'

interface AlertBadgeProps {
  level: number
  alertType: string
  message: string
  triggeredAt: string
  onResolve?: () => void
}

export function AlertBadge({
  level,
  alertType,
  message,
  triggeredAt,
  onResolve,
}: AlertBadgeProps) {
  const color = alertLevelColor(level)

  return (
    <div
      className="flex flex-col gap-1 rounded-sm bg-bg-panel px-3 py-2.5"
      style={{
        border: `1px solid ${color}40`,
        boxShadow: `0 0 8px ${color}15`,
      }}
    >
      {/* 顶部：等级标签 + 类型 + 时间 */}
      <div className="flex items-center gap-2">
        <span
          className="shrink-0 rounded-sm px-1.5 py-0.5 text-[9px] font-bold tracking-widest uppercase"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {alertLevelLabel(level)}
        </span>
        <span className="flex-1 truncate text-xs font-medium text-text-primary">
          {alertTypeLabel(alertType)}
        </span>
        <span className="shrink-0 font-mono text-[10px] text-text-secondary">
          {formatDateTime(triggeredAt)}
        </span>
      </div>

      {/* 消息内容 */}
      <p className="text-xs text-text-secondary leading-relaxed">{message}</p>

      {/* 手动解除按钮 */}
      {onResolve && (
        <div className="flex justify-end">
          <button
            onClick={onResolve}
            className="rounded-sm px-2 py-0.5 text-[10px] font-medium tracking-wider text-text-secondary ring-1 ring-[#1E2D4A] transition hover:text-text-primary hover:ring-text-secondary/40 uppercase"
          >
            标记已处理
          </button>
        </div>
      )}
    </div>
  )
}
