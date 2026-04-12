/**
 * 登录页面 — 全屏科技感 HUD 设计
 *
 * 视觉特性：
 *   - 全屏深色背景 + 动态粒子网格
 *   - 旋转雷达扫描环 (SVG)
 *   - 主卡片：角标装饰 + 毛玻璃风格
 *   - 输入框：聚焦时青色光晕
 *   - 登录按钮：扫描动画
 *   - 底部系统状态栏
 */
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/useAuthStore'
import { HudCorners } from '@/components/video/HudCorners'
import { LoginCharacter } from '@/components/LoginCharacter'
import TrafficLoading from '@/components/TrafficLoading'
import { CopyrightAttribution } from '@/components/layout/CopyrightAttribution'

// ── 错误工具 ──────────────────────────────────────────────────────────────────

function getErrorStatus(err: unknown): number | null {
  if (err && typeof err === 'object' && 'response' in err) {
    const r = (err as { response?: { status?: number } }).response
    return r?.status ?? null
  }
  return null
}

function getErrorData(err: unknown): { message?: string; locked_until?: string } {
  if (err && typeof err === 'object' && 'response' in err) {
    const r = (err as { response?: { data?: unknown } }).response
    if (r?.data && typeof r.data === 'object') return r.data as { message?: string; locked_until?: string }
  }
  return {}
}

function minutesUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 60_000))
}

// ── 背景粒子网格（Canvas） ────────────────────────────────────────────────────

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let t   = 0

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const COLS = 28
    const ROWS = 18

    let mouseX = -1000
    let mouseY = -1000

    const draw = () => {
      t += 0.008
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const cw = canvas.width / COLS
      const ch = canvas.height / ROWS

      for (let col = 0; col <= COLS; col++) {
        for (let row = 0; row <= ROWS; row++) {
          let x = col * cw
          let y = row * ch
          
          // Mouse interaction
          const dx = mouseX - x
          const dy = mouseY - y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const maxDist = 150
          
          let mouseAlpha = 0
          if (dist < maxDist) {
            const force = (maxDist - dist) / maxDist
            mouseAlpha = force * 0.15
            x -= dx * force * 0.1 // Push points slightly away from mouse
            y -= dy * force * 0.1
          }

          const wave = Math.sin(col * 0.4 + t) * Math.cos(row * 0.35 + t * 0.7)
          const alpha = (wave + 1) * 0.025 + 0.02 + mouseAlpha

          ctx.fillStyle = `rgba(0,212,255,${alpha.toFixed(3)})`
          ctx.beginPath()
          ctx.arc(x, y, dist < maxDist ? 1.5 : 1, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Horizontal grid lines
      for (let row = 0; row <= ROWS; row++) {
        const y     = row * ch
        const alpha = 0.025 + Math.sin(row * 0.5 + t) * 0.01
        ctx.strokeStyle = `rgba(0,212,255,${alpha.toFixed(3)})`
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()
      }
      // Vertical grid lines
      for (let col = 0; col <= COLS; col++) {
        const x     = col * cw
        const alpha = 0.025 + Math.cos(col * 0.5 + t) * 0.01
        ctx.strokeStyle = `rgba(0,212,255,${alpha.toFixed(3)})`
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()
      }

      raf = requestAnimationFrame(draw)
    }
    draw()

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }
    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0"
      aria-hidden
    />
  )
}

// ── 雷达扫描环 ────────────────────────────────────────────────────────────────

function RadarRings() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="relative" style={{ width: 480, height: 480 }}>
        {/* 静态同心环 */}
        {[1, 0.72, 0.48, 0.28].map((scale, i) => (
          <div
            key={i}
            className="absolute inset-0 m-auto rounded-full"
            style={{
              width: `${scale * 100}%`,
              height: `${scale * 100}%`,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              border: `1px solid rgba(0,212,255,${0.04 + i * 0.02})`,
            }}
          />
        ))}

        {/* 旋转雷达扇形 */}
        <motion.div
          className="absolute inset-0 m-auto rounded-full overflow-hidden"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                'conic-gradient(from 270deg, transparent 0deg, rgba(0,212,255,0.12) 60deg, transparent 61deg)',
            }}
          />
        </motion.div>

        {/* 十字准线 */}
        <div
          className="absolute inset-0 m-auto"
          style={{
            top: '50%',
            left: '50%',
            width: '100%',
            height: '1px',
            transform: 'translateY(-50%)',
            background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.1), transparent)',
          }}
        />
        <div
          className="absolute inset-0 m-auto"
          style={{
            top: '50%',
            left: '50%',
            width: '1px',
            height: '100%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(180deg, transparent, rgba(0,212,255,0.1), transparent)',
          }}
        />
      </div>
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────────────────

