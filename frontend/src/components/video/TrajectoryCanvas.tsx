/**
 * 轨迹画布组件 — 将 ByteTrack 追踪轨迹实时绘制在抽象坐标空间
 *
 * 渲染策略：
 *   每帧先用低透明度黑色矩形覆盖全画布，旧轨迹自然淡出（经典拖尾技巧）。
 *   当前最新位置绘制彩色圆点，点颜色按车辆状态编码。
 *   Hover 显示浮动 Tooltip，Click 联动视频检测框高亮。
 */
import { useRef, useEffect, useCallback, useState } from 'react'
import { useTrafficStore, type TrackPoint } from '@/store/useTrafficStore'
import type { VehicleDetection } from '@/types/websocket'

// ── 尺寸常量（与 store 中的缩放系数保持一致）────────────────────────────────
export const CANVAS_W = 320
export const CANVAS_H = 240

// ── 颜色常量 ──────────────────────────────────────────────────────────────────
const COLOR_NORMAL    = '#00f0ff'   // accent 青色
const COLOR_PARKED    = '#ff9500'   // 静止超阈值（橙色）
const COLOR_ALERTED   = '#ff3b30'   // 已触发异常停车（红色）
const COLOR_WRONGWAY  = '#ff2d55'   // 逆行（玫红）
const COLOR_SPEEDING  = '#ffcc00'   // 超速（黄色）

function getVehicleColor(v: VehicleDetection): string {
  if (v.is_wrong_way) return COLOR_WRONGWAY
  if (v.is_parked) return COLOR_ALERTED
  if (v.speed_kmh !== null && v.speed_kmh > 0) return COLOR_SPEEDING
  return COLOR_NORMAL
}

// ── Tooltip 类型 ──────────────────────────────────────────────────────────────
interface TooltipInfo {
  x: number
  y: number
  trackId: number
  speedKmh: number | null
  isParked: boolean
  isWrongWay: boolean
}

interface Props {
  lineY: number           // 原始像素空间的 line_y（会缩放到画布）
  roiX1?: number
  roiY1?: number
  roiX2?: number
  roiY2?: number
  className?: string
}

