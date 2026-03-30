/**
 * UserManagement — 用户管理页（admin only）
 * 重设计：统计卡 + 用户行卡片 + HUD 风格 Modal
 */
import { createPortal } from 'react-dom'
import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, UserPlus, ShieldCheck, User, Search, KeyRound, Trash2, Power } from 'lucide-react'
import {
  useUsers, useCreateUser, useUpdateUser, useDeleteUser, useResetPassword,
} from '@/lib/api'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { HudCorners } from '@/components/video/HudCorners'
import { formatDateTime } from '@/lib/utils'
import type { UserInfo, UserCreate } from '@/types/api'

// ── 颜色 ─────────────────────────────────────────────────────────────────────
const C_ADMIN    = '#00D4FF'
const C_OPERATOR = '#a78bfa'
const C_ONLINE   = '#34c759'
const C_DANGER   = '#F44336'

// ── 工具：头像首字母 ──────────────────────────────────────────────────────────
function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

// ── HUD 输入框 ─────────────────────────────────────────────────────────────
function HudInput({
  label, type = 'text', value, onChange, placeholder, required,
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void
  placeholder?: string; required?: boolean
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-1">
        <span className="font-display text-[9px] tracking-[0.18em] text-text-secondary/70 uppercase">
          {label}
        </span>
        {required && <span className="text-[10px] text-[#F44336]">*</span>}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-sm bg-[#060C1A] px-3 py-2 font-mono text-xs text-text-primary outline-none transition-all"
        style={{ border: '1px solid rgba(0,212,255,0.15)' }}
        onFocus={(e) => { e.target.style.border = '1px solid rgba(0,212,255,0.5)'; e.target.style.boxShadow = '0 0 10px rgba(0,212,255,0.08)' }}
        onBlur={(e)  => { e.target.style.border = '1px solid rgba(0,212,255,0.15)'; e.target.style.boxShadow = 'none' }}
      />
    </div>
  )
}

// ── 通用 HUD Modal ────────────────────────────────────────────────────────────
function HudModal({
  title, icon, onClose, onSubmit, submitting, children, submitLabel = '确认',
}: {
  title: string; icon?: React.ReactNode
  onClose: () => void; onSubmit: () => void; submitting: boolean
  children: React.ReactNode; submitLabel?: string
}) {
  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(3,8,20,0.85)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />
      <motion.div
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-sm"
        style={{ background: 'rgba(8,14,32,0.98)', border: '1px solid rgba(0,212,255,0.2)' }}
        initial={{ scale: 0.92, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 12 }}
        transition={{ type: 'spring', damping: 22, stiffness: 260 }}
      >
        <HudCorners color="#00D4FF" length={12} thickness={1} pulse />

        {/* 扫描线 */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute inset-x-0 top-0 h-[1px]"
            style={{ background: 'linear-gradient(90deg,transparent,rgba(0,212,255,0.4) 50%,transparent)' }}
            animate={{ y: [0, 420] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
          />
        </div>

        {/* 标题 */}
        <div className="flex items-center gap-2.5 border-b px-5 py-4" style={{ borderColor: 'rgba(0,212,255,0.1)' }}>
          {icon}
          <span className="font-display text-[10px] font-bold tracking-[0.25em] text-accent uppercase">{title}</span>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5">{children}</div>

        <div className="flex justify-end gap-3 border-t px-5 py-4" style={{ borderColor: 'rgba(0,212,255,0.08)' }}>
          <button
            onClick={onClose}
            className="rounded-sm px-4 py-2 font-display text-[9px] tracking-[0.15em] uppercase"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(122,144,179,0.7)' }}
          >取消</button>
          <motion.button
            onClick={onSubmit}
            disabled={submitting}
            className="relative flex items-center gap-2 overflow-hidden rounded-sm px-5 py-2 font-display text-[9px] font-bold tracking-[0.18em] uppercase disabled:opacity-40"
            style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.35)', color: '#00D4FF' }}
            whileHover={{ background: 'rgba(0,212,255,0.18)' }}
            whileTap={{ scale: 0.97 }}
          >
            {!submitting && (
              <motion.div
                className="pointer-events-none absolute inset-y-0 w-8 -skew-x-12"
                style={{ background: 'linear-gradient(90deg,transparent,rgba(0,212,255,0.2),transparent)' }}
                animate={{ x: ['-100%', '300%'] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1.5 }}
              />
            )}
            {submitting && (
              <motion.span
                className="block h-3 w-3 rounded-full border border-accent border-t-transparent"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
            )}
            <span className="relative">{submitLabel}</span>
          </motion.button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}

// ── 用户行卡片 ────────────────────────────────────────────────────────────────
function UserRow({
  user, index, onToggle, onResetPw, onDelete,
}: {
  user: UserInfo; index: number
  onToggle: () => void; onResetPw: () => void; onDelete: () => void
}) {
  const isAdmin   = user.role === 'admin'
  const roleColor = isAdmin ? C_ADMIN : C_OPERATOR
  const roleLabel = isAdmin ? 'Admin' : 'Operator'

  return (
    <motion.div
      className="group relative flex items-center gap-4 rounded-sm px-4 py-3.5"
      style={{
        background: 'rgba(8,14,32,0.7)',
        border: '1px solid rgba(0,212,255,0.07)',
        opacity: user.is_active ? 1 : 0.55,
      }}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: user.is_active ? 1 : 0.55, x: 0 }}
      transition={{ delay: index * 0.04 }}
      whileHover={{ borderColor: 'rgba(0,212,255,0.18)', background: 'rgba(8,14,32,0.9)' }}
    >
      {/* 头像 */}
      <div
        className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-display text-xs font-black select-none"
        style={{
          background: `${roleColor}14`,
          border: `2px solid ${roleColor}35`,
          color: roleColor,
          textShadow: `0 0 8px ${roleColor}60`,
        }}
      >
        {initials(user.full_name || user.username)}
        {/* 在线/禁用指示点 */}
        <span
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2"
          style={{
            background: user.is_active ? C_ONLINE : 'rgba(122,144,179,0.4)',
            borderColor: 'rgba(8,14,32,1)',
            boxShadow: user.is_active ? `0 0 5px ${C_ONLINE}` : 'none',
          }}
        />
      </div>

      {/* 用户信息 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-text-primary">{user.username}</span>
          {/* 角色徽章 */}
          <span
            className="rounded-sm px-1.5 py-0.5 font-display text-[8px] font-bold tracking-[0.18em] uppercase"
            style={{ color: roleColor, background: `${roleColor}10`, border: `1px solid ${roleColor}30` }}
          >
            {roleLabel}
          </span>
          {!user.is_active && (
            <span
              className="rounded-sm px-1.5 py-0.5 font-display text-[8px] tracking-widest uppercase"
              style={{ color: 'rgba(122,144,179,0.5)', background: 'rgba(122,144,179,0.06)', border: '1px solid rgba(122,144,179,0.12)' }}
            >
              已禁用
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-3">
          <span className="font-mono text-[9px] text-text-secondary/55">{user.full_name}</span>
          {user.email && (
            <span className="font-mono text-[9px] text-text-secondary/35">{user.email}</span>
          )}
        </div>
      </div>

      {/* 最后登录 */}
      <div className="hidden flex-shrink-0 flex-col items-end lg:flex">
        <span className="font-display text-[8px] tracking-[0.12em] text-text-secondary/35 uppercase">最后登录</span>
        <span className="font-mono text-[9px] text-text-secondary/50">
          {user.last_login_at ? formatDateTime(user.last_login_at) : '—'}
        </span>
      </div>

      {/* 操作按钮 */}
      <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {/* 启用/禁用 */}
        <motion.button
          onClick={onToggle}
          title={user.is_active ? '禁用' : '启用'}
          className="flex h-7 w-7 items-center justify-center rounded-sm transition-all"
          style={{
            background: user.is_active ? 'rgba(244,67,54,0.08)' : 'rgba(52,199,89,0.08)',
            border: `1px solid ${user.is_active ? 'rgba(244,67,54,0.2)' : 'rgba(52,199,89,0.2)'}`,
            color: user.is_active ? C_DANGER : C_ONLINE,
          }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
        >
          <Power size={11} />
        </motion.button>
        {/* 重置密码 */}
        <motion.button
          onClick={onResetPw}
          title="重置密码"
          className="flex h-7 w-7 items-center justify-center rounded-sm transition-all"
          style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', color: C_OPERATOR }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
        >
          <KeyRound size={11} />
        </motion.button>
        {/* 删除 */}
        <motion.button
          onClick={onDelete}
          title="删除用户"
          className="flex h-7 w-7 items-center justify-center rounded-sm transition-all"
          style={{ background: 'rgba(244,67,54,0.08)', border: '1px solid rgba(244,67,54,0.2)', color: C_DANGER }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
        >
          <Trash2 size={11} />
        </motion.button>
      </div>
    </motion.div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────────
type ConfirmType = 'toggle' | 'delete'

export default function UserManagement() {
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [toast, setToast]       = useState<{ ok: boolean; msg: string } | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [confirmState, setConfirmState] = useState<{ type: ConfirmType; user: UserInfo } | null>(null)
  const [resetUser, setResetUser] = useState<UserInfo | null>(null)

  // 新建用户表单
  const [newUser, setNewUser] = useState<UserCreate>({ username: '', password: '', full_name: '', email: '', role: 'operator' })
  const [createConfirmPw, setCreateConfirmPw] = useState('')
  const [createError, setCreateError] = useState('')

  // 重置密码
  const [resetPw, setResetPw]             = useState('')
  const [resetPwConfirm, setResetPwConfirm] = useState('')
  const [resetError, setResetError]       = useState('')

  const { data: usersData, isLoading } = useUsers({ page, page_size: 50 })
  const { mutate: createUser, isPending: creating } = useCreateUser()
  const { mutate: updateUser, isPending: toggling } = useUpdateUser(
    confirmState?.type === 'toggle' ? confirmState.user.id : 0,
  )
  const { mutate: deleteUser, isPending: deleting } = useDeleteUser()
  const { mutate: resetPassword, isPending: resetting } = useResetPassword(resetUser?.id ?? 0)

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3200)
  }

  const allUsers = usersData?.items ?? []

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return allUsers.filter(
      (u) => !q || u.username.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q),
    )
  }, [allUsers, search])

  // 统计
  const adminCount    = allUsers.filter((u) => u.role === 'admin').length
  const opCount       = allUsers.filter((u) => u.role === 'operator').length
  const activeCount   = allUsers.filter((u) => u.is_active).length

  // ── 新建用户 ──
  const handleCreate = () => {
    if (!newUser.username.trim() || !newUser.password || !newUser.full_name.trim()) {
      setCreateError('请填写必填项（用户名、密码、姓名）')
      return
    }
    if (newUser.password !== createConfirmPw) { setCreateError('两次输入密码不一致'); return }
    setCreateError('')
    createUser(
      { ...newUser, email: newUser.email || undefined },
      {
        onSuccess: () => {
          showToast(true, `✓ 用户 ${newUser.username} 创建成功`)
          setCreateOpen(false)
          setNewUser({ username: '', password: '', full_name: '', email: '', role: 'operator' })
          setCreateConfirmPw('')
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { detail?: { message?: string } } } })?.response?.data?.detail?.message
          setCreateError(msg ?? '创建失败，用户名可能已存在')
        },
      },
    )
  }

  // ── 启用/禁用 ──
  const handleToggle = () => {
    if (!confirmState || confirmState.type !== 'toggle') return
    const { user } = confirmState
    updateUser({ is_active: !user.is_active }, {
      onSuccess: () => { showToast(true, `✓ ${user.username} 已${user.is_active ? '禁用' : '启用'}`); setConfirmState(null) },
      onError:   () => { showToast(false, '✗ 操作失败'); setConfirmState(null) },
    })
  }

  // ── 删除 ──
  const handleDelete = () => {
    if (!confirmState || confirmState.type !== 'delete') return
    const { user } = confirmState
    deleteUser(user.id, {
      onSuccess: () => { showToast(true, `✓ 用户 ${user.username} 已删除`); setConfirmState(null) },
      onError:   () => { showToast(false, '✗ 删除失败'); setConfirmState(null) },
    })
  }

  // ── 重置密码 ──
  const handleResetPw = () => {
    if (!resetPw) { setResetError('请输入新密码'); return }
    if (resetPw !== resetPwConfirm) { setResetError('两次密码不一致'); return }
    setResetError('')
    resetPassword(resetPw, {
      onSuccess: () => { showToast(true, `✓ ${resetUser?.username} 密码已重置`); setResetUser(null); setResetPw(''); setResetPwConfirm('') },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { detail?: { message?: string } } } })?.response?.data?.detail?.message
        setResetError(msg ?? '重置失败，密码强度可能不足（至少8位含大小写和数字）')
      },
    })
  }

  return (
    <div className="h-full overflow-auto p-5">
      <div className="mx-auto max-w-4xl space-y-5">

        {/* ── 页头 ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <Users size={16} style={{ color: C_ADMIN }} />
              <span className="font-display text-xs font-bold tracking-[0.22em] text-text-primary uppercase">
                USER MANAGEMENT
              </span>
            </div>
          </div>
          <motion.button
            onClick={() => { setCreateOpen(true); setCreateError('') }}
            className="relative flex items-center gap-2 overflow-hidden rounded-sm px-4 py-2 font-display text-[9px] font-bold tracking-[0.18em] uppercase"
            style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.35)', color: C_ADMIN }}
            whileHover={{ background: 'rgba(0,212,255,0.18)' }}
            whileTap={{ scale: 0.97 }}
          >
            <motion.div
              className="pointer-events-none absolute inset-y-0 w-8 -skew-x-12"
              style={{ background: 'linear-gradient(90deg,transparent,rgba(0,212,255,0.2),transparent)' }}
              animate={{ x: ['-100%', '300%'] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 2 }}
            />
            <UserPlus size={11} className="relative" />
            <span className="relative">新建用户</span>
          </motion.button>
        </div>

        {/* ── 统计卡片 ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: <Users size={14} />,       label: '总用户数',  val: usersData?.total ?? 0,  color: C_ADMIN },
            { icon: <ShieldCheck size={14} />,  label: '管理员',    val: adminCount,              color: '#00D4FF' },
            { icon: <User size={14} />,          label: '普通用户',  val: opCount,                 color: C_OPERATOR },
            { icon: <Power size={14} />,         label: '活跃账户',  val: activeCount,             color: C_ONLINE },
          ].map(({ icon, label, val, color }, i) => (
            <motion.div
              key={label}
              className="flex items-center gap-3 rounded-sm px-4 py-3"
              style={{ background: `${color}08`, border: `1px solid ${color}18` }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-sm"
                style={{ background: `${color}12`, border: `1px solid ${color}25`, color }}
              >
                {icon}
              </div>
              <div>
                <p className="font-mono text-xl font-black tabular-nums" style={{ color, textShadow: `0 0 10px ${color}40` }}>
                  {val}
                </p>
                <p className="font-display text-[8px] tracking-[0.14em] text-text-secondary/50 uppercase">{label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── 搜索 ──────────────────────────────────────────────────────── */}
        <div className="relative">
          <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索用户名或姓名..."
            className="w-64 rounded-sm bg-[#060C1A] py-2 pl-8 pr-3 font-mono text-xs text-text-primary outline-none transition-all"
            style={{ border: '1px solid rgba(0,212,255,0.12)' }}
            onFocus={(e) => { e.target.style.border = '1px solid rgba(0,212,255,0.4)' }}
            onBlur={(e)  => { e.target.style.border = '1px solid rgba(0,212,255,0.12)' }}
          />
        </div>

        {/* ── 用户列表 ──────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <motion.div
              className="h-8 w-8 rounded-full"
              style={{ border: '2px solid rgba(0,212,255,0.2)', borderTopColor: C_ADMIN }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.length === 0 ? (
              <div className="flex h-24 items-center justify-center">
                <span className="font-display text-[10px] tracking-[0.2em] text-text-secondary/30 uppercase">
                  {search ? '未找到匹配用户' : '暂无用户'}
                </span>
              </div>
            ) : (
              filtered.map((user, i) => (
                <UserRow
                  key={user.id}
                  user={user}
                  index={i}
                  onToggle={() => setConfirmState({ type: 'toggle', user })}
                  onResetPw={() => { setResetUser(user); setResetPw(''); setResetPwConfirm(''); setResetError('') }}
                  onDelete={() => setConfirmState({ type: 'delete', user })}
                />
              ))
            )}
          </div>
        )}

        {/* 分页（简单版，仅当有多页时显示） */}
        {(usersData?.total ?? 0) > 50 && (
          <div className="flex justify-center gap-2 pt-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-sm px-3 py-1.5 font-mono text-[10px] text-text-secondary/60 transition disabled:opacity-30"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >← 上页</button>
            <span className="flex items-center px-2 font-mono text-[10px] text-text-secondary/40">
              {page} / {Math.ceil((usersData?.total ?? 1) / 50)}
            </span>
            <button
              disabled={page >= Math.ceil((usersData?.total ?? 1) / 50)}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-sm px-3 py-1.5 font-mono text-[10px] text-text-secondary/60 transition disabled:opacity-30"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >下页 →</button>
          </div>
        )}

      </div>

      {/* ── 新建用户 Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {createOpen && (
          <HudModal
            title="新建用户账户"
            icon={<UserPlus size={14} style={{ color: C_ADMIN }} />}
            onClose={() => setCreateOpen(false)}
            onSubmit={handleCreate}
            submitting={creating}
            submitLabel="创建账户"
          >
            <HudInput label="用户名" required value={newUser.username} onChange={(v) => setNewUser((f) => ({ ...f, username: v }))} placeholder="仅限字母、数字、下划线" />
            <HudInput label="姓名" required value={newUser.full_name} onChange={(v) => setNewUser((f) => ({ ...f, full_name: v }))} />
            <HudInput label="密码" type="password" required value={newUser.password} onChange={(v) => setNewUser((f) => ({ ...f, password: v }))} placeholder="至少 8 位，含大小写和数字" />
            <HudInput label="确认密码" type="password" required value={createConfirmPw} onChange={setCreateConfirmPw} />
            <div>
              <div className="mb-1.5">
                <span className="font-display text-[9px] tracking-[0.18em] text-text-secondary/70 uppercase">角色</span>
                <span className="ml-1 text-[10px] text-[#F44336]">*</span>
              </div>
              <div className="flex gap-2">
                {(['operator', 'admin'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setNewUser((f) => ({ ...f, role: r }))}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-sm py-2 font-display text-[9px] font-bold tracking-[0.12em] uppercase transition-all"
                    style={{
                      background: newUser.role === r ? `${r === 'admin' ? C_ADMIN : C_OPERATOR}12` : 'rgba(255,255,255,0.02)',
                      border: newUser.role === r ? `1px solid ${r === 'admin' ? C_ADMIN : C_OPERATOR}40` : '1px solid rgba(255,255,255,0.06)',
                      color: newUser.role === r ? (r === 'admin' ? C_ADMIN : C_OPERATOR) : 'rgba(122,144,179,0.5)',
                    }}
                  >
                    {r === 'admin' ? <ShieldCheck size={11} /> : <User size={11} />}
                    {r === 'admin' ? 'Admin 管理员' : 'Operator 普通'}
                  </button>
                ))}
              </div>
            </div>
            <HudInput label="邮箱（可选）" type="email" value={newUser.email ?? ''} onChange={(v) => setNewUser((f) => ({ ...f, email: v }))} />
            <AnimatePresence>
              {createError && (
                <motion.p
                  className="rounded-sm px-3 py-2 font-mono text-[10px]"
                  style={{ background: 'rgba(244,67,54,0.08)', border: '1px solid rgba(244,67,54,0.25)', color: C_DANGER }}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {createError}
                </motion.p>
              )}
            </AnimatePresence>
          </HudModal>
        )}
      </AnimatePresence>

      {/* ── 重置密码 Modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {resetUser && (
          <HudModal
            title={`重置密码 — ${resetUser.username}`}
            icon={<KeyRound size={14} style={{ color: C_OPERATOR }} />}
            onClose={() => setResetUser(null)}
            onSubmit={handleResetPw}
            submitting={resetting}
            submitLabel="重置密码"
          >
            <HudInput label="新密码" type="password" required value={resetPw} onChange={setResetPw} placeholder="至少 8 位，含大小写和数字" />
            <HudInput label="确认新密码" type="password" required value={resetPwConfirm} onChange={setResetPwConfirm} />
            <AnimatePresence>
              {resetError && (
                <motion.p
                  className="rounded-sm px-3 py-2 font-mono text-[10px]"
                  style={{ background: 'rgba(244,67,54,0.08)', border: '1px solid rgba(244,67,54,0.25)', color: C_DANGER }}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {resetError}
                </motion.p>
              )}
            </AnimatePresence>
          </HudModal>
        )}
      </AnimatePresence>

      {/* ── 启用/禁用 确认 ─────────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={confirmState?.type === 'toggle'}
        title={confirmState?.user.is_active ? `禁用用户 ${confirmState?.user.username}` : `启用用户 ${confirmState?.user.username}`}
        message={confirmState?.user.is_active ? '禁用后该用户将无法登录，确认操作？' : '启用后该用户可正常登录，确认操作？'}
        onConfirm={handleToggle}
        onCancel={() => setConfirmState(null)}
        loading={toggling}
      />

      {/* ── 删除确认 ───────────────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={confirmState?.type === 'delete'}
        title={`删除用户 ${confirmState?.user.username}`}
        message="此操作不可撤销，确认删除该用户账户？"
        onConfirm={handleDelete}
        onCancel={() => setConfirmState(null)}
        loading={deleting}
      />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className="fixed bottom-6 right-6 z-50 rounded-sm px-4 py-3 font-mono text-xs shadow-2xl"
            style={{
              background: 'rgba(8,14,32,0.97)',
              border: `1px solid ${toast.ok ? 'rgba(52,199,89,0.35)' : 'rgba(244,67,54,0.35)'}`,
              color: toast.ok ? C_ONLINE : C_DANGER,
              backdropFilter: 'blur(8px)',
            }}
            initial={{ opacity: 0, y: 10, x: 10 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
