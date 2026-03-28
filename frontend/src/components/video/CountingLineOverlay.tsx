/**
 * 虚拟计数线叠加层 — 科技风微调版
 *
 * 线条更细、透明度更低，端点小菱形，中央标签更小。
 * 不再使用高亮渐变，避免遮挡视频内容。
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
      {/* 主线：很细、低不透明度、两端渐变淡出 */}
      <div
        className="w-full"
        style={{
          height: '1px',
          background:
            'linear-gradient(90deg, transparent 0%, rgba(0,212,255,0.25) 10%, rgba(0,212,255,0.45) 50%, rgba(0,212,255,0.25) 90%, transparent 100%)',
        }}
      />

      {/* 虚线装饰（叠在主线上方，更高科技感） */}
      <div
        className="absolute inset-x-0 top-0"
        style={{
          height: '1px',
          backgroundImage:
            'repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(0,212,255,0.3) 6px, rgba(0,212,255,0.3) 8px)',
          animation: 'dash-flow 1s linear infinite',
        }}
      />

      {/* 左端菱形 */}
      <div
        className="absolute left-3 top-0 -translate-y-1/2"
        style={{
          width: 4,
          height: 4,
          background: 'rgba(0,212,255,0.5)',
          transform: 'rotate(45deg) translateY(-50%)',
        }}
      />

      {/* 右端菱形 */}
      <div
        className="absolute right-3 top-0 -translate-y-1/2"
        style={{
          width: 4,
          height: 4,
          background: 'rgba(0,212,255,0.5)',
          transform: 'rotate(45deg) translateY(-50%)',
        }}
      />

      {/* 中央小标签（悬浮在线上方） */}
      <div className="absolute left-1/2 -translate-x-1/2 -translate-y-full pb-0.5">
        <span
          className="rounded-sm px-1 py-0.5 font-mono text-[7px] tracking-widest uppercase"
          style={{
            background: 'rgba(5,8,16,0.7)',
            color: 'rgba(0,212,255,0.55)',
            border: '1px solid rgba(0,212,255,0.15)',
          }}
        >
          COUNT LINE · Y={lineY}
        </span>
      </div>
    </div>
  )
}