export function TrajectoryCanvas({
  lineY,
  roiX1 = 0,
  roiY1 = 0,
  roiX2 = 640,
  roiY2 = 480,
  className = '',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)

  const trackHistoryMap  = useTrafficStore((s) => s.trackHistoryMap)
  const vehicles         = useTrafficStore((s) => s.vehicles)
  const highlightedTrackId = useTrafficStore((s) => s.highlightedTrackId)
  const setHighlighted   = useTrafficStore((s) => s.setHighlightedTrackId)

  // 缩放系数
  const scaleX = CANVAS_W / 640
  const scaleY = CANVAS_H / 480

  // 辅助线坐标（画布空间）
  const canvasLineY = lineY * scaleY
  const canvasRoi = {
    x: roiX1 * scaleX,
    y: roiY1 * scaleY,
    w: (roiX2 - roiX1) * scaleX,
    h: (roiY2 - roiY1) * scaleY,
  }

  // 构建 vehicle 查找 Map（by tracking_id）
  const vehicleMap = new Map<number, VehicleDetection>()
  for (const v of vehicles) vehicleMap.set(v.tracking_id, v)

  // ── 渲染逻辑 ────────────────────────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 拖尾淡出：低透明度黑色覆盖
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    // ── ROI 半透明矩形 ──────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.strokeRect(canvasRoi.x, canvasRoi.y, canvasRoi.w, canvasRoi.h)
    ctx.setLineDash([])

    // ── 计数线虚线 ──────────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)'
    ctx.lineWidth = 1
    ctx.setLineDash([6, 4])
    ctx.beginPath()
    ctx.moveTo(0, canvasLineY)
    ctx.lineTo(CANVAS_W, canvasLineY)
    ctx.stroke()
    ctx.setLineDash([])

    // ── 每辆车的轨迹 + 当前点 ───────────────────────────────────────────────
    for (const [trackId, hist] of trackHistoryMap) {
      if (hist.length === 0) continue
      const vehicle = vehicleMap.get(trackId)
      const color   = vehicle ? getVehicleColor(vehicle) : COLOR_NORMAL
      const isHighlighted = trackId === highlightedTrackId

      // 拖尾折线（渐变透明度，最老的点最透明）
      if (hist.length >= 2) {
        for (let i = 1; i < hist.length; i++) {
          const alpha = (i / hist.length) * 0.6
          ctx.strokeStyle = `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`
          ctx.lineWidth = isHighlighted ? 2 : 1
          ctx.beginPath()
          ctx.moveTo(hist[i - 1].cx, hist[i - 1].cy)
          ctx.lineTo(hist[i].cx, hist[i].cy)
          ctx.stroke()
        }
      }

      // 最新位置圆点
      const last = hist[hist.length - 1]
      // 圆点大小：根据 bbox 面积估算（vehicle 存在时）
      let radius = 5
      if (vehicle) {
        const bboxW = (vehicle.bbox[2] - vehicle.bbox[0]) * scaleX
        const bboxH = (vehicle.bbox[3] - vehicle.bbox[1]) * scaleY
        radius = Math.max(4, Math.min(10, Math.sqrt(bboxW * bboxH) * 0.18))
      }

      // 高亮光晕
      if (isHighlighted) {
        ctx.beginPath()
        ctx.arc(last.cx, last.cy, radius + 5, 0, Math.PI * 2)
        ctx.fillStyle = `${color}30`
        ctx.fill()
      }

      // 异常停车闪烁光晕（用 sin 时间函数模拟）
      if (vehicle?.is_parked) {
        const glowAlpha = Math.abs(Math.sin(Date.now() / 400)) * 0.5
        ctx.beginPath()
        ctx.arc(last.cx, last.cy, radius + 6, 0, Math.PI * 2)
        ctx.fillStyle = `${COLOR_ALERTED}${Math.round(glowAlpha * 255).toString(16).padStart(2, '0')}`
        ctx.fill()
      }

      // 实心圆点
      ctx.beginPath()
      ctx.arc(last.cx, last.cy, radius, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = isHighlighted ? 10 : 6
      ctx.fill()
      ctx.shadowBlur = 0
    }

    rafRef.current = requestAnimationFrame(render)
  }, [trackHistoryMap, vehicleMap, highlightedTrackId, canvasLineY, canvasRoi, scaleX, scaleY])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafRef.current)
  }, [render])

  // ── 鼠标 Hover：找最近的车辆点 ─────────────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const scaleFactorX = CANVAS_W / rect.width
      const scaleFactorY = CANVAS_H / rect.height
      const cx = mx * scaleFactorX
      const cy = my * scaleFactorY

      let closest: { id: number; dist: number; pt: TrackPoint } | null = null
      for (const [trackId, hist] of trackHistoryMap) {
        if (!hist.length) continue
        const last = hist[hist.length - 1]
        const dist = Math.sqrt((last.cx - cx) ** 2 + (last.cy - cy) ** 2)
        if (!closest || dist < closest.dist) closest = { id: trackId, dist, pt: last }
      }

      if (closest && closest.dist < 16) {
        const v = vehicleMap.get(closest.id)
        setTooltip({
          x: closest.pt.cx / scaleFactorX,
          y: closest.pt.cy / scaleFactorY,
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

  // ── 点击：高亮联动 ─────────────────────────────────────────────────────────
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const scaleFactorX = CANVAS_W / rect.width
      const scaleFactorY = CANVAS_H / rect.height
      const cx = mx * scaleFactorX
      const cy = my * scaleFactorY

      let closest: { id: number; dist: number } | null = null
      for (const [trackId, hist] of trackHistoryMap) {
        if (!hist.length) continue
        const last = hist[hist.length - 1]
        const dist = Math.sqrt((last.cx - cx) ** 2 + (last.cy - cy) ** 2)
        if (!closest || dist < closest.dist) closest = { id: trackId, dist }
      }

      if (closest && closest.dist < 16) {
        setHighlighted(
          closest.id === highlightedTrackId ? null : closest.id,
        )
      } else {
        setHighlighted(null)
      }
    },
    [trackHistoryMap, highlightedTrackId, setHighlighted],
  )

  return (
    <div className={`relative overflow-hidden rounded-sm ${className}`}>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="h-full w-full cursor-crosshair"
        style={{ background: '#050a12', imageRendering: 'pixelated' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        onClick={handleClick}
      />

      {/* 标题角标 */}
      <div
        className="absolute left-2 top-2 font-display text-[8px] tracking-[0.2em] text-text-secondary/40 uppercase"
      >
        TRAJECTORY
      </div>

      {/* 图例 */}
      <div className="absolute bottom-2 left-2 flex flex-col gap-0.5">
        {[
          { color: COLOR_NORMAL,   label: '正常' },
          { color: COLOR_PARKED,   label: '停车' },
          { color: COLOR_WRONGWAY, label: '逆行' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
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
            left: Math.min(tooltip.x + 10, CANVAS_W - 110),
            top: Math.max(tooltip.y - 50, 4),
            background: 'rgba(5,10,18,0.92)',
            border: '1px solid rgba(0,240,255,0.2)',
            minWidth: 100,
          }}
        >
          <p className="font-mono text-[9px] text-text-secondary/60">
            ID: <span className="text-accent">{tooltip.trackId}</span>
          </p>
          {tooltip.speedKmh !== null && (
            <p className="font-mono text-[9px] text-text-secondary/60">
              速度:{' '}
              <span className="text-[#ffcc00]">{tooltip.speedKmh.toFixed(1)} km/h</span>
            </p>
          )}
          {tooltip.isParked && (
            <p className="font-mono text-[9px] text-[#ff3b30]">异常停车</p>
          )}
          {tooltip.isWrongWay && (
            <p className="font-mono text-[9px] text-[#ff2d55]">逆行警告</p>
          )}
        </div>
      )}
    </div>
  )
}
