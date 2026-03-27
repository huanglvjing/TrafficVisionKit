/**
 * 扫描线叠加层（设计稿 16.3 节）
 * position: absolute，全覆盖父容器，半透明横纹，透明度 0.05~0.08。
 * 不拦截鼠标事件。
 */
export function ScanlineOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-10"
      style={{
        background:
          'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)',
      }}
      aria-hidden="true"
    />
  )
}
