/**
 * 实时视频帧面板 — HUD 风格重设计
 *
 * 功能：
 *   - L 形角标装饰（四角，带呼吸光晕）
 *   - 顶部 HUD 信息条：摄像头 ID / 分辨率 / LIVE 状态 / 实时时钟
 *   - 底部 HUD 信息条：帧序号 / FPS
 *   - 移动扫描线（CSS keyframe）
 *   - 扫描线叠加层（水平细纹）
 *   - 虚拟计数线叠加
 *   - 车辆数量实时角标
 *   - alertLevel > 0：彩色边框 + Framer Motion 闪烁
 *   - 帧率降级：顶部警告标签
 *   - 离线状态：噪点模糊遮罩 + 涟漪动画
 */
import { memo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTrafficStore } from '@/store/useTrafficStore'
import { alertLevelColor } from '@/lib/utils'
import { ScanlineOverlay } from './ScanlineOverlay'
import { CountingLineOverlay } from './CountingLineOverlay'
import { HudCorners } from './HudCorners'
import { DetectionOverlay } from './DetectionOverlay'

interface VideoPanelProps {
  isConnected: boolean
  alertLevel: number
  droppedFrames?: number
  fps?: number
  deviceId?: number
  /** 是否显示计数线（默认隐藏） */
  showCountingLine?: boolean
}

