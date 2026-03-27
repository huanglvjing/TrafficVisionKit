/**
 * 设备状态指示灯
 * - online:  绿色脉冲光晕（2s 循环）
 * - offline: 静止红色
 * - warning: 1s 橙色快速闪烁
 */

interface StatusDotProps {
  status: 'online' | 'offline' | 'warning'
  size?: 'sm' | 'md' | 'lg'
}

const SIZE = {
  sm: 'h-1.5 w-1.5',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
}

const PING_SIZE = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
}

export function StatusDot({ status, size = 'md' }: StatusDotProps) {
  if (status === 'online') {
    return (
      <span className="relative flex items-center justify-center">
        <span
          className={`absolute animate-ping rounded-full bg-online opacity-60 ${PING_SIZE[size]}`}
          style={{ animationDuration: '2s' }}
        />
        <span className={`relative rounded-full bg-online ${SIZE[size]}`} />
      </span>
    )
  }

  if (status === 'warning') {
    return (
      <span className="relative flex items-center justify-center">
        <span
          className={`rounded-full bg-alert-l3 ${SIZE[size]}`}
          style={{
            animation: 'blink-warning 1s step-start infinite',
          }}
        />
        <style>{`
          @keyframes blink-warning {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.2; }
          }
        `}</style>
      </span>
    )
  }

  // offline
  return (
    <span className={`rounded-full bg-offline ${SIZE[size]}`} />
  )
}
