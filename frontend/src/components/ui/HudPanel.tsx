/**
 * HudPanel — 统一 HUD 面板容器
 *
 * 所有页面（Dashboard / History / Settings）使用同一套面板外壳：
 *   - 细线边框 + 微弱内发光
 *   - 四角 L 形角标（由 HudCorners 提供）
 *   - 可选标题栏（含左侧指示点 + 右侧副内容）
 */
import { HudCorners } from '@/components/video/HudCorners'

export interface HudPanelProps {
  title?: string
  titleRight?: React.ReactNode
  children: React.ReactNode
  className?: string
  innerClassName?: string
  cornerColor?: string
  noPadding?: boolean
  /** 面板整体内联样式（如自定义边框色） */
  style?: React.CSSProperties
}

export function HudPanel({
  title,
  titleRight,
  children,
  className = '',
  innerClassName = '',
  cornerColor = '#00D4FF',
  noPadding = false,
  style,
}: HudPanelProps) {
  return (
    <div
      className={`relative flex flex-col rounded-sm bg-bg-panel ${className}`}
      style={{
        border: '1px solid rgba(0,212,255,0.1)',
        boxShadow: 'inset 0 0 20px rgba(0,212,255,0.015)',
        ...style,
      }}
    >
      <HudCorners color={cornerColor} length={10} thickness={1} pulse={false} />

      {title !== undefined && (
        <div
          className="flex flex-shrink-0 items-center justify-between px-3 py-[7px]"
          style={{ borderBottom: '1px solid rgba(0,212,255,0.08)' }}
        >
          <div className="flex items-center gap-2">
            <span
              className="block h-[5px] w-[5px] rounded-full"
              style={{ background: cornerColor, boxShadow: `0 0 5px ${cornerColor}` }}
            />
            <span className="font-display text-[9px] font-bold tracking-[0.22em] text-text-secondary uppercase">
              {title}
            </span>
          </div>
          {titleRight && (
            <div className="font-mono text-[9px] text-text-secondary/55">{titleRight}</div>
          )}
        </div>
      )}

      <div className={`flex flex-1 flex-col ${noPadding ? '' : 'p-3'} ${innerClassName}`}>
        {children}
      </div>
    </div>
  )
}
