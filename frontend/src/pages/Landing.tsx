import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  Cpu,
  Database,
  Lock,
  Network,
  Radar,
  Server,
  Shield,
  TrafficCone,
  Video,
  Zap,
} from 'lucide-react'
import {
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useTransform,
} from 'framer-motion'

// ─── Particle Canvas ──────────────────────────────────────────────────────────

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let raf = 0, t = 0, mx = -9999, my = -9999
    type P = { x: number; y: number; vx: number; vy: number; r: number }
    let pts: P[] = []
    const resize = () => {
      const dpr = devicePixelRatio || 1
      canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr
      canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      pts = Array.from({ length: Math.min(110, Math.floor(innerWidth * innerHeight / 12000)) }, () => ({
        x: Math.random() * innerWidth, y: Math.random() * innerHeight,
        vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28, r: Math.random() * 1.3 + 0.3,
      }))
    }
    const draw = () => {
      t += 0.005; ctx.clearRect(0, 0, innerWidth, innerHeight)
      const g = ctx.createLinearGradient(0, 0, innerWidth, innerHeight)
      g.addColorStop(0, `rgba(6,182,212,${0.07 + Math.sin(t) * 0.02})`)
      g.addColorStop(0.5, 'rgba(59,130,246,0.025)')
      g.addColorStop(1, `rgba(167,139,250,${0.06 + Math.cos(t * 0.7) * 0.02})`)
      ctx.fillStyle = g; ctx.fillRect(0, 0, innerWidth, innerHeight)
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]
        const dx = mx - p.x, dy = my - p.y, d = Math.hypot(dx, dy)
        if (d < 120) { p.x -= dx * (120 - d) / 120 * 0.01; p.y -= dy * (120 - d) / 120 * 0.01 }
        p.x += p.vx; p.y += p.vy
        if (p.x < -20) p.x = innerWidth + 20; if (p.x > innerWidth + 20) p.x = -20
        if (p.y < -20) p.y = innerHeight + 20; if (p.y > innerHeight + 20) p.y = -20
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(200,225,255,0.5)'; ctx.fill()
        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j], ld = Math.hypot(p.x - q.x, p.y - q.y)
          if (ld < 100) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.strokeStyle = `rgba(6,182,212,${(1 - ld / 100) * 0.1})`; ctx.lineWidth = 0.7; ctx.stroke() }
        }
      }
      raf = requestAnimationFrame(draw)
    }
    const mm = (e: MouseEvent) => { mx = e.clientX; my = e.clientY }
    resize(); draw()
    window.addEventListener('resize', resize); window.addEventListener('mousemove', mm)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('mousemove', mm) }
  }, [])
  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0 opacity-80" />
}

// ─── Custom Cursor ────────────────────────────────────────────────────────────

function CustomCursor() {
  const [p, setP] = useState({ x: -200, y: -200 })
  const [big, setBig] = useState(false)
  useEffect(() => {
    const mm = (e: MouseEvent) => setP({ x: e.clientX, y: e.clientY })
    const mo = (e: MouseEvent) => setBig(Boolean((e.target as HTMLElement).closest('a,button')))
    window.addEventListener('mousemove', mm); window.addEventListener('mouseover', mo)
    return () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseover', mo) }
  }, [])
  return (
    <>
      <motion.div className="pointer-events-none fixed z-[90] rounded-full bg-white mix-blend-difference" animate={{ x: p.x - 5, y: p.y - 5, width: big ? 44 : 10, height: big ? 44 : 10 }} transition={{ type: 'spring', stiffness: 620, damping: 30 }} />
      <motion.div className="pointer-events-none fixed z-[89] rounded-full border border-white/40 mix-blend-difference" animate={{ x: p.x - 22, y: p.y - 22, width: 44, height: 44, scale: big ? 1.5 : 1 }} transition={{ type: 'spring', stiffness: 160, damping: 18 }} />
    </>
  )
}

// ─── Glass Card (frosted) ────────────────────────────────────────────────────