export const VideoPanel = memo(function VideoPanel({
  isConnected,
  alertLevel,
  droppedFrames = 0,
  fps,
  deviceId = 1,
  showCountingLine = false,
}: VideoPanelProps) {
  const currentFrame  = useTrafficStore((s) => s.currentFrame)
  const lineY         = useTrafficStore((s) => s.lineY)
  const frameHeight   = useTrafficStore((s) => s.frameHeight)
  const frameWidth    = useTrafficStore((s) => s.frameWidth)
  const isDeviceOnline = useTrafficStore((s) => s.isDeviceOnline)
  const vehicleCount  = useTrafficStore((s) => s.vehicleCount)

  // 本地实时时钟
  const [clock, setClock] = useState('')
  useEffect(() => {
    const tick = () => {
      const n = new Date()
      const pad = (x: number) => String(x).padStart(2, '0')
      setClock(`${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // 帧序号计数
  const [frameSeq, setFrameSeq] = useState(0)
  useEffect(() => {
    if (currentFrame) setFrameSeq((s) => (s + 1) % 1_000_000)
  }, [currentFrame])

  const borderColor = alertLevelColor(alertLevel)
  const isLive      = isConnected && isDeviceOnline && !!currentFrame
  const showOffline = !isConnected || !isDeviceOnline
  const offlineText = !isConnected ? 'SIGNAL LOST' : 'DEVICE OFFLINE'

  // 根据告警等级决定角标颜色
  const cornerColor = alertLevel > 0 ? borderColor : '#00D4FF'

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-sm bg-[#050810]"
      style={{
        border: `1px solid ${alertLevel > 0 ? `${borderColor}50` : 'rgba(0,212,255,0.14)'}`,
        boxShadow: alertLevel > 0
          ? `0 0 24px ${borderColor}28, inset 0 0 24px ${borderColor}0a`
          : '0 0 12px rgba(0,212,255,0.04)',
      }}
    >
      {/* 四角 L 形角标 */}
      <HudCorners color={cornerColor} length={18} thickness={2} pulse />

      {/* ── 顶部信息条 ───────────────────────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-2"
        style={{ background: 'linear-gradient(rgba(5,8,16,0.85), transparent)' }}
      >
        {/* 左：设备 ID + 分辨率 */}
        <div className="flex items-center gap-2">
          <span
            className="font-display text-[9px] font-bold tracking-[0.22em] uppercase"
            style={{ color: cornerColor, textShadow: `0 0 8px ${cornerColor}60` }}
          >
            CAM-{String(deviceId).padStart(2, '0')}
          </span>
          <span className="text-[8px] text-text-secondary/30">·</span>
          <span className="font-mono text-[8px] text-text-secondary/45">
            {frameWidth}×{frameHeight}
          </span>
        </div>

        {/* 右：LIVE 指示 + 时钟 */}
        <div className="flex items-center gap-2">
          {isLive ? (
            <>
              <motion.span
                className="block h-[7px] w-[7px] rounded-full bg-online"
                style={{ boxShadow: '0 0 6px #00E676' }}
                animate={{ opacity: [1, 0.2, 1], scale: [1, 0.75, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span
                className="font-display text-[9px] font-bold tracking-[0.2em] text-online uppercase"
                style={{ textShadow: '0 0 8px #00E67680' }}
              >
                LIVE
              </span>
              <span className="text-[8px] text-text-secondary/25">·</span>
            </>
          ) : null}
          <span className="font-mono text-[9px] text-text-secondary/50">{clock}</span>
        </div>
      </div>

      {/* ── 视频帧 ───────────────────────────────────────────────── */}
      {currentFrame ? (
        <img
          src={`data:image/jpeg;base64,${currentFrame}`}
          alt="实时监控画面"
          className="h-full w-full object-contain"
          draggable={false}
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            {/* 等待圆圈 */}
            <div className="relative flex h-10 w-10 items-center justify-center">
              <motion.div
                className="absolute h-full w-full rounded-full"
                style={{ border: '1px solid rgba(0,212,255,0.2)' }}
                animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              />
              <div className="h-2.5 w-2.5 rounded-full bg-accent/20" />
            </div>
            <p className="font-display text-[9px] tracking-[0.3em] text-text-secondary/25 uppercase">
              AWAITING SIGNAL
            </p>
          </div>
        </div>
      )}

      {/* 扫描细纹叠加 */}
      <ScanlineOverlay />

      {/* 移动扫描线已禁用（避免与计数线视觉混淆） */}

      {/* HUD 检测框 Canvas 叠加层 */}
      <DetectionOverlay />

      {/* 虚拟计数线 */}
      {showCountingLine && isDeviceOnline && lineY > 0 && (
        <CountingLineOverlay lineY={lineY} frameHeight={frameHeight} />
      )}

      {/* 车辆数量角标 */}
      {currentFrame && (
        <div className="pointer-events-none absolute bottom-7 left-3 z-30">
          <div
            className="flex items-center gap-1.5 rounded-sm px-2 py-0.5"
            style={{
              background: 'rgba(5,8,16,0.78)',
              border: `1px solid ${cornerColor}28`,
              backdropFilter: 'blur(4px)',
            }}
          >
            <motion.span
              className="block h-[5px] w-[5px] rounded-full"
              style={{ background: cornerColor }}
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span
              className="font-mono text-[10px] font-bold tabular-nums"
              style={{ color: cornerColor }}
            >
              {vehicleCount}
            </span>
            <span className="font-mono text-[8px] text-text-secondary/45">VEH</span>
          </div>
        </div>
      )}

      {/* ── 底部信息条 ───────────────────────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-center justify-between px-5 py-1.5"
        style={{ background: 'linear-gradient(transparent, rgba(5,8,16,0.7))' }}
      >
        <span className="font-mono text-[8px] text-text-secondary/35">
          SEQ:{String(frameSeq).padStart(6, '0')}
        </span>
        {fps !== undefined && (
          <span
            className="font-mono text-[8px] tabular-nums"
            style={{
              color:
                fps < 5  ? 'var(--color-alert-l4)' :
                fps < 15 ? 'var(--color-alert-l3)' :
                'rgba(122,144,179,0.6)',
            }}
          >
            {fps.toFixed(1)} FPS
          </span>
        )}
      </div>

      {/* 告警等级边框闪烁 */}
      {alertLevel > 0 && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-30 rounded-sm"
          style={{ boxShadow: `inset 0 0 0 2px ${borderColor}` }}
          animate={{ opacity: [1, 0.25, 1] }}
          transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden
        />
      )}

      {/* 帧率降级标签 */}
      {droppedFrames > 10 && isDeviceOnline && (
        <div className="absolute left-3 top-8 z-40">
          <span className="rounded-sm bg-alert-l2/15 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-[0.15em] text-alert-l2 ring-1 ring-alert-l2/35 uppercase">
            FRAME DROP
          </span>
        </div>
      )}

      {/* ── 离线遮罩 ─────────────────────────────────────────────── */}
      {showOffline && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: 'rgba(5,8,16,0.90)', backdropFilter: 'blur(2px)' }}
        >
          {/* 噪点纹理 */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E\")",
              opacity: 0.05,
              animation: 'noise-flicker 0.12s steps(1) infinite',
            }}
          />

          {/* 涟漪圆环 */}
          <div className="relative flex items-center justify-center">
            <motion.div
              className="absolute rounded-full"
              style={{ width: 56, height: 56, border: '1px solid rgba(255,82,82,0.3)' }}
              animate={{ scale: [1, 1.9], opacity: [0.5, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute rounded-full"
              style={{ width: 56, height: 56, border: '1px solid rgba(255,82,82,0.3)' }}
              animate={{ scale: [1, 1.9], opacity: [0.5, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.7 }}
            />
            <motion.div
              className="relative flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                background: 'rgba(255,82,82,0.08)',
                border: '1px solid rgba(255,82,82,0.35)',
              }}
              animate={{
                boxShadow: [
                  '0 0 6px rgba(255,82,82,0.2)',
                  '0 0 18px rgba(255,82,82,0.5)',
                  '0 0 6px rgba(255,82,82,0.2)',
                ],
              }}
              transition={{ duration: 2.5, repeat: Infinity }}
            >
              <span className="text-offline text-lg font-bold">✕</span>
            </motion.div>
          </div>

          <p className="mt-5 font-display text-xs font-bold tracking-[0.3em] text-offline uppercase">
            {offlineText}
          </p>
          <motion.p
            className="mt-2 font-mono text-[9px] text-text-secondary/40"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          >
            RECONNECTING...
          </motion.p>
        </div>
      )}
    </div>
  )
})
