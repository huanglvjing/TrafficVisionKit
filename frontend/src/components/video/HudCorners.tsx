/**
 * HUD 角标装饰 — 独立线段式设计
 *
 * 每个角由 2 条独立线段（水平臂 + 垂直臂）组成，互不重叠，
 * 避免 CSS border 方案在角点产生小方块 artifact。
 * box-shadow 仅作用于各自的细长线段，产生干净的 LED 光晕效果。
 */
import { motion } from 'framer-motion'

interface HudCornersProps {
  color?: string
  length?: number
  thickness?: number
  pulse?: boolean
  duration?: number
}

interface ArmStyle {
  top?: number | string
  right?: number | string
  bottom?: number | string
  left?: number | string
  width: number | string
  height: number | string
}

export function HudCorners({
  color = '#00D4FF',
  length = 16,
  thickness = 2,
  pulse = true,
  duration = 3,
}: HudCornersProps) {
  const glow = `0 0 6px ${color}80, 0 0 2px ${color}`

  // 每个角 2 条臂：水平臂先绘（满 length），垂直臂避开水平臂占用的 thickness 高度
  const arms: Array<{ style: ArmStyle; delay: number }> = [
    // ── 左上角 ──
    { style: { top: 0, left: 0, width: length, height: thickness }, delay: 0 },
    { style: { top: thickness, left: 0, width: thickness, height: length - thickness }, delay: 0 },
    // ── 右上角 ──
    { style: { top: 0, right: 0, width: length, height: thickness }, delay: duration * 0.25 },
    { style: { top: thickness, right: 0, width: thickness, height: length - thickness }, delay: duration * 0.25 },
    // ── 左下角 ──
    { style: { bottom: 0, left: 0, width: length, height: thickness }, delay: duration * 0.5 },
    { style: { bottom: thickness, left: 0, width: thickness, height: length - thickness }, delay: duration * 0.5 },
    // ── 右下角 ──
    { style: { bottom: 0, right: 0, width: length, height: thickness }, delay: duration * 0.75 },
    { style: { bottom: thickness, right: 0, width: thickness, height: length - thickness }, delay: duration * 0.75 },
  ]

  return (
    <>
      {arms.map((arm, i) => (
        <motion.div
          key={i}
          className="pointer-events-none absolute z-20"
          style={{
            ...arm.style,
            background: color,
            boxShadow: glow,
          }}
          animate={pulse ? { opacity: [0.45, 1, 0.45] } : { opacity: 0.8 }}
          transition={
            pulse
              ? { duration, repeat: Infinity, delay: arm.delay, ease: 'easeInOut' }
              : {}
          }
        />
      ))}
    </>
  )
}
