/**
 * 统计卡片（设计稿 8.1 节）
 *
 * Props:
 *   title        卡片标题
 *   value        显示值（数字或字符串）
 *   unit         单位（可选）
 *   icon         左上角图标（可选）
 *   format       数字格式化函数（可选）
 *   alertLevel   0=accent边框，1~5=对应预警色边框
 *   animateNumber 是否启用 Framer Motion 数字翻牌动画（仅 number 类型 value 生效）
 */
import { useEffect } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { alertLevelColor } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: number | string
  unit?: string
  icon?: React.ReactNode
  format?: (val: number) => string
  alertLevel?: number
  animateNumber?: boolean
  className?: string
}

function AnimatedNumber({ value, format }: { value: number; format?: (v: number) => string }) {
  const mv = useMotionValue(value)
  const display = useTransform(mv, (v) =>
    format ? format(v) : Math.round(v).toLocaleString('zh-CN')
  )

  useEffect(() => {
    const controls = animate(mv, value, {
      duration: 0.4,
      ease: 'easeOut',
    })
    return controls.stop
  }, [mv, value])

  return <motion.span>{display}</motion.span>
}

export function StatCard({
  title,
  value,
  unit,
  icon,
  format,
  alertLevel = 0,
  animateNumber = false,
  className = '',
}: StatCardProps) {
  const borderColor = alertLevelColor(alertLevel)
  const isNumeric = typeof value === 'number'

  return (
    <div
      className={`relative flex flex-col gap-1 rounded-sm bg-bg-panel p-3 ${className}`}
      style={{
        border: `1px solid ${alertLevel > 0 ? borderColor : 'rgba(0,212,255,0.2)'}`,
        boxShadow:
          alertLevel > 0
            ? `0 0 12px ${borderColor}30, inset 0 0 8px ${borderColor}10`
            : undefined,
      }}
    >
      {/* 顶部：标题 + 图标 */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium tracking-widest text-text-secondary uppercase">
          {title}
        </span>
        {icon && <span className="text-text-secondary opacity-60">{icon}</span>}
      </div>

      {/* 主值 */}
      <div className="flex items-baseline gap-1">
        <span
          className="font-mono text-2xl font-bold leading-none text-text-primary"
          style={{ color: alertLevel > 0 ? borderColor : undefined }}
        >
          {animateNumber && isNumeric ? (
            <AnimatedNumber value={value as number} format={format} />
          ) : (
            <span>
              {isNumeric && format
                ? format(value as number)
                : isNumeric
                ? Math.round(value as number).toLocaleString('zh-CN')
                : value}
            </span>
          )}
        </span>
        {unit && (
          <span className="text-xs text-text-secondary">{unit}</span>
        )}
      </div>

      {/* alertLevel > 0 时右下角小标签 */}
      {alertLevel > 0 && (
        <span
          className="absolute bottom-2 right-2 text-[9px] font-bold tracking-widest uppercase opacity-70"
          style={{ color: borderColor }}
        >
          ALERT L{alertLevel}
        </span>
      )}
    </div>
  )
}
