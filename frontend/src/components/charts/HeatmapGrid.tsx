/**
 * 7×24 热力时间图（设计稿 9.1 节）
 *
 * Props:
 *   data         7行×24列 数值矩阵（number[][]）
 *   rows         行标签，默认 ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
 *   colorScale   [最小色, 最大色]（未使用时默认 accent 渐变）
 *
 * 行 = 星期（Mon=周一 … Sun=周日），列 = 0~23 时
 * hover 显示具体数值 tooltip
 */
import { useState } from 'react'

const WEEKDAY_CN: Record<string, string> = {
  Mon: '周一',
  Tue: '周二',
  Wed: '周三',
  Thu: '周四',
  Fri: '周五',
  Sat: '周六',
  Sun: '周日',
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

interface HeatmapGridProps {
  data: number[][]
  rows?: string[]
}

interface HoverState {
  row: number
  col: number
  value: number
  x: number
  y: number
}

function getHeatColor(value: number, maxVal: number): string {
  if (maxVal === 0 || value === 0) return 'rgba(22, 32, 64, 0.8)' // bg-surface
  const t = Math.min(1, value / maxVal)
  // 从深色 (#162040) 渐变到 accent (#00D4FF)
  const r = Math.round(0 + t * 0)
  const g = Math.round(55 + t * (212 - 55))     // 55 → 212
  const b = Math.round(100 + t * (255 - 100))    // 100 → 255
  const a = 0.15 + t * 0.75
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

export function HeatmapGrid({ data, rows }: HeatmapGridProps) {
  const rowLabels = rows ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const [hover, setHover] = useState<HoverState | null>(null)

  // 计算全局最大值（用于颜色映射）
  const maxVal = Math.max(1, ...data.flatMap((row) => row))

  return (
    <div className="relative select-none overflow-x-auto">
      <div className="min-w-[640px]">
        {/* 列标题（小时） */}
        <div className="mb-1 flex pl-[52px]">
          {HOURS.map((h) => (
            <div
              key={h}
              className="flex-1 text-center font-mono text-[9px] text-text-secondary/60"
              style={{ minWidth: 0 }}
            >
              {h % 2 === 0 ? String(h).padStart(2, '0') : ''}
            </div>
          ))}
        </div>

        {/* 行 */}
        {rowLabels.map((rowLabel, ri) => (
          <div key={rowLabel} className="mb-1 flex items-center gap-1">
            {/* 行标题（星期） */}
            <div className="w-[44px] shrink-0 text-right font-mono text-[10px] text-text-secondary/70">
              {WEEKDAY_CN[rowLabel] ?? rowLabel}
            </div>

            {/* 单元格行 */}
            <div className="flex flex-1 gap-0.5">
              {HOURS.map((h) => {
                const val = data[ri]?.[h] ?? 0
                return (
                  <div
                    key={h}
                    className="flex-1 cursor-pointer rounded-[2px] transition-opacity hover:opacity-90"
                    style={{
                      height: 20,
                      minWidth: 0,
                      background: getHeatColor(val, maxVal),
                      border: '1px solid rgba(0,212,255,0.04)',
                    }}
                    onMouseEnter={(e) => {
                      const rect = (e.target as HTMLElement).getBoundingClientRect()
                      setHover({ row: ri, col: h, value: val, x: rect.left, y: rect.top })
                    }}
                    onMouseLeave={() => setHover(null)}
                  />
                )
              })}
            </div>
          </div>
        ))}

        {/* 图例 */}
        <div className="mt-3 flex items-center gap-2 pl-[52px]">
          <span className="text-[9px] text-text-secondary/50">少</span>
          <div
            className="h-2 flex-1 max-w-[120px] rounded-sm"
            style={{
              background: 'linear-gradient(90deg, rgba(22,32,64,0.8) 0%, rgba(0,212,255,0.9) 100%)',
            }}
          />
          <span className="text-[9px] text-text-secondary/50">多</span>
        </div>
      </div>

      {/* Hover Tooltip */}
      {hover !== null && (
        <div
          className="pointer-events-none fixed z-50 rounded-sm bg-bg-panel px-2.5 py-1.5 text-xs shadow-xl ring-1 ring-[#1E2D4A]"
          style={{
            left: hover.x + 4,
            top: hover.y - 40,
            transform: 'translateX(-50%)',
          }}
        >
          <span className="text-text-secondary">
            {WEEKDAY_CN[rowLabels[hover.row]] ?? rowLabels[hover.row]}&nbsp;
            {String(hover.col).padStart(2, '0')}:00
          </span>
          <span className="ml-2 font-mono font-bold text-accent">
            {hover.value.toLocaleString('zh-CN')}
          </span>
          <span className="ml-1 text-text-secondary/60">辆</span>
        </div>
      )}
    </div>
  )
}
