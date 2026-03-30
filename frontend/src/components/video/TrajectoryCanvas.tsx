/**
 * 轨迹画布组件 — 等比映射视频坐标，实时绘制 ByteTrack 追踪轨迹
 *
 * 关键约束：
 *   canvas 内部分辨率 320×240（与视频 640×480 保持 1:2 缩放）。
 *   CSS 层必须维持 4:3 比例，否则 X/Y 缩放系数不一致，坐标偏移。
 *   默认 className="w-full aspect-[4/3]" 已保证比例正确，外部调用者
 *   若自定义 className，需自行保证容器为 4:3，否则轨迹会错位。
 */
import { useRef, useEffect, useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { useTrafficStore, type TrackPoint } from '@/store/useTrafficStore'
import type { VehicleDetection } from '@/types/websocket'

// ── 内部画布分辨率（与视频源 640×480 的缩放比为 0.5）─────────────────────────
export const CANVAS_W = 320
export const CANVAS_H = 240
const SRC_W = 640
const SRC_H = 480

// ── 颜色常量 ──────────────────────────────────────────────────────────────────
const COLOR_NORMAL   = '#00f0ff'
const COLOR_PARKED   = '#ff9500'
const COLOR_ALERTED  = '#ff3b30'
const COLOR_WRONGWAY = '#ff2d55'
const COLOR_SPEEDING = '#ffcc00'

function getVehicleColor(v: VehicleDetection): string {
  if (v.is_wrong_way)                       return COLOR_WRONGWAY
  if (v.is_parked)                           return COLOR_ALERTED
  if (v.speed_kmh !== null && v.speed_kmh > 0) return COLOR_SPEEDING
  return COLOR_NORMAL
}

// ── Tooltip ──────────────────────────────────────────────────────────────────
interface TooltipInfo {
  x: number; y: number
  trackId: number
  speedKmh: number | null
  isParked: boolean
  isWrongWay: boolean
}

interface Props {
  /** 原始像素空间（640×480）的计数线 Y 坐标 */
  lineY: number
  roiX1?: number; roiY1?: number
  roiX2?: number; roiY2?: number
  /**
   * 外部样式，**必须保证容器为 4:3 比例**。
   * 默认值 "w-full aspect-[4/3]" 已满足约束。
   */
  className?: string
}

export function TrajectoryCanvas({
  lineY,
  roiX1 = 0, roiY1 = 0,
  roiX2 = SRC_W, roiY2 = SRC_H,
  className = 'w-full aspect-[4/3]',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)

  const trackHistoryMap    = useTrafficStore((s) => s.trackHistoryMap)
  const vehicles           = useTrafficStore((s) => s.vehicles)
  const highlightedTrackId = useTrafficStore((s) => s.highlightedTrackId)
  const setHighlighted     = useTrafficStore((s) => s.setHighlightedTrackId)

  const scaleX = CANVAS_W / SRC_W   // 0.5
  const scaleY = CANVAS_H / SRC_H   // 0.5

  // 画布空间坐标（计数线 + ROI）
  const canvasLineY = lineY * scaleY
  const canvasRoi = {
    x: roiX1 * scaleX,
    y: roiY1 * scaleY,
    w: (roiX2 - roiX1) * scaleX,
    h: (roiY2 - roiY1) * scaleY,
  }

  // 构建 vehicle 查找 Map
  const vehicleMap = new Map<number, VehicleDetection>()
  for (const v of vehicles) vehicleMap.set(v.tracking_id, v)

  // ── 渲染循环 ─────────────────────────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 拖尾：低透明黑色覆盖，旧轨迹自然淡出
    ctx.fillStyle = 'rgba(0,0,0,0.20)'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    // ROI 虚线框
    ctx.strokeStyle = 'rgba(0,240,255,0.18)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.strokeRect(canvasRoi.x, canvasRoi.y, canvasRoi.w, canvasRoi.h)
    ctx.setLineDash([])

    // 计数线
    ctx.strokeStyle = 'rgba(0,240,255,0.45)'
    ctx.lineWidth = 1
    ctx.setLineDash([6, 4])
    ctx.beginPath()
    ctx.moveTo(0, canvasLineY)
    ctx.lineTo(CANVAS_W, canvasLineY)
    ctx.stroke()
    ctx.setLineDash([])

    // ── 每辆车的轨迹 + 当前点 ──────────────────────────────────────────────
    for (const [trackId, hist] of trackHistoryMap) {
      if (!hist.length) continue
      const vehicle       = vehicleMap.get(trackId)
      const color         = vehicle ? getVehicleColor(vehicle) : COLOR_NORMAL
      const isHighlighted = trackId === highlightedTrackId

      // 渐变透明度拖尾
      if (hist.length >= 2) {
        for (let i = 1; i < hist.length; i++) {
          const alpha = (i / hist.length) * 0.65
          const hexAlpha = Math.round(alpha * 255).toString(16).padStart(2, '0')
          ctx.strokeStyle = `${color}${hexAlpha}`
          ctx.lineWidth = isHighlighted ? 2.5 : 1.5
          ctx.beginPath()
          ctx.moveTo(hist[i - 1].cx, hist[i - 1].cy)
          ctx.lineTo(hist[i].cx, hist[i].cy)
          ctx.stroke()
        }
      }

      const last = hist[hist.length - 1]

      // 点半径根据 bbox 面积估算
      let radius = 5
      if (vehicle) {
        const bboxW = (vehicle.bbox[2] - vehicle.bbox[0]) * scaleX
        const bboxH = (vehicle.bbox[3] - vehicle.bbox[1]) * scaleY
        radius = Math.max(4, Math.min(10, Math.sqrt(bboxW * bboxH) * 0.2))
      }

      // 高亮光晕
      if (isHighlighted) {
        ctx.beginPath()
        ctx.arc(last.cx, last.cy, radius + 6, 0, Math.PI * 2)
        ctx.fillStyle = `${color}40`
        ctx.fill()
      }

      // 异常停车脉冲光晕
      if (vehicle?.is_parked) {
        const glowAlpha = Math.abs(Math.sin(Date.now() / 400)) * 0.45
        const ha = Math.round(glowAlpha * 255).toString(16).padStart(2, '0')
        ctx.beginPath()
        ctx.arc(last.cx, last.cy, radius + 6, 0, Math.PI * 2)
        ctx.fillStyle = `${COLOR_ALERTED}${ha}`
        ctx.fill()
      }

      // 外发光圈（代替 shadowBlur，避免每帧触发 GPU 软件渲染）
      const glowR = isHighlighted ? radius + 4 : radius + 2
      ctx.beginPath()
      ctx.arc(last.cx, last.cy, glowR, 0, Math.PI * 2)
      ctx.fillStyle = `${color}30`
      ctx.fill()

      // 实心圆点（无 shadowBlur，性能友好）
      ctx.beginPath()
      ctx.arc(last.cx, last.cy, radius, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
    }

    rafRef.current = requestAnimationFrame(render)
  }, [trackHistoryMap, vehicleMap, highlightedTrackId, canvasLineY, canvasRoi, scaleX, scaleY])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafRef.current)
  }, [render])

  // ── 鼠标事件（正确的坐标转换：CSS像素→画布内部坐标）─────────────────────────
  const toCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return null
    const scaleFactorX = CANVAS_W / rect.width
    const scaleFactorY = CANVAS_H / rect.height
    return {
      cx: (e.clientX - rect.left) * scaleFactorX,
      cy: (e.clientY - rect.top) * scaleFactorY,
      cssX: e.clientX - rect.left,
      cssY: e.clientY - rect.top,
    }
  }

  const findClosest = (cx: number, cy: number) => {
    let closest: { id: number; dist: number; pt: TrackPoint } | null = null
    for (const [trackId, hist] of trackHistoryMap) {
      if (!hist.length) continue
      const last = hist[hist.length - 1]
      const dist = Math.sqrt((last.cx - cx) ** 2 + (last.cy - cy) ** 2)
      if (!closest || dist < closest.dist) closest = { id: trackId, dist, pt: last }
    }
    return closest
  }

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const coords = toCanvasCoords(e)
      if (!coords) return
      const closest = findClosest(coords.cx, coords.cy)
      if (closest && closest.dist < 18) {
        const v = vehicleMap.get(closest.id)
        setTooltip({
          x: coords.cssX, y: coords.cssY,
          trackId: closest.id,
          speedKmh: v?.speed_kmh ?? null,
          isParked: v?.is_parked ?? false,
          isWrongWay: v?.is_wrong_way ?? false,
        })
      } else {
        setTooltip(null)
      }
    },
    [trackHistoryMap, vehicleMap],
  )

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const coords = toCanvasCoords(e)
      if (!coords) return
      const closest = findClosest(coords.cx, coords.cy)
      if (closest && closest.dist < 18) {
        setHighlighted(closest.id === highlightedTrackId ? null : closest.id)
      } else {
        setHighlighted(null)
      }
    },
    [trackHistoryMap, highlightedTrackId, setHighlighted],
  )

  return (
    <div className={`relative overflow-hidden rounded-sm ${className}`} style={{ background: '#050a12' }}>
      {/* 网格背景（CSS 实现，零 JS 开销，纯 GPU 合成） */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,240,255,0.04) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(0,240,255,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* 主画布 — CSS h-full w-full 填满容器，保持 4:3 比例不变形 */}
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="absolute inset-0 h-full w-full cursor-crosshair"
        style={{ background: 'transparent' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        onClick={handleClick}
      />

      {/* 扫描线动画（用 y transform，不触发 layout reflow） */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute inset-x-0 top-0 h-[1px]"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(0,240,255,0.5) 50%, transparent 100%)',
          }}
          animate={{ y: [0, 260] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 0.8 }}
        />
      </div>

      {/* 四角装饰 */}
      {[
        'top-0 left-0 border-t border-l',
        'top-0 right-0 border-t border-r',
        'bottom-0 left-0 border-b border-l',
        'bottom-0 right-0 border-b border-r',
      ].map((pos) => (
        <div
          key={pos}
          className={`pointer-events-none absolute h-4 w-4 ${pos} border-accent/40`}
        />
      ))}

      {/* 标题角标 */}
      <div className="absolute left-2 top-2 font-display text-[8px] tracking-[0.18em] text-text-secondary/40 uppercase select-none">
        TRAJECTORY
      </div>

      {/* 图例 */}
      <div className="absolute bottom-2 left-2 flex flex-col gap-0.5 select-none">
        {[
          { color: COLOR_NORMAL,   label: '正常' },
          { color: COLOR_PARKED,   label: '停车' },
          { color: COLOR_WRONGWAY, label: '逆行' },
          { color: COLOR_SPEEDING, label: '超速' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0"
              style={{ background: color, boxShadow: `0 0 4px ${color}` }}
            />
            <span className="font-mono text-[7px] text-text-secondary/40">{label}</span>
          </div>
        ))}
      </div>

      {/* Hover Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-sm px-2 py-1.5"
          style={{
            left: Math.min(tooltip.x + 10, 170),
            top: Math.max(tooltip.y - 52, 4),
            background: 'rgba(5,10,18,0.92)',
            border: '1px solid rgba(0,240,255,0.22)',
            minWidth: 100,
          }}
        >
          <p className="font-mono text-[9px] text-text-secondary/60">
            ID: <span className="text-accent">{tooltip.trackId}</span>
          </p>
          {tooltip.speedKmh !== null && (
            <p className="font-mono text-[9px] text-text-secondary/60">
              速度: <span className="text-[#ffcc00]">{tooltip.speedKmh.toFixed(1)} km/h</span>
            </p>
          )}
          {tooltip.isParked   && <p className="font-mono text-[9px] text-[#ff3b30]">异常停车</p>}
          {tooltip.isWrongWay && <p className="font-mono text-[9px] text-[#ff2d55]">逆行警告</p>}
        </div>
      )}
    </div>
  )
}