export default function Login() {
  const { login, refreshToken } = useAuth()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/'

  const [username, setUsername]     = useState('')
  const [password, setPassword]     = useState('')
  const [isUsernameFocused, setIsUsernameFocused] = useState(false)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)
  const [loading, setLoading]       = useState(false)
  const [initDone, setInitDone]     = useState(false)
  const [showTrafficLoading, setShowTrafficLoading] = useState(false)
  const [trafficSuccess, setTrafficSuccess] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [lockMinutes, setLockMinutes] = useState<number | null>(null)
  const [clock, setClock]           = useState('')

  const usernameRef      = useRef<HTMLInputElement>(null)
  const hasInitialized   = useRef(false)

  // 实时时钟
  useEffect(() => {
    const tick = () => {
      const n = new Date()
      const p = (x: number) => String(x).padStart(2, '0')
      setClock(`${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // 静默刷新 Token
  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true
    refreshToken()
      .then((ok) => { if (ok) navigate(from, { replace: true }) })
      .finally(() => setInitDone(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isAuthenticated && initDone && !showTrafficLoading) navigate(from, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, initDone, showTrafficLoading])

  useEffect(() => {
    if (initDone) usernameRef.current?.focus()
  }, [initDone])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLockMinutes(null)
    if (!username.trim() || !password) {
      setError('请输入用户名和密码')
      return
    }
    setLoading(true)
    setShowTrafficLoading(true)
    setTrafficSuccess(false)
    try {
      // 人为增加一点假延迟，让用户能看清楚红灯和认证中的状态
      const loginPromise = login(username.trim(), password)
      const delayPromise = new Promise(resolve => setTimeout(resolve, 1500))
      await Promise.all([loginPromise, delayPromise])
      
      setTrafficSuccess(true)
    } catch (err) {
      setShowTrafficLoading(false)
      const status = getErrorStatus(err)
      const data   = getErrorData(err)
      if (status === 423) {
        const mins = data.locked_until ? minutesUntil(data.locked_until) : 0
        setLockMinutes(mins)
        setError(mins > 0 ? `账号已被锁定，请 ${mins} 分钟后再试` : '账号已被锁定，请联系管理员')
      } else if (status === 401) {
        setError('用户名或密码错误')
      } else {
        setError(data.message ?? '登录失败，请检查网络后重试')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!initDone) {
    return (
      <div className="flex h-full items-center justify-center bg-bg-base">
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="relative flex h-12 w-12 items-center justify-center">
            <motion.div
              className="absolute h-full w-full rounded-full"
              style={{ border: '1px solid rgba(0,212,255,0.3)' }}
              animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <div className="h-2 w-2 rounded-full bg-accent" />
          </div>
          <p className="font-display text-[9px] tracking-[0.3em] text-text-secondary/40 uppercase">
            INITIALIZING...
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <>
      {showTrafficLoading && (
        <TrafficLoading 
          isSuccess={trafficSuccess} 
          onComplete={() => navigate(from, { replace: true })} 
        />
      )}
      <div className="relative flex h-full flex-col items-center justify-center overflow-hidden bg-bg-base">

      {/* 动态粒子网格 */}
      <ParticleCanvas />

      {/* 扫描线遮罩 */}
      <div 
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.015]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #00D4FF 2px, #00D4FF 4px)',
          backgroundSize: '100% 4px'
        }}
      />

      {/* 雷达扫描环 */}
      <RadarRings />

      {/* 角落坐标标注 */}
      {[
        { cls: 'top-4 left-4 text-left' },
        { cls: 'top-4 right-4 text-right' },
        { cls: 'bottom-4 left-4 text-left' },
        { cls: 'bottom-4 right-4 text-right' },
      ].map(({ cls }, i) => (
        <div key={i} className={`pointer-events-none absolute font-mono text-[8px] text-text-secondary/20 ${cls}`}>
          <div className="leading-tight">
            {['38°54\'N', '116°23\'E', '121°28\'N', '31°13\'E'][i]}
          </div>
          <div className="leading-tight">{clock}</div>
        </div>
      ))}

      {/* 主内容 */}
      <motion.div
        className="relative z-10 flex w-full max-w-7xl flex-col items-center justify-center px-4"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {/* 左右装饰性 HUD 侧边栏 (大屏显示) */}
        <div className="pointer-events-none absolute left-0 top-1/2 hidden -translate-y-1/2 flex-col gap-12 xl:flex">
          <div className="flex flex-col gap-2 opacity-40">
            <div className="font-mono text-[10px] tracking-[0.2em] text-accent uppercase">SYS_DIAGNOSTICS</div>
            {[0.8, 0.4, 0.9, 0.6, 0.3].map((val, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-4 text-right font-mono text-[8px] text-accent">{`0${i + 1}`}</div>
                <div className="h-1 w-24 bg-accent/20">
                  <motion.div 
                    className="h-full bg-accent" 
                    initial={{ width: 0 }}
                    animate={{ width: `${val * 100}%` }}
                    transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut', delay: i * 0.2 }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 opacity-40">
            <div className="font-mono text-[10px] tracking-[0.2em] text-accent uppercase">DATA_STREAM</div>
            <div className="flex flex-col gap-1 font-mono text-[8px] text-accent">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
                >
                  {`0x${Math.floor(Math.random() * 16777215).toString(16).toUpperCase().padStart(6, '0')} ... OK`}
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute right-0 top-1/2 hidden -translate-y-1/2 flex-col items-end gap-12 xl:flex">
          <div className="flex flex-col items-end gap-2 opacity-40">
            <div className="font-mono text-[10px] tracking-[0.2em] text-accent uppercase">NETWORK_UPLINK</div>
            <div className="flex items-end gap-1 h-12">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1.5 bg-accent"
                  animate={{ height: ['20%', '100%', '20%'] }}
                  transition={{ duration: 1 + Math.random(), repeat: Infinity, ease: 'easeInOut' }}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 opacity-40">
            <div className="font-mono text-[10px] tracking-[0.2em] text-accent uppercase">SECURITY_PROTOCOL</div>
            <div className="relative h-16 w-16">
              <motion.div 
                className="absolute inset-0 rounded-full border border-accent border-t-transparent"
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div 
                className="absolute inset-2 rounded-full border border-accent border-b-transparent opacity-50"
                animate={{ rotate: -360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              />
              <div className="absolute inset-0 flex items-center justify-center font-mono text-[8px] text-accent">
                ACTIVE
              </div>
            </div>
          </div>
        </div>

        {/* 系统标题 */}
        <div className="mb-10 text-center">
          <motion.div
            className="mb-2 flex items-center justify-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {/* 左侧装饰线 */}
            <motion.div
              className="h-px w-12 bg-accent/40"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            />
            <span className="font-mono text-[9px] tracking-[0.4em] text-text-secondary/50 uppercase">
              SYSTEM ONLINE
            </span>
            <motion.div
              className="h-px w-12 bg-accent/40"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            />
          </motion.div>

          <motion.h1
            className="font-display text-3xl font-black tracking-[0.15em] text-accent uppercase"
            style={{ textShadow: '0 0 30px rgba(0,212,255,0.5), 0 0 60px rgba(0,212,255,0.2)' }}
            initial={{ opacity: 0, letterSpacing: '0.5em' }}
            animate={{ opacity: 1, letterSpacing: '0.15em' }}
            transition={{ delay: 0.1, duration: 0.6 }}
          >
            TRAFFIC
          </motion.h1>
          <motion.h2
            className="font-display text-3xl font-black tracking-[0.15em] text-accent/80 uppercase"
            style={{ textShadow: '0 0 20px rgba(0,212,255,0.35)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            MONITOR
          </motion.h2>
          <motion.p
            className="mt-3 font-mono text-[10px] tracking-[0.35em] text-text-secondary/45 uppercase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            Vehicle Detection &amp; Counting System
          </motion.p>
        </div>

        {/* 登录区域：左侧角色 + 右侧卡片 */}
        <div className="flex w-full max-w-4xl flex-col md:flex-row items-center justify-center gap-8 md:gap-24">
          {/* 左侧角色 */}
          <motion.div
            className="hidden md:flex h-[320px] w-[320px] items-center justify-center"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.6, ease: 'easeOut' }}
          >
            <LoginCharacter
              isPasswordFocused={isPasswordFocused}
              isUsernameFocused={isUsernameFocused}
              usernameLength={username.length}
            />
          </motion.div>

          {/* 登录卡片 */}
          <motion.div
            className="relative w-full max-w-[380px]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
          {/* 卡片背景 */}
          <div
            className="rounded-sm p-8 relative overflow-hidden"
            style={{
              background: 'rgba(15,22,40,0.92)',
              border: '1px solid rgba(0,212,255,0.2)',
              boxShadow:
                '0 0 40px rgba(0,212,255,0.07), 0 0 80px rgba(0,212,255,0.03), inset 0 1px 0 rgba(0,212,255,0.08)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* Grid overlay */}
            <div 
              className="pointer-events-none absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: 'linear-gradient(rgba(0,212,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,1) 1px, transparent 1px)',
                backgroundSize: '20px 20px'
              }}
            />
            
            <HudCorners color="#00D4FF" length={14} thickness={1.5} pulse />

            {/* 标题 + 版权署名 */}
            <div className="relative z-10 mb-7 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
              <div className="flex items-center gap-3">
              <span
                className="block h-[5px] w-[5px] rounded-full bg-accent"
                style={{ boxShadow: '0 0 6px #00D4FF' }}
              />
              <span className="font-display text-[10px] font-bold tracking-[0.25em] text-accent uppercase">
                系统登录 / ACCESS
              </span>
              </div>
              <CopyrightAttribution className="text-text-secondary/35" />
            </div>

            <form onSubmit={handleSubmit} noValidate className="relative z-10 flex flex-col gap-5">
              {/* 用户名 */}
              <div className="flex flex-col gap-2">
                <label className="font-display text-[9px] tracking-[0.2em] text-text-secondary/60 uppercase">
                  用户名 ID
                </label>
                <div className="relative">
                  <input
                    ref={usernameRef}
                    type="text"
                    autoComplete="off"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    placeholder="输入用户名"
                    className="
                      w-full rounded-sm bg-bg-surface px-3 py-2.5
                      font-mono text-sm text-text-primary
                      placeholder:text-text-secondary/25
                      outline-none
                      transition-all duration-200
                      disabled:opacity-50
                    "
                    style={{
                      border: '1px solid rgba(0,212,255,0.15)',
                      boxShadow: 'inset 0 0 0 0 transparent',
                    }}
                    onFocus={(e) => {
                      setIsUsernameFocused(true)
                      e.target.style.border = '1px solid rgba(0,212,255,0.5)'
                      e.target.style.boxShadow = '0 0 12px rgba(0,212,255,0.15), inset 0 0 8px rgba(0,212,255,0.05)'
                    }}
                    onBlur={(e) => {
                      setIsUsernameFocused(false)
                      e.target.style.border = '1px solid rgba(0,212,255,0.15)'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>
              </div>

              {/* 密码 */}
              <div className="flex flex-col gap-2">
                <label className="font-display text-[9px] tracking-[0.2em] text-text-secondary/60 uppercase">
                  密码 PASSWORD
                </label>
                <input
                  type="password"
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  placeholder="输入密码"
                  className="
                    w-full rounded-sm bg-bg-surface px-3 py-2.5
                    font-mono text-sm text-text-primary
                    placeholder:text-text-secondary/25
                    outline-none
                    transition-all duration-200
                    disabled:opacity-50
                  "
                  style={{ border: '1px solid rgba(0,212,255,0.15)' }}
                  onFocus={(e) => {
                    setIsPasswordFocused(true)
                    e.target.style.border = '1px solid rgba(0,212,255,0.5)'
                    e.target.style.boxShadow = '0 0 12px rgba(0,212,255,0.15), inset 0 0 8px rgba(0,212,255,0.05)'
                  }}
                  onBlur={(e) => {
                    setIsPasswordFocused(false)
                    e.target.style.border = '1px solid rgba(0,212,255,0.15)'
                    e.target.style.boxShadow = 'none'
                  }}
                />
              </div>

              {/* 错误提示 */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    className="flex items-start gap-2 rounded-sm px-3 py-2.5 text-xs"
                    style={{
                      background: 'rgba(244,67,54,0.08)',
                      border: '1px solid rgba(244,67,54,0.25)',
                      color: 'var(--color-alert-l4)',
                    }}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    role="alert"
                  >
                    <span className="mt-0.5 shrink-0 font-mono text-[10px]">!</span>
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 提交按钮 */}
              <motion.button
                type="submit"
                disabled={loading || !username.trim() || !password || lockMinutes !== null}
                className="relative mt-1 overflow-hidden rounded-sm py-2.5 font-display text-xs font-bold tracking-[0.3em] uppercase disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: 'rgba(0,212,255,0.08)',
                  border: '1px solid rgba(0,212,255,0.35)',
                  color: '#00D4FF',
                }}
                whileHover={{ background: 'rgba(0,212,255,0.16)' }}
                whileTap={{ scale: 0.98 }}
              >
                {/* 扫描动画 */}
                {!loading && (
                  <motion.div
                    className="pointer-events-none absolute inset-y-0 w-20 -skew-x-12"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.15), transparent)' }}
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
                  />
                )}
                <span className="relative flex items-center justify-center gap-2">
                  {loading && (
                    <motion.span
                      className="block h-3.5 w-3.5 rounded-full border border-accent border-t-transparent"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    />
                  )}
                  {loading ? 'AUTHENTICATING...' : '登 录  ENTER'}
                </span>
              </motion.button>
            </form>
          </div>
        </motion.div>
        </div>

        {/* 底部系统版本 + 著作权署名 */}
        <motion.div
          className="mt-6 flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <div className="flex items-center gap-4">
            <span className="h-px w-8 bg-text-secondary/15" />
            <span className="font-mono text-[9px] tracking-[0.3em] text-text-secondary/25 uppercase">
              v0.5.0 · CHELLJC · 车辆检测计数系统
            </span>
            <span className="h-px w-8 bg-text-secondary/15" />
          </div>
          <CopyrightAttribution className="justify-center text-text-secondary/45" />
        </motion.div>
      </motion.div>
    </div>
    </>
  )
}
