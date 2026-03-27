/**
 * 虚拟计数线叠加层（设计稿 8.2 节）
 *
 * Props:
 *   lineY       像素坐标（来自 detection.line_y）
 *   frameHeight 原始帧高度（来自 stream_frame.frame.height，默认 480）
 *
 * 根据 lineY / frameHeight 比例计算 CSS top，绘制 accent 色虚拟计数线。
 */

interface CountingLineOverlayProps {
  lineY: number
  frameHeight?: number
}

export function CountingLineOverlay({
  lineY,
  frameHeight = 480,
}: CountingLineOverlayProps) {
  const topPercent = (lineY / frameHeight) * 100

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20"
      style={{ top: `${topPercent}%` }}
      aria-hidden="true"
    >
      {/* 主线 */}
      <div
        className="w-full"
        style={{
          height: '1px',
          background:
            'linear-gradient(90deg, transparent 0%, rgba(0,212,255,0.8) 15%, rgba(0,212,255,0.9) 50%, rgba(0,212,255,0.8) 85%, transparent 100%)',
        }}
      />
      {/* 左右端点标记 */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2">
        <span className="font-mono text-[9px] leading-none text-accent/70">◀</span>
      </div>
      <div className="absolute right-2 top-1/2 -translate-y-1/2">
        <span className="font-mono text-[9px] leading-none text-accent/70">▶</span>
      </div>
      {/* 中央标签 */}
      <div className="absolute left-1/2 -translate-x-1/2 -translate-y-full">
        <span
          className="rounded-sm px-1 py-0.5 font-mono text-[9px] text-accent"
          style={{ background: 'rgba(0,0,0,0.5)' }}
        >
          COUNTING LINE
        </span>
      </div>
    </div>
  )
}