const Glass = ({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) => (
  <div
    className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] backdrop-blur-2xl ${className}`}
    style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 30px 90px rgba(0,0,0,0.55)', ...style }}
  >
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent" />
    <div className="relative z-10">{children}</div>
  </div>
)

// ─── 3D Tilt Card ─────────────────────────────────────────────────────────────

function TiltCard({ children, className = '', glow = 'rgba(6,182,212,0.15)' }: { children: ReactNode; className?: string; glow?: string }) {
  const mx = useMotionValue(0); const my = useMotionValue(0)
  const rx = useTransform(my, [-0.5, 0.5], ['9deg', '-9deg'])
  const ry = useTransform(mx, [-0.5, 0.5], ['-11deg', '11deg'])
  const bx = useTransform(mx, [-0.5, 0.5], ['0%', '100%'])
  const by = useTransform(my, [-0.5, 0.5], ['0%', '100%'])
  return (
    <motion.div
      className={`group relative cursor-default overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] backdrop-blur-2xl ${className}`}
      style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 30px 90px rgba(0,0,0,0.55)' }}
      onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); mx.set((e.clientX - r.left) / r.width - 0.5); my.set((e.clientY - r.top) / r.height - 0.5) }}
      onMouseLeave={() => { mx.set(0); my.set(0) }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
    >
      <motion.div className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: `radial-gradient(circle at ${bx} ${by}, ${glow}, transparent 45%)`, opacity: 0 }} whileHover={{ opacity: 1 }} transition={{ duration: 0.2 }} />
      <div className="relative z-10" style={{ transform: 'translateZ(30px)' }}>{children}</div>
    </motion.div>
  )
}

// ─── Page-flip entrance ───────────────────────────────────────────────────────

function FlipIn({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <div style={{ perspective: '1000px' }} className={className}>
      <motion.div
        initial={{ opacity: 0, rotateX: -22, y: 50, scale: 0.95, filter: 'blur(12px)' }}
        whileInView={{ opacity: 1, rotateX: 0, y: 0, scale: 1, filter: 'blur(0px)' }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.85, delay, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformOrigin: 'top center', transformStyle: 'preserve-3d' }}
      >
        {children}
      </motion.div>
    </div>
  )
}

// ─── Fade up ─────────────────────────────────────────────────────────────────

function FadeUp({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 32, filter: 'blur(10px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

// ─── Number Counter ───────────────────────────────────────────────────────────

function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!inView) return
    let start = 0
    const step = to / 90
    const id = setInterval(() => {
      start += step
      if (start >= to) { setVal(to); clearInterval(id) } else { setVal(Math.floor(start)) }
    }, 1000 / 60)
    return () => clearInterval(id)
  }, [inView, to])
  return <span ref={ref}>{val}{suffix}</span>
}

// ─── Scanline Overlay ─────────────────────────────────────────────────────────

const Scanlines = () => (
  <div className="pointer-events-none absolute inset-0 z-20 opacity-[0.02]" style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.4) 2px, rgba(0,0,0,0.4) 4px)' }} />
)

// ─── Infinite Marquee ────────────────────────────────────────────────────────

function Marquee() {
  const items = ['实时推理', '车辆检测', 'YOLOv8', '边缘计算', '历史分析', '设备管理', '60FPS', '<80ms', '99.9%', 'RTSP Stream', '权限控制', 'HUD Dashboard']
  const doubled = [...items, ...items]
  return (
    <div className="relative overflow-hidden border-y border-white/8 bg-black/20 py-3.5 backdrop-blur-sm">
      <div className="absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-[#020817] to-transparent" />
      <div className="absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-[#020817] to-transparent" />
      <motion.div className="flex gap-8 whitespace-nowrap" animate={{ x: ['0%', '-50%'] }} transition={{ duration: 26, repeat: Infinity, ease: 'linear' }}>
        {doubled.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.32em] text-cyan-300/50">
            <span className="h-1 w-1 rounded-full bg-cyan-500/60" />{item}
          </span>
        ))}
      </motion.div>
    </div>
  )
}

// ─── Road Canvas (top-down traffic scene) ─────────────────────────────────────

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function RoadCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cvs = ref.current
    if (!cvs) return
    const ctx = cvs.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(devicePixelRatio, 2)
    const W = cvs.offsetWidth || 640
    const H = cvs.offsetHeight || 340
    cvs.width = W * dpr; cvs.height = H * dpr
    ctx.scale(dpr, dpr)

    const LANES = 4
    const RT = H * 0.06, RB = H * 0.94, RH = RB - RT
    const laneH = RH / LANES
    const midY = RT + RH / 2

    type Car = { x: number; y: number; vx: number; len: number; wid: number; col: string; dir: 1 | -1 }
    const palette = ['#3b82f6','#22d3ee','#a78bfa','#f59e0b','#10b981','#f43f5e','#06b6d4','#8b5cf6']

    const cars: Car[] = Array.from({ length: 14 }, (_, i) => {
      const lane = i % LANES
      const dir: 1 | -1 = lane < LANES / 2 ? 1 : -1
      return {
        x: Math.random() * W,
        y: RT + laneH * lane + laneH / 2,
        vx: (0.45 + Math.random() * 0.85) * dir,
        len: 26 + Math.random() * 18,
        wid: laneH * 0.54,
        col: palette[(i * 3) % palette.length],
        dir,
      }
    })

    let raf = 0
    const tick = () => {
      ctx.clearRect(0, 0, W, H)

      // Off-road surface
      ctx.fillStyle = '#0a0e18'; ctx.fillRect(0, 0, W, H)

      // Curb strips
      ctx.fillStyle = '#1a2030'
      ctx.fillRect(0, RT - 10, W, 10)
      ctx.fillRect(0, RB, W, 10)

      // Road surface
      ctx.fillStyle = '#111826'; ctx.fillRect(0, RT, W, RH)

      // Road edge lines
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2.5; ctx.setLineDash([])
      ctx.beginPath(); ctx.moveTo(0, RT); ctx.lineTo(W, RT); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, RB); ctx.lineTo(W, RB); ctx.stroke()

      // Center double yellow
      ctx.strokeStyle = 'rgba(255,215,0,0.75)'; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(0, midY - 3); ctx.lineTo(W, midY - 3); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, midY + 3); ctx.lineTo(W, midY + 3); ctx.stroke()

      // Lane dashes
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.2; ctx.setLineDash([22, 14])
      for (let li = 1; li < LANES; li++) {
        const ly = RT + laneH * li
        if (Math.abs(ly - midY) > laneH * 0.25) {
          ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke()
        }
      }
      ctx.setLineDash([])

      // Cars
      for (const c of cars) {
        c.x += c.vx
        if (c.vx > 0 && c.x > W + c.len) c.x = -c.len
        if (c.vx < 0 && c.x < -c.len) c.x = W + c.len

        const { x, y, len, wid, col, dir } = c

        // Under-glow
        const g = ctx.createRadialGradient(x, y, 0, x, y, len)
        g.addColorStop(0, col + '35'); g.addColorStop(1, 'transparent')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.ellipse(x, y, len, wid * 0.9, 0, 0, Math.PI * 2); ctx.fill()

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.4)'
        rrect(ctx, x - len / 2 + 2, y - wid / 2 + 2, len, wid, 5)
        ctx.fill()

        // Body
        ctx.fillStyle = col + 'e0'
        rrect(ctx, x - len / 2, y - wid / 2, len, wid, 5)
        ctx.fill()

        // Roof panel
        ctx.fillStyle = 'rgba(0,0,0,0.32)'
        rrect(ctx, x - len * 0.2, y - wid * 0.28, len * 0.4, wid * 0.56, 2.5)
        ctx.fill()

        // Windshield
        ctx.fillStyle = 'rgba(190,225,255,0.48)'
        const wx = dir > 0 ? x + len * 0.07 : x - len * 0.37
        rrect(ctx, wx, y - wid * 0.24, len * 0.3, wid * 0.48, 2)
        ctx.fill()

        // Headlights / tail-lights
        const hlx = dir > 0 ? x + len / 2 - 3 : x - len / 2 + 1
        ctx.fillStyle = dir > 0 ? 'rgba(255,245,130,1)' : 'rgba(255,50,50,0.92)'
        ctx.beginPath(); ctx.arc(hlx, y - wid * 0.24, 2.4, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(hlx, y + wid * 0.24, 2.4, 0, Math.PI * 2); ctx.fill()

        // Headlight beam
        if (dir > 0) {
          const bGrd = ctx.createLinearGradient(hlx, y, hlx + 46, y)
          bGrd.addColorStop(0, 'rgba(255,245,100,0.14)'); bGrd.addColorStop(1, 'transparent')
          ctx.fillStyle = bGrd
          ctx.beginPath()
          ctx.moveTo(hlx, y - wid * 0.28); ctx.lineTo(hlx + 46, y - wid * 0.55)
          ctx.lineTo(hlx + 46, y + wid * 0.55); ctx.lineTo(hlx, y + wid * 0.28)
          ctx.closePath(); ctx.fill()
        }
      }

      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />
}

// ─── Hero Mockup ─────────────────────────────────────────────────────────────

function HeroMock() {
  return (
    <motion.div
      className="relative mx-auto mt-14 w-full max-w-5xl"
      initial={{ opacity: 0, y: 80, rotateX: 18, scale: 0.94, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 1.2, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
      style={{ perspective: 1400, transformStyle: 'preserve-3d' }}
    >
      {/* Glow */}
      <div className="absolute -inset-12 -z-10 rounded-full bg-[radial-gradient(circle,rgba(6,182,212,0.28),transparent_60%)] blur-3xl opacity-55" />

      <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#04091a]/90 shadow-[0_50px_180px_rgba(6,182,212,0.18)] backdrop-blur-xl">
        <Scanlines />
        {/* Chrome bar */}
        <div className="flex h-10 items-center justify-between border-b border-white/8 bg-white/[0.025] px-5">
          <div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500/70" /><span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" /><span className="h-2.5 w-2.5 rounded-full bg-green-500/70" /></div>
          <div className="flex items-center gap-2 rounded-md border border-white/8 bg-black/40 px-3 py-1">
            <Lock className="h-2.5 w-2.5 text-slate-500" />
            <span className="font-mono text-[10px] text-slate-400">traffic-vision.local / dashboard</span>
          </div>
          <div className="flex items-center gap-1.5"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" /><span className="relative h-2 w-2 rounded-full bg-green-500" /></span><span className="font-mono text-[9px] text-green-400/70 uppercase tracking-widest">live</span></div>
        </div>

        <div className="grid min-h-[420px] grid-cols-12 gap-2 p-2.5 sm:min-h-[460px]">
          {/* Sidebar */}
          <div className="col-span-2 hidden flex-col rounded-xl border border-white/6 bg-white/[0.02] p-3 sm:flex">
            <div className="mb-5 flex items-center gap-2"><div className="flex h-6 w-6 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10"><TrafficCone className="h-3.5 w-3.5 text-cyan-400" /></div><span className="font-display text-[9px] font-black tracking-widest text-white/70">TVK</span></div>
            <div className="space-y-1">
              {[['实时监控', true], ['历史数据', false], ['系统设置', false], ['设备管理', false], ['用户管理', false]].map(([l, active]) => (
                <div key={l as string} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${active ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-500'}`}>
                  <span className="h-1 w-1 rounded-full bg-current opacity-60" />
                  <span className="text-[10px] font-medium">{l as string}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Main Feed */}
          <div className="col-span-12 flex flex-col gap-2 sm:col-span-7">
            <div className="relative flex-1 overflow-hidden rounded-xl border border-white/6 bg-black">
              <RoadCanvas />
              <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.3)_50%)] bg-[length:100%_4px] opacity-40" />
              {/* Scanning line */}
              <motion.div className="absolute inset-x-0 h-24 bg-gradient-to-b from-cyan-400/15 to-transparent" animate={{ y: ['-10%', '120%'] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }} />
              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 backdrop-blur-md">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                <span className="font-mono text-[9px] text-white/80">CAM_01 · JUNCTION_A</span>
              </div>
              <div className="absolute bottom-3 right-3 font-mono text-[9px] text-white/40">60.0 FPS · 1920×1080</div>
            </div>
            {/* Sparkline row */}
            <div className="grid h-28 grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/6 bg-white/[0.02] p-3">
                <div className="mb-2 font-mono text-[9px] text-slate-500">HOURLY VEHICLE COUNT</div>
                <div className="flex h-14 items-end gap-1 pb-1">
                  {[35, 60, 45, 88, 62, 95, 100, 48, 72, 84].map((h, i) => (
                    <motion.div key={i} className={`w-full rounded-sm ${i === 6 ? 'bg-cyan-400' : 'bg-cyan-500/35'}`} initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ duration: 0.8, delay: i * 0.06 }} />
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-white/6 bg-white/[0.02] p-3">
                <div className="mb-2 font-mono text-[9px] text-slate-500">VEHICLE COMPOSITION</div>
                <div className="space-y-2 pt-1">
                  {[['CAR', '74%', 'bg-cyan-400'], ['BUS', '16%', 'bg-blue-400'], ['TRUCK', '10%', 'bg-violet-400']].map(([l, w, c]) => (
                    <div key={l} className="flex items-center gap-2">
                      <span className="w-8 font-mono text-[8px] text-slate-400">{l}</span>
                      <div className="h-1.5 flex-1 rounded-full bg-white/8">
                        <motion.div className={`h-full rounded-full ${c}`} initial={{ width: 0 }} animate={{ width: w }} transition={{ duration: 1, delay: 0.5 }} />
                      </div>
                      <span className="w-8 text-right font-mono text-[8px] text-slate-400">{w}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="col-span-12 flex flex-col gap-2 sm:col-span-3">
            <div className="flex-1 rounded-xl border border-white/6 bg-white/[0.02] p-3">
              <div className="mb-4 font-mono text-[9px] text-slate-500">REALTIME METRICS</div>
              <div className="space-y-4">
                {[['60.0', 'FPS', 'cyan'], ['42ms', 'Latency', 'blue'], ['99.9%', 'Uptime', 'green']].map(([v, l, c]) => (
                  <div key={l}>
                    <div className={`font-display text-xl font-black text-${c}-300`}>{v}</div>
                    <div className="font-mono text-[9px] text-slate-500 uppercase">{l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/6 bg-white/[0.02] p-3">
              <div className="mb-2.5 font-mono text-[9px] text-slate-500">RECENT EVENTS</div>
              <div className="space-y-1.5">
                {['Vehicle detected (0.97)', 'Count updated: 1284', 'Alert: high density', 'Device ping OK'].map((e, i) => (
                  <motion.div key={i} className="flex items-start gap-1.5 font-mono text-[8px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 + i * 0.15 }}>
                    <span className="mt-0.5 text-cyan-500">›</span>
                    <span className="text-slate-300">{e}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: Video, title: '实时视频推理', desc: '接入 RTSP 视频流后，以 60FPS 速率运行 YOLOv8 检测，输出带坐标的目标结果，全程本地处理。', glow: 'rgba(6,182,212,0.18)' },
  { icon: Radar, title: '多目标追踪', desc: '通过逐帧 ID 关联，持续追踪同一目标的运动轨迹，准确区分新车与过境车辆。', glow: 'rgba(59,130,246,0.18)' },
  { icon: BarChart3, title: '历史数据分析', desc: '检测结果自动写入本地数据库，前端提供时间粒度灵活的统计折线和柱状图。', glow: 'rgba(139,92,246,0.18)' },
  { icon: Cpu, title: '端侧低延迟', desc: '全流程运算在本地节点完成，无需上传视频到云端，端到端延迟低于 80ms。', glow: 'rgba(6,182,212,0.18)' },
  { icon: Shield, title: '完整权限体系', desc: '登录鉴权、刷新令牌、管理员路由守卫、用户增删改，适配真实多角色部署场景。', glow: 'rgba(34,197,94,0.15)' },
  { icon: Zap, title: 'HUD 可视化大屏', desc: '深色 HUD 风格控制台，扫描线、毛玻璃和动态图表构成统一的高级科技感视觉。', glow: 'rgba(251,146,60,0.15)' },
]

function FeaturesSection() {
  return (
    <section id="features" className="relative px-4 py-28">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#030f20] to-transparent" />
      <div className="relative mx-auto max-w-6xl">
        <FadeUp>
          <div className="mb-14 text-center">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.36em] text-cyan-300/60">Core Capabilities</p>
            <h2 className="text-3xl font-bold text-white sm:text-4xl">专为交通监测场景设计的完整能力矩阵。</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-400">每一个模块都真实运行，不是 Demo，而是可以立即部署投入使用的生产级系统。</p>
          </div>
        </FadeUp>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" style={{ perspective: '1200px' }}>
          {FEATURES.map((f, i) => {
            const Icon = f.icon
            return (
              <FlipIn key={f.title} delay={i * 0.1}>
                <TiltCard className="min-h-[220px] p-6" glow={f.glow}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 mb-5">
                    <Icon className="h-5 w-5 text-cyan-300" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{f.desc}</p>
                </TiltCard>
              </FlipIn>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── Architecture Pipeline ────────────────────────────────────────────────────

function ArchSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  const nodes = [
    { icon: Video, label: '摄像头', sub: 'RTSP / ONVIF', color: '#22d3ee' },
    { icon: Cpu, label: '边缘节点', sub: 'YOLOv8 推理', color: '#3b82f6' },
    { icon: Server, label: '后端服务', sub: 'FastAPI + WS', color: '#a78bfa' },
    { icon: Network, label: '前端大屏', sub: 'React HUD', color: '#34d399' },
  ]

  return (
    <section id="architecture" className="relative px-4 py-28">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_50%,rgba(6,182,212,0.06),transparent)]" />
      <div className="relative mx-auto max-w-5xl">
        <FadeUp className="mb-16 text-center">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.36em] text-cyan-300/60">System Architecture</p>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">数据在这条链路上流动。</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-400">视频帧从摄像头到可视化结果的完整处理路径，每一个环节都经过针对低延迟场景的优化。</p>
        </FadeUp>

        <div ref={ref} className="relative">
          {/* Connector line */}
          <div className="absolute left-[10%] right-[10%] top-7 hidden h-px bg-white/8 sm:block" />
          <svg className="absolute left-[10%] top-[27px] hidden w-[80%] overflow-visible sm:block" height="2">
            <motion.line x1="0" y1="1" x2="100%" y2="1" stroke="url(#pipeGrad)" strokeWidth="2" strokeDasharray="4 4" initial={{ pathLength: 0, opacity: 0 }} animate={inView ? { pathLength: 1, opacity: 1 } : {}} transition={{ duration: 1.6, ease: 'easeInOut', delay: 0.4 }} />
            <defs>
              <linearGradient id="pipeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22d3ee" /><stop offset="33%" stopColor="#3b82f6" /><stop offset="66%" stopColor="#a78bfa" /><stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>
          </svg>
          {/* Flowing packets */}
          {inView && [0, 1, 2].map((i) => (
            <motion.div key={i} className="absolute top-[22px] hidden h-3 w-3 -translate-y-1/2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] sm:block" style={{ left: '10%' }} animate={{ left: ['10%', '90%'], opacity: [0, 1, 1, 0] }} transition={{ duration: 2.8, repeat: Infinity, delay: i * 0.9, ease: 'linear' }} />
          ))}

          <div className="relative flex flex-col gap-8 sm:flex-row sm:justify-between">
            {nodes.map((node, i) => (
              <motion.div
                key={node.label}
                className="flex flex-col items-center gap-4 sm:flex-1"
                initial={{ opacity: 0, y: 24 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.55, delay: i * 0.18 + 0.5 }}
              >
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#08121e] shadow-[0_0_30px_rgba(0,0,0,0.6)]" style={{ boxShadow: `0 0 30px rgba(0,0,0,0.6), 0 0 20px ${node.color}22` }}>
                  <motion.div className="absolute inset-0 rounded-2xl border" style={{ borderColor: node.color + '40' }} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.4 }} />
                  <node.icon className="h-6 w-6" style={{ color: node.color }} />
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-white">{node.label}</div>
                  <div className="mt-1 font-mono text-[10px] text-slate-400">{node.sub}</div>
                </div>
              </motion.div>
            ))}
          </div>

          <FadeUp delay={0.5} className="mt-14">
            <Glass className="p-5">
              <div className="font-mono text-[10px] mb-3 flex items-center gap-2 text-slate-500">
                <Database className="h-3 w-3" />
                <span>edge-node / inference-loop.py</span>
              </div>
              <div className="space-y-1 font-mono text-[11px] text-slate-300">
                <div><span className="text-purple-400">while</span> <span className="text-white">True</span>:</div>
                <div>&nbsp;&nbsp;<span className="text-blue-300">frame</span> = <span className="text-cyan-300">camera</span>.<span className="text-yellow-200">read</span>()</div>
                <div>&nbsp;&nbsp;<span className="text-blue-300">results</span> = <span className="text-cyan-300">model</span>.<span className="text-yellow-200">predict</span>(<span className="text-blue-300">frame</span>, conf=<span className="text-green-300">0.5</span>)</div>
                <div>&nbsp;&nbsp;<span className="text-cyan-300">ws</span>.<span className="text-yellow-200">send</span>(<span className="text-yellow-200">json.dumps</span>({'{'}<span className="text-green-300">"detections"</span>: results.to_json(){'}'}))</div>
              </div>
            </Glass>
          </FadeUp>
        </div>
      </div>
    </section>
  )
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function StatsSection() {
  const stats = [
    { num: 60, suffix: 'FPS', label: '实时推理速率', desc: '每秒处理 60 帧' },
    { num: 80, suffix: 'ms', label: '端到端延迟', desc: '从摄像头到 UI 全程低于' },
    { num: 99, suffix: '%', label: '系统可用率', desc: '7×24 小时持续在线' },
    { num: 4, suffix: '+', label: '核心功能模块', desc: '开箱即用' },
  ]
  return (
    <section className="relative px-4 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((s, i) => (
            <FlipIn key={s.label} delay={i * 0.1}>
              <Glass className="p-6 text-center">
                <div className="font-display text-4xl font-black text-white md:text-5xl">
                  <Counter to={s.num} suffix={s.suffix} />
                </div>
                <div className="mt-3 text-xs font-semibold text-white/80">{s.label}</div>
                <div className="mt-1 text-[11px] text-slate-500">{s.desc}</div>
              </Glass>
            </FlipIn>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA ──────────────────────────────────────────────────────────────────────

function CTASection() {
  return (
    <section className="relative overflow-hidden px-4 py-36">
      <motion.div
        className="absolute left-1/2 top-1/2 h-[44rem] w-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.24), rgba(59,130,246,0.14) 40%, transparent 65%)', filter: 'blur(80px)' }}
        animate={{ scale: [1, 1.1, 1], rotate: [0, 15, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="relative text-center">
        <FadeUp>
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.38em] text-cyan-300/60">Start Now</p>
          <h2 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl">
            现在进入你的<br />
            <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">智能交通驾驶舱。</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-slate-400">
            首页展示价值，登录页进入系统，Dashboard 承载真实业务。<br />从介绍到使用，一条完整的体验路径。
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/login" className="group relative inline-flex h-12 min-w-[180px] items-center justify-center overflow-hidden rounded-xl bg-white px-8 text-sm font-bold text-black shadow-[0_0_50px_rgba(6,182,212,0.3)] transition-all hover:shadow-[0_0_80px_rgba(6,182,212,0.5)] hover:scale-105 active:scale-95">
              <motion.span className="absolute inset-0 bg-gradient-to-r from-cyan-100/60 via-white to-blue-100/60" initial={{ x: '-100%' }} whileHover={{ x: '100%' }} transition={{ duration: 0.5 }} />
              <span className="relative">登录控制台</span>
            </Link>
            <a href="#features" className="inline-flex h-12 min-w-[160px] items-center justify-center rounded-xl border border-white/12 bg-white/6 px-8 text-sm text-white backdrop-blur-xl transition-colors hover:bg-white/12">
              了解系统功能
            </a>
          </div>
        </FadeUp>
      </div>
    </section>
  )
}

// ─── Landing ──────────────────────────────────────────────────────────────────

export default function Landing() {
  const { scrollYProgress } = useScroll()

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#020817] text-slate-200 selection:bg-cyan-500/30">
      <ParticleField />
      <CustomCursor />

      {/* Ambient overlays */}
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(ellipse_at_50%_-5%,rgba(6,182,212,0.14),transparent_50%)]" />
      <div className="pointer-events-none fixed inset-0 z-[2] opacity-[0.028]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

      {/* Scroll progress */}
      <motion.div className="fixed left-0 top-0 z-[70] h-[2px] origin-left bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" style={{ width: '100%', scaleX: scrollYProgress }} />

      {/* Frosted-glass Navbar */}
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-white/8 bg-[#020817]/55 backdrop-blur-2xl">
        <div className="mx-auto flex h-15 max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_18px_rgba(6,182,212,0.2)]">
              <TrafficCone className="h-3.5 w-3.5 text-cyan-400" />
            </div>
            <span className="font-display text-[11px] font-black tracking-[0.22em] text-white">TRAFFICVISIONKIT</span>
          </Link>
          <div className="hidden items-center gap-7 text-xs text-white/50 md:flex">
            <a href="#features" className="transition hover:text-white">功能</a>
            <a href="#architecture" className="transition hover:text-white">架构</a>
            <a href="#specs" className="transition hover:text-white">规格</a>
          </div>
          <Link to="/login" className="rounded-lg border border-white/10 bg-white/8 px-4 py-2 text-xs text-white backdrop-blur-xl transition hover:bg-white/15">
            登录系统 →
          </Link>
        </div>
      </nav>

      <main className="relative z-10">
        {/* ── Hero ── */}
        <section className="flex min-h-screen flex-col items-center justify-center px-4 pb-16 pt-28 text-center">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-widest text-cyan-300 backdrop-blur-md">
              <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" /><span className="relative h-1.5 w-1.5 rounded-full bg-cyan-500" /></span>
              TrafficVisionKit · Edge AI System
            </div>
          </motion.div>

          <motion.h1
            className="mt-7 max-w-5xl text-[clamp(2.8rem,9vw,6.5rem)] font-bold leading-[0.95] tracking-[-0.06em] text-white"
            initial={{ opacity: 0, y: 30, filter: 'blur(16px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 1.1, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          >
            让道路数据
            <span className="block bg-gradient-to-r from-white via-cyan-100 to-blue-400 bg-clip-text text-transparent">活起来。</span>
          </motion.h1>

          <motion.p
            className="mx-auto mt-7 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.32 }}
          >
            基于 YOLOv8 的实时车辆检测与计数系统。边缘端推理、WebSocket 实时传输、<br className="hidden sm:block" />完整的 HUD 大屏展示。从摄像头到数据看板，一套完整的交通智能化方案。
          </motion.p>

          <motion.div className="mt-9 flex flex-col items-center gap-4 sm:flex-row" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.52 }}>
            <Link to="/login" className="group relative inline-flex h-11 min-w-[160px] items-center justify-center overflow-hidden rounded-xl bg-white px-7 text-sm font-semibold text-black shadow-[0_0_40px_rgba(6,182,212,0.25)] transition-all hover:scale-105 hover:shadow-[0_0_60px_rgba(6,182,212,0.4)] active:scale-95">
              <motion.span className="absolute inset-0 bg-gradient-to-r from-cyan-100/50 via-white to-blue-100/50" initial={{ x: '-100%' }} whileHover={{ x: '100%' }} transition={{ duration: 0.5 }} />
              <span className="relative">进入控制台</span>
            </Link>
            <a href="#features" className="inline-flex h-11 items-center gap-1.5 text-sm text-white/60 transition hover:text-white">
              了解更多功能 <span className="transition group-hover:translate-x-1">→</span>
            </a>
          </motion.div>

          <HeroMock />
        </section>

        <Marquee />
        <StatsSection />
        <FeaturesSection />
        <ArchSection />

        {/* ── Specs Table ── */}
        <section id="specs" className="px-4 py-24">
          <div className="mx-auto max-w-4xl">
            <FadeUp className="mb-10">
              <h2 className="text-2xl font-bold text-white">技术规格</h2>
            </FadeUp>
            <Glass className="overflow-hidden">
              {[
                ['检测模型', 'YOLOv8 Nano / Small (PyTorch)'],
                ['推理速率', '30 – 60 FPS（视硬件配置）'],
                ['端到端延迟', '< 80ms（Glass-to-Glass）'],
                ['视频输入', 'RTSP · HTTP Stream · 本地文件'],
                ['前端技术栈', 'React 19 · Vite 8 · Tailwind CSS v4 · Framer Motion'],
                ['状态管理', 'Zustand + TanStack React Query'],
                ['实时通信', 'WebSocket（FastAPI）'],
                ['权限体系', 'JWT · Refresh Token · Role-Based Access'],
              ].map(([k, v], i) => (
                <motion.div
                  key={k}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07 }}
                  className="flex flex-col border-b border-white/6 px-6 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-sm text-slate-400">{k}</span>
                  <span className="mt-1 font-mono text-sm text-white/90 sm:mt-0">{v}</span>
                </motion.div>
              ))}
            </Glass>
          </div>
        </section>

        <CTASection />
      </main>

      <footer className="border-t border-white/6 py-8 text-center">
        <p className="font-mono text-[10px] text-slate-600">© {new Date().getFullYear()} TrafficVisionKit · Edge Intelligence for Modern Traffic</p>
      </footer>
    </div>
  )
}
