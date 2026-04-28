/**
 * 侧边栏导航 — HUD 科技风重设计
 *
 * - Logo 区：脉冲光环
 * - 导航项：激活时青色光晕 + 侧边指示条 + Tooltip
 * - 底部：系统状态指示
 */
import { NavLink } from 'react-router-dom'
import { Activity, BarChart2, Settings, Users, Monitor } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/store/useAuthStore'

interface NavItem {
  to: string
  icon: React.ElementType
  label: string
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', icon: Activity,  label: '实时监控' },
  { to: '/history',   icon: BarChart2, label: '历史数据' },
  { to: '/settings',  icon: Settings,  label: '系统设置' },
  { to: '/devices',   icon: Monitor,   label: '设备管理', adminOnly: true },
  { to: '/users',     icon: Users,     label: '用户管理', adminOnly: true },
]

export function Sidebar() {
  const role = useAuthStore((s) => s.user?.role)

  return (
    <aside
      className="relative flex h-full w-[52px] flex-col items-center gap-1 py-4"
      style={{
        background: 'rgba(15,22,40,0.98)',
        borderRight: '1px solid rgba(0,212,255,0.08)',
        boxShadow: 'inset -1px 0 0 rgba(0,212,255,0.04), 2px 0 20px rgba(0,0,0,0.3)',
      }}
    >
      {/* Logo */}
      <div className="relative mb-5 flex h-9 w-9 items-center justify-center">
        {/* 外圈脉冲 */}
        <motion.div
          className="absolute rounded-full"
          style={{ width: 36, height: 36, border: '1px solid rgba(0,212,255,0.3)' }}
          animate={{ scale: [1, 1.4], opacity: [0.4, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut' }}
        />
        <div
          className="relative flex h-9 w-9 items-center justify-center rounded-sm"
          style={{
            background: 'rgba(0,212,255,0.1)',
            border: '1px solid rgba(0,212,255,0.3)',
            boxShadow: '0 0 12px rgba(0,212,255,0.2), inset 0 0 8px rgba(0,212,255,0.05)',
          }}
        >
          <span
            className="font-display text-sm font-black text-accent"
            style={{ textShadow: '0 0 8px rgba(0,212,255,0.8)' }}
          >
            T
          </span>
        </div>
      </div>

      {/* 分隔线 */}
      <div className="mb-1 h-px w-6" style={{ background: 'rgba(0,212,255,0.1)' }} />

      {/* 导航 */}
      <nav className="flex flex-1 flex-col items-center gap-1">
        {NAV_ITEMS.filter((item) => !item.adminOnly || role === 'admin').map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            title={label}
            className="group relative"
          >
            {({ isActive }) => (
              <motion.div
                className="relative flex h-10 w-10 items-center justify-center rounded-sm transition-all duration-200"
                style={{
                  background: isActive ? 'rgba(0,212,255,0.12)' : 'transparent',
                  border: `1px solid ${isActive ? 'rgba(0,212,255,0.28)' : 'transparent'}`,
                  boxShadow: isActive ? '0 0 10px rgba(0,212,255,0.15), inset 0 0 6px rgba(0,212,255,0.06)' : 'none',
                  color: isActive ? '#00D4FF' : 'rgba(122,144,179,0.7)',
                }}
                whileHover={{
                  background: isActive ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)',
                  color: isActive ? '#00D4FF' : 'rgba(232,240,255,0.9)',
                  border: `1px solid ${isActive ? 'rgba(0,212,255,0.28)' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <Icon size={16} strokeWidth={isActive ? 2.2 : 1.5} />

                {/* 右侧激活指示条 */}
                {isActive && (
                  <motion.span
                    className="absolute right-0 h-5 w-[2px] rounded-l-full"
                    style={{
                      background: '#00D4FF',
                      boxShadow: '0 0 6px #00D4FF, -2px 0 8px rgba(0,212,255,0.5)',
                    }}
                    layoutId="nav-indicator"
                    transition={{ type: 'spring', damping: 22, stiffness: 200 }}
                  />
                )}

                {/* Tooltip */}
                <div
                  className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-sm px-2.5 py-1.5 text-xs opacity-0 shadow-xl transition-opacity group-hover:opacity-100"
                  style={{
                    background: 'rgba(15,22,40,0.96)',
                    border: '1px solid rgba(0,212,255,0.15)',
                    color: 'rgba(232,240,255,0.9)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 99,
                  }}
                >
                  <span className="font-display text-[9px] tracking-[0.15em] uppercase">{label}</span>
                  {/* Tooltip 左箭头 */}
                  <div
                    className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 border-4 border-transparent"
                    style={{ borderRightColor: 'rgba(0,212,255,0.15)' }}
                  />
                </div>
              </motion.div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* 底部状态指示 */}
      <div className="mt-2 flex flex-col items-center gap-1.5">
        <div className="h-px w-6" style={{ background: 'rgba(0,212,255,0.08)' }} />
        <motion.div
          className="h-1.5 w-1.5 rounded-full bg-online"
          style={{ boxShadow: '0 0 5px var(--color-online)' }}
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>
    </aside>
  )
}
