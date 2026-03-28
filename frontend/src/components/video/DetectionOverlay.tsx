/**
 * 检测结果 Canvas 叠加层
 *
 * 在原始视频帧上绘制 HUD 风格车辆检测框：
 *   - L 形角标（非实心矩形）+ 霓虹发光
 *   - 车辆 ID / 类别 / 置信度 小标签
 *   - 停车/拥堵车辆使用橙色警告色
 *   - 自动适配 object-contain 的缩放偏移
 *
 * 注意：backend 已改为发送原始帧（inference_loop.py），
 *       本组件负责所有检测框的绘制。
 */
import { useEffect, useRef } from 'react'
import { useTrafficStore } from '@/store/useTrafficStore'
import type { VehicleDetection } from '@/types/websocket'

// ── 颜色映射 ──────────────────────────────────────────────────────────────────

const CLASS_COLORS: Record<string, string> = {
  car:        '#00D4FF',   // 青蓝
  truck:      '#FFD600',   // 黄
  bus:        '#FF9800',   // 橙
  van:        '#4FC3F7',   // 浅蓝
  suv:        '#00D4FF',
  motorcycle: '#00E676',   // 绿
  bicycle:    '#69F0AE',   // 浅绿
  person:     '#FF5252',   // 红
}

function getColor(v: VehicleDetection): string {
  if (v.is_parked) return '#FF9800'
  return CLASS_COLORS[v.class_name.toLowerCase()] ?? '#00D4FF'
}

// ── 绘图工具 ──────────────────────────────────────────────────────────────────

/** 绘制 L 形角标（一个方向） */
function drawCornerBracket(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
  len: number,
) {
  ctx.beginPath()
  ctx.moveTo(x, y + dy * len)
  ctx.lineTo(x, y)
  ctx.lineTo(x + dx * len, y)
  ctx.stroke()
}

/** 绘制单个车辆的 HUD 检测框 + 标签 */
function drawVehicle(
  ctx: CanvasRenderingContext2D,
  v: VehicleDetection,
  scale: number,
  ox: number,
  oy: number,
) {
  const [bx1, by1, bx2, by2] = v.bbox
  const x1 = bx1 * scale + ox
  const y1 = by1 * scale + oy
  const x2 = bx2 * scale + ox
  const y2 = by2 * scale + oy
  const bw = x2 - x1
  const bh = y2 - y1

  if (bw < 4 || bh < 4) return

  const color     = getColor(v)
  const cornerLen = Math.max(7, Math.min(22, Math.min(bw, bh) * 0.22))

  // ── 发光层（模糊轮廓） ─────────────────────────
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth   = 3
  ctx.shadowColor = color
  ctx.shadowBlur  = 12
  ctx.globalAlpha = 0.4

  drawCornerBracket(ctx, x1, y1,  1,  1, cornerLen)
  drawCornerBracket(ctx, x2, y1, -1,  1, cornerLen)
  drawCornerBracket(ctx, x1, y2,  1, -1, cornerLen)
  drawCornerBracket(ctx, x2, y2, -1, -1, cornerLen)
  ctx.restore()

  // ── 主角标（清晰线） ──────────────────────────
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth   = 1.5
  ctx.shadowColor = color
  ctx.shadowBlur  = 5
  ctx.globalAlpha = 0.95

  drawCornerBracket(ctx, x1, y1,  1,  1, cornerLen)
  drawCornerBracket(ctx, x2, y1, -1,  1, cornerLen)
  drawCornerBracket(ctx, x1, y2,  1, -1, cornerLen)
  drawCornerBracket(ctx, x2, y2, -1, -1, cornerLen)
  ctx.restore()

  // ── 标签 Pill ──────────────────────────────────
  const classShort = v.class_name.slice(0, 3).toUpperCase()
  const confPct    = Math.round(v.confidence * 100)
  const labelText  = `#${v.tracking_id} ${classShort} ${confPct}%`

  ctx.save()
  ctx.font      = `bold 9px "JetBrains Mono", "Courier New", monospace`
  ctx.shadowBlur = 0

  const tw  = ctx.measureText(labelText).width
  const ph  = 13
  const pw  = tw + 8
  const pylabel = y1 - ph - 3

  if (pylabel > 2) {
    // 背景
    ctx.fillStyle   = 'rgba(5,8,16,0.82)'
    ctx.strokeStyle = `${color}55`
    ctx.lineWidth   = 0.5
    ctx.fillRect(x1, pylabel, pw, ph)
    ctx.strokeRect(x1, pylabel, pw, ph)

    // 文字
    ctx.fillStyle  = color
    ctx.shadowColor = color
    ctx.shadowBlur  = 4
    ctx.fillText(labelText, x1 + 4, pylabel + ph - 3)
  }
  ctx.restore()

  // ── 停车标记 ──────────────────────────────────
  if (v.is_parked) {
    ctx.save()
    ctx.strokeStyle = '#FF9800'
    ctx.lineWidth   = 1
    ctx.setLineDash([3, 3])
    ctx.shadowColor = '#FF9800'
    ctx.shadowBlur  = 4
    ctx.strokeRect(x1, y1, bw, bh)
    ctx.setLineDash([])
    ctx.restore()
  }
}

// ── 组件 ──────────────────────────────────────────────────────────────────────

export function DetectionOverlay() {
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const vehicles      = useTrafficStore((s) => s.vehicles)
  const frameWidth    = useTrafficStore((s) => s.frameWidth)
  const frameHeight   = useTrafficStore((s) => s.frameHeight)
  const isDeviceOnline = useTrafficStore((s) => s.isDeviceOnline)
  const currentFrame  = useTrafficStore((s) => s.currentFrame)

  // ResizeObserver 保持 canvas 物理像素与 CSS 尺寸同步
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect()
      const dpr  = window.devicePixelRatio || 1
      canvas.width  = rect.width  * dpr
      canvas.height = rect.height * dpr
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(dpr, dpr)
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  // 每帧重绘检测框
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const cw   = rect.width
    const ch   = rect.height

    ctx.clearRect(0, 0, cw, ch)

    if (!isDeviceOnline || !currentFrame || !vehicles.length) return

    // object-contain 变换
    const scale  = Math.min(cw / frameWidth, ch / frameHeight)
    const dispW  = frameWidth  * scale
    const dispH  = frameHeight * scale
    const ox     = (cw - dispW) / 2
    const oy     = (ch - dispH) / 2

    for (const v of vehicles) {
      drawVehicle(ctx, v, scale, ox, oy)
    }
  }, [vehicles, frameWidth, frameHeight, isDeviceOnline, currentFrame])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[25] h-full w-full"
      aria-hidden
    />
  )
}
