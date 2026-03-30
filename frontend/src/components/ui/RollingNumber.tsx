/**
 * RollingNumber — 数字平滑滚动动画组件（全局共用）
 *
 * 数值变化时在 duration 内平滑插值，视觉上形成"数字翻牌"效果。
 * 高频更新场景（如延迟 ms）请直接渲染文字，不要用此组件。
 */
import { useEffect } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'

export interface RollingNumberProps {
  value: number
  color?: string
  className?: string
  /** 自定义格式化函数，默认用 zh-CN 千分位 */
  format?: (v: number) => string
  /** 动画时长（秒），默认 0.45 */
  duration?: number
}

export function RollingNumber({
  value,
  color = 'inherit',
  className = '',
  format,
  duration = 0.45,
}: RollingNumberProps) {
  const mv      = useMotionValue(0)
  const display = useTransform(mv, (v) =>
    format ? format(v) : Math.round(v).toLocaleString('zh-CN'),
  )

  useEffect(() => {
    const ctrl = animate(mv, value, { duration, ease: 'easeOut' })
    return ctrl.stop
  }, [mv, value, duration])

  return (
    <motion.span className={className} style={{ color }}>
      {display}
    </motion.span>
  )
}
