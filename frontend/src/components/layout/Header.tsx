import { useState } from 'react'
import { ChevronDown, LogOut, User } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { useTrafficStore } from '@/store/useTrafficStore'
import { useAuth } from '@/hooks/useAuth'
import { useDevices } from '@/lib/api'
import { CopyrightAttribution } from './CopyrightAttribution'

export function Header() {
  const user = useAuthStore((s) => s.user)
  const { logout } = useAuth()
  const { selectedDeviceId, setSelectedDeviceId } = useTrafficStore()
  const { data: devices } = useDevices()

  const [deviceOpen, setDeviceOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)

  const currentDevice = devices?.find((d) => d.id === selectedDeviceId)

  return (
    <header
      className="flex h-12 shrink-0 items-center gap-4 border-b border-[#1E2D4A] bg-bg-panel px-4"
      style={{ boxShadow: 'inset 0 -1px 0 rgba(0,212,255,0.05)' }}
    >
      {/* 系统名称 */}
      <span className="font-display text-xs font-bold tracking-widest text-accent uppercase">
        Traffic&nbsp;Monitor
      </span>

      <div className="mx-2 h-4 w-px bg-[#1E2D4A]" />

      {/* 设备选择器 */}
      <div className="relative">
        <button
          onClick={() => { setDeviceOpen((o) => !o); setUserOpen(false) }}
          className="flex items-center gap-2 rounded-sm bg-bg-surface px-2.5 py-1 text-xs text-text-primary ring-1 ring-[#1E2D4A] transition hover:ring-accent/40"
        >
          {/* 在线状态指示点 */}
          <span
            className={[
              'h-1.5 w-1.5 rounded-full',
              currentDevice?.is_active ? 'bg-online' : 'bg-offline',
            ].join(' ')}
          />
          <span className="max-w-[120px] truncate">
            {currentDevice?.name ?? `设备 ${selectedDeviceId}`}
          </span>
          <ChevronDown
            size={12}
            className={['transition-transform', deviceOpen ? 'rotate-180' : ''].join(' ')}
          />
        </button>

        {deviceOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setDeviceOpen(false)}
            />
            <ul className="absolute left-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-sm bg-bg-surface text-xs shadow-xl ring-1 ring-[#1E2D4A]">
              {devices?.length ? (
                devices.map((d) => (
                  <li key={d.id}>
                    <button
                      onClick={() => {
                        setSelectedDeviceId(d.id)
                        setDeviceOpen(false)
                      }}
                      className={[
                        'flex w-full items-center gap-2 px-3 py-2 transition hover:bg-bg-panel',
                        d.id === selectedDeviceId ? 'text-accent' : 'text-text-primary',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'h-1.5 w-1.5 shrink-0 rounded-full',
                          d.is_active ? 'bg-online' : 'bg-offline',
                        ].join(' ')}
                      />
                      <span className="flex-1 truncate text-left">{d.name}</span>
                      <span className="shrink-0 text-[10px] text-text-secondary">
                        {d.ip_address}
                      </span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-text-secondary">暂无设备</li>
              )}
            </ul>
          </>
        )}
      </div>

      <div className="hidden md:block">
        <CopyrightAttribution className="text-text-secondary/35" />
      </div>

      {/* 弹性间距 */}
      <div className="flex-1" />

      {/* 用户菜单 */}
      <div className="relative">
        <button
          onClick={() => { setUserOpen((o) => !o); setDeviceOpen(false) }}
          className="flex items-center gap-2 rounded-sm px-2.5 py-1 text-xs text-text-secondary ring-1 ring-transparent transition hover:text-text-primary hover:ring-[#1E2D4A]"
        >
          <User size={14} />
          <span className="max-w-[80px] truncate">{user?.username}</span>
          {user?.role === 'admin' && (
            <span className="rounded-sm bg-accent/10 px-1 py-0.5 text-[9px] font-bold tracking-widest text-accent uppercase">
              ADM
            </span>
          )}
          <ChevronDown
            size={12}
            className={['transition-transform', userOpen ? 'rotate-180' : ''].join(' ')}
          />
        </button>

        {userOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setUserOpen(false)}
            />
            <div className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-sm bg-bg-surface text-xs shadow-xl ring-1 ring-[#1E2D4A]">
              <div className="border-b border-[#1E2D4A] px-3 py-2">
                <p className="font-medium text-text-primary">{user?.full_name}</p>
                <p className="text-text-secondary">{user?.email ?? '—'}</p>
              </div>
              <button
                onClick={() => { setUserOpen(false); void logout() }}
                className="flex w-full items-center gap-2 px-3 py-2 text-text-secondary transition hover:bg-bg-panel hover:text-alert-l4"
              >
                <LogOut size={12} />
                退出登录
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
