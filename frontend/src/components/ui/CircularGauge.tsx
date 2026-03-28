/**
 * 环形仪表盘组件
 *
 * 使用 SVG 路径 + framer-motion pathLength 动画绘制 270° 弧形仪表。
 * 刻度线 · 呼吸光晕 · 数字滚动动画 · 阈值变色
 */
import { memo, useEffect } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'

// ── SVG 工具 ─────────────────────────────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

/**
 * 生成 SVG A 弧路径字符串（顺时针）
 * startDeg/endDeg 均以 12 点方向为 0°，顺时针增大
 */
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polarToCartesian(cx, cy, r, startDeg)
  const e = polarToCartesian(cx, cy, r, endDeg)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return [
    `M ${s.x.toFixed(3)} ${s.y.toFixed(3)}`,
    `A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(3)} ${e.y.toFixed(3)}`,
  ].join(' ')
}

// ── 组件 ──────────────────────────────────────────────────────────────────────

interface CircularGaugeProps {
  value: number
  /** 满量程（默认 50） */
  max?: number
  /** 正常颜色（默认 accent cyan） */
  color?: string
  /** 尺寸 px（默认 150） */
  size?: number
  /** 中心主标签（如 "辆"） */
  label?: string
  /** 中心副标签（如 "当前车辆"） */
  sublabel?: string
  /** 警告阈值（value >= warn → 橙色） */
  warnThreshold?: number
  /** 危险阈值（value >= danger → 红色） */
  dangerThreshold?: number
  /** 刻度数量（默认 9，含两端） */
  ticks?: number
}

export const CircularGauge = memo(function CircularGauge({
  value,
  max = 50,
  color: baseColor = '#00D4FF',
  size = 150,
  label,
  sublabel,
  warnThreshold,
  dangerThreshold,
  ticks = 9,
}: CircularGaugeProps) {
  // 仪表圆弧参数：从 7:30（225°）开始，顺时针 270° 到 4:30（495°）
  const CX = 50, CY = 50, R = 37
  const START = 225
  const SWEEP = 270

  // 阈值变色
  let color = baseColor
  if (dangerThreshold !== undefined && value >= dangerThreshold) color = '#F44336'
  else if (warnThreshold !== undefined && value >= warnThreshold) color = '#FF9800'

  const progress = Math.min(value / max, 1)

  // 数字滚动
  const mv = useMotionValue(0)
  const displayValue = useTransform(mv, (v) => Math.round(v).toLocaleString('zh-CN'))
  useEffect(() => {
    const ctrl = animate(mv, value, { duration: 0.5, ease: 'easeOut' })
    return ctrl.stop
  }, [mv, value])

  const fullArc  = arcPath(CX, CY, R, START, START + SWEEP)
  const glowId   = `gauge-glow-${label ?? 'g'}`
  const gradId   = `gauge-grad-${label ?? 'g'}`

  // 端点（用于发光圆）
  const tipAngle = START + progress * SWEEP
  const tip      = polarToCartesian(CX, CY, R, tipAngle)

  const fontSize = Math.round(size * 0.21)

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100" overflow="visible">
        <defs>
          <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={color} stopOpacity="0.08" />
            <stop offset="100%" stopColor={color} stopOpacity="0"    />
          </radialGradient>
        </defs>

        {/* 中心背景渐变光晕 */}
        <circle cx={CX} cy={CY} r={R - 3} fill={`url(#${gradId})`} />

        {/* 背景弧（暗色轨道） */}
        <path
          d={fullArc}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* 刻度线 */}
        {Array.from({ length: ticks }, (_, i) => {
          const angle  = START + (i / (ticks - 1)) * SWEEP
          const inner  = polarToCartesian(CX, CY, R - 3, angle)
          const outer  = polarToCartesian(CX, CY, R + 3, angle)
          const filled = i / (ticks - 1) <= progress
          const major  = i % Math.floor((ticks - 1) / 2) === 0
          return (
            <line
              key={i}
              x1={inner.x.toFixed(2)} y1={inner.y.toFixed(2)}
              x2={outer.x.toFixed(2)} y2={outer.y.toFixed(2)}
              stroke={filled ? `${color}90` : 'rgba(255,255,255,0.08)'}
              strokeWidth={major ? 2 : 1}
            />
          )
        })}

        {/* 发光层（模糊重叠） */}
        {progress > 0.005 && (
          <motion.path
            d={fullArc}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeLinecap="round"
            opacity="0.22"
            style={{ filter: `blur(3px)` }}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: progress }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        )}

        {/* 主弧 */}
        {progress > 0.005 && (
          <motion.path
            d={fullArc}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            filter={`url(#${glowId})`}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: progress }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        )}

        {/* 端点发光圆 */}
        {progress > 0.02 && (
          <motion.circle
            cx={tip.x}
            cy={tip.y}
            r="3.5"
            fill={color}
            animate={{ r: [3, 5, 3], opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </svg>

      {/* 中心文字 */}
      <div className="pointer-events-none absolute flex flex-col items-center justify-center text-center">
        <span
          className="font-display font-black leading-none tabular-nums"
          style={{ fontSize, color, textShadow: `0 0 14px ${color}55` }}
        >
          <motion.span>{displayValue}</motion.span>
        </span>
        {label && (
          <span
            className="font-display font-bold tracking-[0.18em] text-text-secondary uppercase"
            style={{ fontSize: Math.round(size * 0.062), marginTop: 3 }}
          >
            {label}
          </span>
        )}
        {sublabel && (
          <span
            className="font-mono text-text-secondary/40"
            style={{ fontSize: Math.round(size * 0.052), marginTop: 2 }}
          >
            {sublabel}
          </span>
        )}
      </div>
    </div>
  )
})
