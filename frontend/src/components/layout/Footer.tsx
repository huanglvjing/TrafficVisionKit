import { CopyrightAttribution } from './CopyrightAttribution'

export function Footer() {
  return (
    <footer className="flex min-h-7 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[#1E2D4A] bg-bg-panel px-4 py-1">
      <span className="text-[10px] tracking-widest text-text-secondary/40 uppercase">
        v0.5.0 &nbsp;·&nbsp; CHELLJC &nbsp;·&nbsp; 车辆检测计数系统
      </span>
      <CopyrightAttribution />
    </footer>
  )
}
