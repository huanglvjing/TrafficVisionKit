/**
 * DeviceManagement — 设备舰队管理页
 *
 * 功能：设备卡片总览 / 注册新设备 / 编辑名称与位置 / 删除设备
 * 视觉：HUD 科技风，卡片悬浮发光，在线设备脉冲边框，扫描线 Modal
 */
import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Monitor, Plus, Settings, Edit2, Trash2, Search, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  useDevices,
  useCreateDevice,
  useUpdateDevice,
  useDeleteDevice,
} from '@/lib/api'
import { HudCorners } from '@/components/video/HudCorners'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { formatDateTime } from '@/lib/utils'
import type { DeviceCreate, DeviceDetail } from '@/types/api'

// ── 颜色常量 ─────────────────────────────────────────────────────────────────
const C_ONLINE  = '#34c759'
const C_OFFLINE = 'rgba(122,144,179,0.5)'
const C_ACCENT  = '#00D4FF'

// ── 共用 HUD 风格输入框 ────────────────────────────────────────────────────
function HudInput({
  label, value, onChange, placeholder, hint, required, type = 'text',
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; hint?: string; required?: boolean; type?: string
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-1.5">
        <span className="font-display text-[9px] tracking-[0.18em] text-text-secondary/70 uppercase">
          {label}
        </span>
        {required && <span className="text-[10px] text-[#F44336]">*</span>}
        {hint && <span className="font-mono text-[8px] text-text-secondary/35">{hint}</span>}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-sm bg-[#060C1A] px-3 py-2 font-mono text-xs text-text-primary outline-none transition-all"
        style={{ border: '1px solid rgba(0,212,255,0.15)' }}
        onFocus={(e) => {
          e.target.style.border = '1px solid rgba(0,212,255,0.5)'
          e.target.style.boxShadow = '0 0 10px rgba(0,212,255,0.1)'
        }}
        onBlur={(e) => {
          e.target.style.border = '1px solid rgba(0,212,255,0.15)'
          e.target.style.boxShadow = 'none'
        }}
      />
    </div>
  )
}

// ── HUD 风格 Modal ────────────────────────────────────────────────────────────
function DeviceModal({
  mode, initial, onClose, onSubmit, submitting, error,
}: {
  mode: 'create' | 'edit'
  initial: { name: string; ip_address: string; location: string }
  onClose: () => void
  onSubmit: (v: { name: string; ip_address: string; location: string }) => void
  submitting: boolean
  error: string
}) {
  const [form, setForm] = useState(initial)
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 cursor-pointer"
        style={{ background: 'rgba(3,8,20,0.85)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />

      {/* Modal 主体 */}
      <motion.div
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-sm"
        style={{ background: 'rgba(8,14,32,0.98)', border: '1px solid rgba(0,212,255,0.2)' }}
        initial={{ scale: 0.92, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 12 }}
        transition={{ type: 'spring', damping: 22, stiffness: 260 }}
      >
        <HudCorners color="#00D4FF" length={12} thickness={1} pulse />

        {/* 扫描线动画 */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute inset-x-0 top-0 h-[1px]"
            style={{ background: 'linear-gradient(90deg,transparent,rgba(0,212,255,0.45) 50%,transparent)' }}
            animate={{ y: [0, 420] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
          />
        </div>

        {/* 标题 */}
        <div
          className="flex items-center gap-2.5 border-b px-5 py-4"
          style={{ borderColor: 'rgba(0,212,255,0.1)' }}
        >
          <Monitor size={14} style={{ color: C_ACCENT }} />
          <span className="font-display text-[10px] font-bold tracking-[0.25em] text-accent uppercase">
            {mode === 'create' ? '注册新设备' : '编辑设备信息'}
          </span>
        </div>

        {/* 表单 */}
        <div className="flex flex-col gap-4 px-5 py-5">
          <HudInput
            label="设备名称" required
            value={form.name}
            onChange={set('name')}
            placeholder="如：南门路口摄像头"
          />
          {mode === 'create' && (
            <HudInput
              label="IP 地址" required hint="192.168.x.x"
              value={form.ip_address}
              onChange={set('ip_address')}
              placeholder="192.168.1.100"
            />
          )}
          <HudInput
            label="安装位置" required
            value={form.location}
            onChange={set('location')}
            placeholder="如：南门东侧路口"
          />

          {/* 错误提示 */}
          <AnimatePresence>
            {error && (
              <motion.p
                className="rounded-sm px-3 py-2 font-mono text-[10px]"
                style={{ background: 'rgba(244,67,54,0.08)', border: '1px solid rgba(244,67,54,0.25)', color: '#F44336' }}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* 操作按钮 */}
        <div
          className="flex items-center justify-end gap-3 border-t px-5 py-4"
          style={{ borderColor: 'rgba(0,212,255,0.08)' }}
        >
          <button
            onClick={onClose}
            className="rounded-sm px-4 py-2 font-display text-[9px] tracking-[0.15em] uppercase transition-all"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(122,144,179,0.7)' }}
          >
            取消
          </button>
          <motion.button
            onClick={() => onSubmit(form)}
            disabled={submitting}
            className="relative flex items-center gap-2 overflow-hidden rounded-sm px-5 py-2 font-display text-[9px] font-bold tracking-[0.18em] uppercase disabled:opacity-40"
            style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.35)', color: C_ACCENT }}
            whileHover={{ background: 'rgba(0,212,255,0.18)' }}
            whileTap={{ scale: 0.97 }}
          >
            {/* 光晕扫过效果 */}
            {!submitting && (
              <motion.div
                className="pointer-events-none absolute inset-y-0 w-8 -skew-x-12"
                style={{ background: 'linear-gradient(90deg,transparent,rgba(0,212,255,0.25),transparent)' }}
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
            <span className="relative">{mode === 'create' ? '确认注册' : '保存修改'}</span>
          </motion.button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}

// ── 设备卡片 ──────────────────────────────────────────────────────────────────
function DeviceCard({
  device, index, onEdit, onDelete, onSettings,
}: {
  device: DeviceDetail
  index: number
  onEdit: (d: DeviceDetail) => void
  onDelete: (d: DeviceDetail) => void
  onSettings: () => void
}) {
  const online = device.is_active
  const borderColor = online ? `${C_ONLINE}40` : 'rgba(255,255,255,0.06)'
  const glowColor   = online ? `${C_ONLINE}20` : 'transparent'

  return (
    <motion.div
      className="group relative flex flex-col overflow-hidden rounded-sm"
      style={{ background: 'rgba(8,14,32,0.9)', border: `1px solid ${borderColor}` }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0, boxShadow: `0 0 ${online ? 20 : 0}px ${glowColor}` }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      whileHover={{
        y: -3,
        boxShadow: `0 8px 30px rgba(0,0,0,0.4), 0 0 ${online ? '28px' : '14px'} ${online ? `${C_ONLINE}25` : 'rgba(0,212,255,0.12)'}`,
        borderColor: online ? `${C_ONLINE}70` : 'rgba(0,212,255,0.25)',
      }}
    >
      {/* 在线设备脉冲边框 */}
      {online && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-sm"
          style={{ border: `1px solid ${C_ONLINE}` }}
          animate={{ opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      <HudCorners
        color={online ? C_ONLINE : 'rgba(0,212,255,0.2)'}
        length={10} thickness={1} pulse={false}
      />

      {/* 卡片头部 */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3">
        {/* 设备 ID 徽章 */}
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-sm font-mono text-xs font-bold"
          style={{
            background: online ? `${C_ONLINE}12` : 'rgba(255,255,255,0.03)',
            border: `1px solid ${online ? `${C_ONLINE}30` : 'rgba(255,255,255,0.07)'}`,
            color: online ? C_ONLINE : C_OFFLINE,
          }}
        >
          {String(device.id).padStart(2, '0')}
        </div>

        {/* 在线状态 */}
        <div className="flex items-center gap-1.5">
          {online ? (
            <>
              <motion.span
                className="h-[6px] w-[6px] rounded-full"
                style={{ background: C_ONLINE, boxShadow: `0 0 6px ${C_ONLINE}` }}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className="font-display text-[8px] tracking-[0.2em] uppercase" style={{ color: C_ONLINE }}>
                ONLINE
              </span>
            </>
          ) : (
            <>
              <WifiOff size={10} style={{ color: C_OFFLINE }} />
              <span className="font-display text-[8px] tracking-[0.2em] uppercase text-text-secondary/40">
                OFFLINE
              </span>
            </>
          )}
        </div>
      </div>

      {/* 设备名称 */}
      <div className="px-4 pb-3">
        <h3
          className="truncate font-display text-sm font-bold tracking-wide"
          style={{ color: online ? '#E8F0FF' : 'rgba(232,240,255,0.55)' }}
        >
          {device.name}
        </h3>
        <p className="mt-0.5 font-mono text-[10px] text-text-secondary/50">
          DEV-{String(device.id).padStart(2, '0')}
        </p>
      </div>

      {/* 分割线 */}
      <div className="mx-4 h-px" style={{ background: 'rgba(0,212,255,0.06)' }} />

      {/* 设备信息 */}
      <div className="flex flex-col gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <Wifi size={10} style={{ color: 'rgba(0,212,255,0.4)', flexShrink: 0 }} />
          <span className="font-mono text-[10px] text-text-secondary/60">{device.ip_address}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-text-secondary/35">📍</span>
          <span className="truncate font-mono text-[10px] text-text-secondary/60">{device.location}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-text-secondary/35">🎬</span>
          <span className="font-mono text-[10px] text-text-secondary/45">
            {device.total_frames.toLocaleString('zh-CN')} 帧
          </span>
        </div>
        {device.last_seen_at && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-text-secondary/35">🕐</span>
            <span className="font-mono text-[9px] text-text-secondary/40">
              {formatDateTime(device.last_seen_at)}
            </span>
          </div>
        )}
      </div>

      {/* 固件版本 */}
      {device.firmware_version && (
        <div className="mx-4 mb-3">
          <span
            className="rounded-sm px-1.5 py-0.5 font-mono text-[8px]"
            style={{ background: 'rgba(79,195,247,0.08)', border: '1px solid rgba(79,195,247,0.15)', color: '#4FC3F7' }}
          >
            FW {device.firmware_version}
          </span>
        </div>
      )}

      {/* 操作按钮 */}
      <div
        className="mt-auto flex items-center gap-1 border-t px-3 py-3"
        style={{ borderColor: 'rgba(0,212,255,0.06)' }}
      >
        {/* 设置 */}
        <ActionBtn icon={<Settings size={10} />} label="设置" color={C_ACCENT} onClick={onSettings} />
        {/* 编辑 */}
        <ActionBtn icon={<Edit2 size={10} />} label="编辑" color="#a78bfa" onClick={() => onEdit(device)} />
        {/* 删除 */}
        <ActionBtn icon={<Trash2 size={10} />} label="删除" color="#F44336" onClick={() => onDelete(device)} danger />
      </div>
    </motion.div>
  )
}

function ActionBtn({
  icon, label, color, onClick, danger,
}: {
  icon: React.ReactNode; label: string; color: string; onClick: () => void; danger?: boolean
}) {
  return (
    <motion.button
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1 rounded-sm py-1.5 font-display text-[8px] tracking-[0.12em] uppercase transition-all"
      style={{
        background: `${color}08`,
        border: `1px solid ${color}20`,
        color: `${color}99`,
      }}
      whileHover={{
        background: `${color}18`,
        border: `1px solid ${color}50`,
        color: color,
        boxShadow: danger ? `0 0 8px ${color}30` : 'none',
      }}
      whileTap={{ scale: 0.96 }}
    >
      {icon}
      <span>{label}</span>
    </motion.button>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────────
export default function DeviceManagement() {
  const navigate = useNavigate()
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState<'all' | 'online' | 'offline'>('all')
  const [modal, setModal]     = useState<{ mode: 'create' | 'edit'; device?: DeviceDetail } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeviceDetail | null>(null)
  const [toast, setToast]     = useState<{ ok: boolean; msg: string } | null>(null)
  const [modalError, setModalError] = useState('')

  const { data: devices = [], isLoading, refetch } = useDevices()
  const { mutate: createDevice, isPending: creating } = useCreateDevice()
  const { mutate: updateDevice, isPending: updating } = useUpdateDevice()
  const { mutate: deleteDevice, isPending: deleting } = useDeleteDevice()

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg })
    setTimeout(() => setToast(null), 3000)
  }

  // 过滤 + 搜索
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return devices.filter((d) => {
      const matchFilter =
        filter === 'all' ||
        (filter === 'online' && d.is_active) ||
        (filter === 'offline' && !d.is_active)
      const matchSearch =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.ip_address.includes(q) ||
        d.location.toLowerCase().includes(q)
      return matchFilter && matchSearch
    })
  }, [devices, filter, search])

  // 统计
  const onlineCount  = devices.filter((d) => d.is_active).length
  const offlineCount = devices.length - onlineCount

  // 提交逻辑
  const handleSubmit = (form: { name: string; ip_address: string; location: string }) => {
    if (!form.name.trim() || !form.location.trim()) {
      setModalError('请填写设备名称和安装位置')
      return
    }
    if (modal?.mode === 'create') {
      if (!form.ip_address.trim()) {
        setModalError('请填写 IP 地址')
        return
      }
      const payload: DeviceCreate = { name: form.name.trim(), ip_address: form.ip_address.trim(), location: form.location.trim() }
      createDevice(payload, {
        onSuccess: () => {
          showToast(true, `✓ 设备「${payload.name}」已注册`)
          setModal(null)
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { detail?: { message?: string } } } })?.response?.data?.detail?.message
          setModalError(msg ?? '注册失败，IP 地址可能已被使用')
        },
      })
    } else if (modal?.device) {
      updateDevice(
        { id: modal.device.id, data: { name: form.name.trim(), location: form.location.trim() } },
        {
          onSuccess: () => {
            showToast(true, `✓ 设备「${form.name}」已更新`)
            setModal(null)
          },
          onError: () => setModalError('更新失败，请重试'),
        },
      )
    }
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteDevice(deleteTarget.id, {
      onSuccess: () => {
        showToast(true, `✓ 设备「${deleteTarget.name}」已删除`)
        setDeleteTarget(null)
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { detail?: { message?: string } } } })?.response?.data?.detail?.message
        showToast(false, msg ?? '✗ 删除失败，请先处理未解除的预警')
        setDeleteTarget(null)
      },
    })
  }

  const FILTER_OPTS: { key: 'all' | 'online' | 'offline'; label: string }[] = [
    { key: 'all',     label: `全部 ${devices.length}` },
    { key: 'online',  label: `在线 ${onlineCount}` },
    { key: 'offline', label: `离线 ${offlineCount}` },
  ]

  return (
    <div className="h-full overflow-auto p-5">
      <div className="mx-auto max-w-6xl space-y-5">

        {/* ── 页头 ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* 标题 + 统计 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <Monitor size={16} style={{ color: C_ACCENT }} />
              <span className="font-display text-xs font-bold tracking-[0.22em] text-text-primary uppercase">
                DEVICE FLEET
              </span>
            </div>
            {/* 统计芯片 */}
            {[
              { label: '总设备',  val: devices.length,  color: C_ACCENT },
              { label: '在线',    val: onlineCount,      color: C_ONLINE },
              { label: '离线',    val: offlineCount,     color: '#7A90B3' },
            ].map(({ label, val, color }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 rounded-sm px-2.5 py-1"
                style={{ background: `${color}10`, border: `1px solid ${color}25` }}
              >
                <span className="font-mono text-xs font-bold tabular-nums" style={{ color }}>{val}</span>
                <span className="font-display text-[8px] tracking-[0.12em] uppercase" style={{ color: `${color}99` }}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* 刷新 + 注册按钮 */}
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => refetch()}
              className="flex h-8 w-8 items-center justify-center rounded-sm transition-all"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              whileHover={{ background: 'rgba(0,212,255,0.08)' }}
              whileTap={{ scale: 0.95 }}
              title="刷新"
            >
              <RefreshCw size={12} style={{ color: 'rgba(0,212,255,0.6)' }} />
            </motion.button>
            <motion.button
              onClick={() => { setModal({ mode: 'create' }); setModalError('') }}
              className="relative flex items-center gap-2 overflow-hidden rounded-sm px-4 py-2 font-display text-[9px] font-bold tracking-[0.18em] uppercase"
              style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.35)', color: C_ACCENT }}
              whileHover={{ background: 'rgba(0,212,255,0.18)' }}
              whileTap={{ scale: 0.97 }}
            >
              <motion.div
                className="pointer-events-none absolute inset-y-0 w-8 -skew-x-12"
                style={{ background: 'linear-gradient(90deg,transparent,rgba(0,212,255,0.2),transparent)' }}
                animate={{ x: ['-100%', '300%'] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 2 }}
              />
              <Plus size={11} className="relative" />
              <span className="relative">注册新设备</span>
            </motion.button>
          </div>
        </div>

        {/* ── 搜索 + 过滤工具栏 ──────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* 搜索框 */}
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索设备名、IP、位置..."
              className="w-56 rounded-sm bg-[#060C1A] py-1.5 pl-8 pr-3 font-mono text-xs text-text-primary outline-none transition-all"
              style={{ border: '1px solid rgba(0,212,255,0.12)' }}
              onFocus={(e) => { e.target.style.border = '1px solid rgba(0,212,255,0.4)' }}
              onBlur={(e)  => { e.target.style.border = '1px solid rgba(0,212,255,0.12)' }}
            />
          </div>

          {/* 过滤器 */}
          <div className="flex gap-1 rounded-sm p-0.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {FILTER_OPTS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className="rounded-sm px-3 py-1 font-display text-[8px] tracking-[0.12em] uppercase transition-all"
                style={{
                  background: filter === key ? 'rgba(0,212,255,0.12)' : 'transparent',
                  border: filter === key ? '1px solid rgba(0,212,255,0.3)' : '1px solid transparent',
                  color: filter === key ? C_ACCENT : 'rgba(122,144,179,0.6)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── 设备卡片网格 ────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <motion.div
              className="h-8 w-8 rounded-full"
              style={{ border: '2px solid rgba(0,212,255,0.2)', borderTopColor: C_ACCENT }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            className="flex h-48 flex-col items-center justify-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Monitor size={32} style={{ color: 'rgba(0,212,255,0.15)' }} />
            <div className="text-center">
              <p className="font-display text-[10px] tracking-[0.2em] text-text-secondary/40 uppercase">
                {search ? '未找到匹配设备' : '暂无设备，点击注册新设备开始'}
              </p>
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((device, i) => (
              <DeviceCard
                key={device.id}
                device={device}
                index={i}
                onEdit={(d) => { setModal({ mode: 'edit', device: d }); setModalError('') }}
                onDelete={setDeleteTarget}
                onSettings={() => navigate('/settings')}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Add/Edit Modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {modal && (
          <DeviceModal
            mode={modal.mode}
            initial={
              modal.device
                ? { name: modal.device.name, ip_address: modal.device.ip_address, location: modal.device.location }
                : { name: '', ip_address: '', location: '' }
            }
            onClose={() => setModal(null)}
            onSubmit={handleSubmit}
            submitting={creating || updating}
            error={modalError}
          />
        )}
      </AnimatePresence>

      {/* ── 删除确认 ──────────────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={`删除设备「${deleteTarget?.name}」`}
        message="删除后该设备所有历史数据将保留，但配置将被清除。存在未解除预警时无法删除。"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
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
              color: toast.ok ? C_ONLINE : '#F44336',
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
