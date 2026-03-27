/**
 * 实时视频帧面板（设计稿 8.2 节）
 *
 * 功能：
 *   - 从 useTrafficStore 读取 currentFrame / lineY / frameHeight / isDeviceOnline
 *   - alertLevel > 0 时：对应颜色边框 + Framer Motion 闪烁动画
 *   - WebSocket 未连接或设备离线时显示半透明遮罩 + 状态文字
 *   - dropped_frames > 10 时顶部显示「帧率降级」警告标签
 *   - 包含 ScanlineOverlay 和 CountingLineOverlay
 */
import { motion } from 'framer-motion'
import { useTrafficStore } from '@/store/useTrafficStore'
import { alertLevelColor } from '@/lib/utils'
import { ScanlineOverlay } from './ScanlineOverlay'
import { CountingLineOverlay } from './CountingLineOverlay'

interface VideoPanelProps {
  isConnected: boolean
  alertLevel: number
  droppedFrames?: number
}

export function VideoPanel({
  isConnected,
  alertLevel,
  droppedFrames = 0,
}: VideoPanelProps) {
  const currentFrame = useTrafficStore((s) => s.currentFrame)
  const lineY = useTrafficStore((s) => s.lineY)
  const frameHeight = useTrafficStore((s) => s.frameHeight)
  const isDeviceOnline = useTrafficStore((s) => s.isDeviceOnline)

  const borderColor = alertLevelColor(alertLevel)
  const showOffline = !isConnected || !isDeviceOnline
  const offlineText = !isConnected ? 'WebSocket 未连接' : '设备离线'

  return (
    <div
      className="relative w-full overflow-hidden rounded-sm bg-bg-base"
      style={{
        // 4:3 宽高比
        aspectRatio: '4 / 3',
        border: `1px solid ${alertLevel > 0 ? borderColor : 'rgba(0,212,255,0.15)'}`,
      }}
    >
      {/* 视频帧 */}
      {currentFrame ? (
        <img
          src={`data:image/jpeg;base64,${currentFrame}`}
          alt="实时视频帧"
          className="h-full w-full object-contain"
          draggable={false}
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <p className="text-[10px] tracking-widest text-text-secondary/30 uppercase">
            等待帧数据…
          </p>
        </div>
      )}

      {/* 扫描线叠加 */}
      <ScanlineOverlay />

      {/* 虚拟计数线叠加（仅设备在线时显示） */}
      {isDeviceOnline && lineY > 0 && (
        <CountingLineOverlay lineY={lineY} frameHeight={frameHeight} />
      )}

      {/* 预警等级边框闪烁 */}
      {alertLevel > 0 && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-30 rounded-sm"
          style={{ boxShadow: `inset 0 0 0 2px ${borderColor}` }}
          animate={{ opacity: [1, 0.25, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden="true"
        />
      )}

      {/* 帧率降级警告标签 */}
      {droppedFrames > 10 && isDeviceOnline && (
        <div className="absolute left-2 top-2 z-40">
          <span className="rounded-sm bg-alert-l2/20 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-widest text-alert-l2 ring-1 ring-alert-l2/40 uppercase">
            帧率降级
          </span>
        </div>
      )}

      {/* 设备离线遮罩 */}
      {showOffline && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-bg-base/80">
          <div
            className="h-8 w-8 rounded-full"
            style={{ background: 'rgba(255,82,82,0.15)', border: '1px solid rgba(255,82,82,0.4)' }}
          >
            <div className="flex h-full items-center justify-center">
              <span className="text-sm text-offline">✕</span>
            </div>
          </div>
          <p className="mt-3 font-display text-xs font-bold tracking-widest text-offline uppercase">
            {offlineText}
          </p>
          <p className="mt-1 text-[10px] text-text-secondary/50">
            等待设备重新连接…
          </p>
        </div>
      )}
    </div>
  )
}
