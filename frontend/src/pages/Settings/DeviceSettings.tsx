/**
 * 设备参数配置页面 — HUD 科技风重设计
 *
 * 表单字段：line_y / confidence / fps_limit / alert 阈值 / park_timeout
 * 右侧：计数线 HUD 预览 + 阈值速查卡
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDevices, useDeviceSettings, useUpdateDeviceSettings } from '@/lib/api'
import { useTrafficStore } from '@/store/useTrafficStore'
import { HudPanel } from '@/components/ui/HudPanel'
import { HudCorners } from '@/components/video/HudCorners'
import type { DeviceSettingsUpdate } from '@/types/api'

type FormState = Required<DeviceSettingsUpdate>

const DEFAULT_FORM: FormState = {
  line_y: 240,
  confidence: 0.5,
  fps_limit: 30,
  alert_l2_threshold: 5,
  alert_l3_threshold: 10,
  alert_l4_threshold: 15,
  park_timeout_seconds: 30,
}

// ── 子组件 ────────────────────────────────────────────────────────────────────

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-4 py-3"
      style={{ borderBottom: '1px solid rgba(0,212,255,0.06)' }}
    >
      <div className="w-36 shrink-0">
        <p className="font-mono text-xs text-text-primary">{label}</p>
        {hint && <p className="mt-0.5 font-mono text-[9px] text-text-secondary/40">{hint}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function NumInput({ value, min, max, step = 1, onChange }: {
  value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void
}) {
  return (
    <input
      type="number"
      value={value}
      min={min} max={max} step={step}
      onChange={(e) => { const v = Number(e.target.value); if (!isNaN(v)) onChange(v) }}
      className="w-24 rounded-sm bg-bg-surface px-2.5 py-1.5 font-mono text-xs text-text-primary outline-none transition-all"
      style={{ border: '1px solid rgba(0,212,255,0.15)' }}
      onFocus={(e) => { e.target.style.border = '1px solid rgba(0,212,255,0.5)'; e.target.style.boxShadow = '0 0 8px rgba(0,212,255,0.12)' }}
      onBlur={(e)  => { e.target.style.border = '1px solid rgba(0,212,255,0.15)'; e.target.style.boxShadow = 'none' }}
    />
  )
}

function HudRange({ min, max, step = 1, value, onChange }: {
  min: number; max: number; step?: number; value: number; onChange: (v: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="relative flex flex-1 items-center gap-3">
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #00D4FF, #4FC3F7)',
            boxShadow: '0 0 6px rgba(0,212,255,0.5)',
            transition: 'width 0.1s',
          }}
        />
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────────

export default function DeviceSettings() {
  const globalDeviceId = useTrafficStore((s) => s.selectedDeviceId)
  const [deviceId, setDeviceId] = useState(globalDeviceId)
  const [form, setForm]         = useState<FormState>(DEFAULT_FORM)
  const [toast, setToast]       = useState<{ ok: boolean; msg: string } | null>(null)

  const { data: devices }                            = useDevices()
  const { data: settings, isLoading }                = useDeviceSettings(deviceId)
  const { mutate: save, isPending: saving }           = useUpdateDeviceSettings(deviceId)

  useEffect(() => {
    if (settings) {
      setForm({
        line_y: settings.line_y,
        confidence: settings.confidence,
        fps_limit: settings.fps_limit,
        alert_l2_threshold: settings.alert_l2_threshold,
        alert_l3_threshold: settings.alert_l3_threshold,
        alert_l4_threshold: settings.alert_l4_threshold,
        park_timeout_seconds: settings.park_timeout_seconds,
      })
    }
  }, [settings])

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg }); setTimeout(() => setToast(null), 3000)
  }

  const handleSave = () => {
    save(form, {
      onSuccess: () => showToast(true,  '✓ 配置已生效，推理协程将在下一帧重载'),
      onError:   () => showToast(false, '✗ 保存失败，请检查参数范围'),
    })
  }

  const handleReset = () => {
    if (settings) setForm({ line_y: settings.line_y, confidence: settings.confidence, fps_limit: settings.fps_limit, alert_l2_threshold: settings.alert_l2_threshold, alert_l3_threshold: settings.alert_l3_threshold, alert_l4_threshold: settings.alert_l4_threshold, park_timeout_seconds: settings.park_timeout_seconds })
  }

  const pf = (v: number) => v.toFixed(2)
  const resH = settings?.resolution_h ?? 480
  const resW = settings?.resolution_w ?? 640
  const lineTopPct = Math.min(100, (form.line_y / resH) * 100)

  const LEVEL_CONFIG = [
    { label: 'L2', color: '#FFD600', val: form.alert_l2_threshold, desc: '黄色 · 中度拥堵' },
    { label: 'L3', color: '#FF9800', val: form.alert_l3_threshold, desc: '橙色 · 严重拥堵' },
    { label: 'L4', color: '#F44336', val: form.alert_l4_threshold, desc: '红色 · 极度拥堵' },
  ]

  return (
    <div className="h-full overflow-auto p-4">
      <div className="mx-auto max-w-3xl space-y-4">

        {/* 页面标题 */}
        <HudPanel title="设备参数配置" titleRight={
          settings && (
            <span className="font-mono text-[8px] text-text-secondary/35">
              更新于 {new Date(settings.updated_at).toLocaleString('zh-CN')}
            </span>
          )
        }>
          <div className="flex items-center gap-3">
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(Number(e.target.value))}
              className="rounded-sm bg-bg-surface px-2.5 py-1.5 font-mono text-xs text-text-primary outline-none transition-all"
              style={{ border: '1px solid rgba(0,212,255,0.15)' }}
              onFocus={(e) => { e.target.style.border = '1px solid rgba(0,212,255,0.45)' }}
              onBlur={(e)  => { e.target.style.border = '1px solid rgba(0,212,255,0.15)' }}
            >
              {devices?.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <span className="font-display text-[9px] tracking-[0.18em] text-text-secondary/40 uppercase">
              SELECT DEVICE
            </span>
          </div>
        </HudPanel>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <motion.div
              className="h-8 w-8 rounded-full"
              style={{ border: '1px solid rgba(0,212,255,0.3)' }}
              animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">

            {/* 左列：配置表单 */}
            <div className="space-y-4">

              {/* 基础参数 */}
              <HudPanel title="基础推理参数">
                <div>
                  <FieldRow label="计数线 Y 坐标" hint={`像素 0–${resH}`}>
                    <div className="flex items-center gap-3">
                      <NumInput
                        value={form.line_y} min={0} max={resH}
                        onChange={(v) => setForm((f) => ({ ...f, line_y: Math.min(resH, Math.max(0, v)) }))}
                      />
                      <HudRange
                        min={0} max={resH} value={form.line_y}
                        onChange={(v) => setForm((f) => ({ ...f, line_y: v }))}
                      />
                    </div>
                  </FieldRow>

                  <FieldRow label="YOLO 置信度" hint="0.1–0.9">
                    <div className="flex items-center gap-3">
                      <span className="w-10 font-mono text-xs font-bold text-accent">{pf(form.confidence)}</span>
                      <HudRange
                        min={0.1} max={0.9} step={0.05} value={form.confidence}
                        onChange={(v) => setForm((f) => ({ ...f, confidence: v }))}
                      />
                    </div>
                  </FieldRow>

                  <FieldRow label="帧率上限" hint="fps 1–60">
                    <div className="flex items-center gap-3">
                      <NumInput
                        value={form.fps_limit} min={1} max={60}
                        onChange={(v) => setForm((f) => ({ ...f, fps_limit: v }))}
                      />
                      <span className="font-display text-[9px] text-text-secondary/40 uppercase">FPS</span>
                    </div>
                  </FieldRow>
                </div>
              </HudPanel>

              {/* 预警阈值 */}
              <HudPanel title="拥堵预警阈值">
                <div>
                  {LEVEL_CONFIG.map(({ label, color, val }, i) => (
                    <FieldRow key={label} label={`${label} 阈值`}>
                      <div className="flex items-center gap-3">
                        <NumInput
                          value={val} min={1}
                          onChange={(v) => {
                            const key = ['alert_l2_threshold', 'alert_l3_threshold', 'alert_l4_threshold'][i] as keyof FormState
                            setForm((f) => ({ ...f, [key]: v }))
                          }}
                        />
                        <span className="font-mono text-[10px] text-text-secondary/50">辆</span>
                        <span
                          className="rounded-sm px-1.5 py-0.5 font-display text-[9px] font-bold tracking-widest uppercase"
                          style={{ color, background: `${color}15`, border: `1px solid ${color}30` }}
                        >
                          {label}
                        </span>
                      </div>
                    </FieldRow>
                  ))}
                </div>
              </HudPanel>

              {/* 异常停车 */}
              <HudPanel title="异常停车检测">
                <FieldRow label="静止判定秒数" hint="5–300s">
                  <div className="flex items-center gap-3">
                    <NumInput
                      value={form.park_timeout_seconds} min={5} max={300}
                      onChange={(v) => setForm((f) => ({ ...f, park_timeout_seconds: v }))}
                    />
                    <HudRange
                      min={5} max={300} value={form.park_timeout_seconds}
                      onChange={(v) => setForm((f) => ({ ...f, park_timeout_seconds: v }))}
                    />
                  </div>
                </FieldRow>
              </HudPanel>

            </div>

            {/* 右列：预览 + 说明 */}
            <div className="space-y-4">

              {/* 计数线预览 */}
              <HudPanel title="计数线预览">
                <div
                  className="relative w-full overflow-hidden rounded-sm"
                  style={{ aspectRatio: '4/3', background: '#060B18', border: '1px solid rgba(0,212,255,0.08)' }}
                >
                  <HudCorners color="#00D4FF" length={8} thickness={1} pulse={false} />

                  {/* 扫描纹理 */}
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.07) 3px, rgba(0,0,0,0.07) 4px)' }}
                  />

                  {/* 计数线 */}
                  <motion.div
                    className="pointer-events-none absolute inset-x-0"
                    style={{ top: `${lineTopPct}%` }}
                    animate={{ top: `${lineTopPct}%` }}
                    transition={{ type: 'spring', damping: 20, stiffness: 180 }}
                  >
                    <div
                      className="w-full"
                      style={{
                        height: '1px',
                        background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.6) 20%, rgba(0,212,255,0.8) 50%, rgba(0,212,255,0.6) 80%, transparent)',
                        boxShadow: '0 0 4px rgba(0,212,255,0.5)',
                      }}
                    />
                    <div className="flex justify-between px-1 pt-0.5">
                      <span className="font-mono text-[7px] text-accent/50">——</span>
                      <span className="font-mono text-[7px] text-accent/60">Y={form.line_y}</span>
                    </div>
                  </motion.div>

                  {/* 分辨率标注 */}
                  <span className="absolute bottom-1 right-2 font-mono text-[7px] text-text-secondary/25">
                    {resW}×{resH}
                  </span>
                </div>
              </HudPanel>

              {/* 预警等级速查 */}
              <HudPanel title="预警等级速查">
                <div className="space-y-2">
                  {LEVEL_CONFIG.map(({ label, color, val, desc }) => (
                    <div
                      key={label}
                      className="flex items-center gap-2.5 rounded-sm px-2.5 py-2"
                      style={{ background: `${color}08`, border: `1px solid ${color}18` }}
                    >
                      <span
                        className="rounded-sm px-1.5 py-0.5 font-display text-[9px] font-bold tracking-widest uppercase"
                        style={{ color, background: `${color}20`, border: `1px solid ${color}35` }}
                      >
                        {label}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-mono text-[10px] text-text-primary">≥ {val} 辆</span>
                        <span className="font-mono text-[8px] text-text-secondary/50">{desc}</span>
                      </div>
                    </div>
                  ))}
                  <div
                    className="flex items-center gap-2.5 rounded-sm px-2.5 py-2"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <span className="font-mono text-[9px] text-text-secondary/55">
                      停车 {form.park_timeout_seconds}s → 异常停车 L3
                    </span>
                  </div>
                </div>
              </HudPanel>

            </div>
          </div>
        )}

        {/* 底部按钮 */}
        {!isLoading && (
          <div className="flex justify-end gap-3 pb-4">
            <button
              onClick={handleReset}
              className="rounded-sm px-4 py-2 font-display text-[10px] tracking-[0.18em] uppercase transition-all"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: 'rgba(122,144,179,0.7)',
              }}
            >
              重置
            </button>
            <motion.button
              onClick={handleSave}
              disabled={saving}
              className="relative flex items-center gap-2 overflow-hidden rounded-sm px-6 py-2 font-display text-[10px] font-bold tracking-[0.18em] uppercase disabled:opacity-40"
              style={{
                background: 'rgba(0,212,255,0.08)',
                border: '1px solid rgba(0,212,255,0.35)',
                color: '#00D4FF',
              }}
              whileHover={{ background: 'rgba(0,212,255,0.16)' }}
              whileTap={{ scale: 0.98 }}
            >
              {!saving && (
                <motion.div
                  className="pointer-events-none absolute inset-y-0 w-12 -skew-x-12"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.2), transparent)' }}
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear', repeatDelay: 1.5 }}
                />
              )}
              {saving && (
                <motion.span
                  className="block h-3 w-3 rounded-full border border-accent border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                />
              )}
              <span className="relative">保存配置</span>
            </motion.button>
          </div>
        )}

      </div>

      {/* Toast 通知 */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-sm px-4 py-3 font-mono text-xs shadow-xl"
            style={{
              background: 'rgba(15,22,40,0.95)',
              border: `1px solid ${toast.ok ? 'rgba(0,230,118,0.35)' : 'rgba(244,67,54,0.35)'}`,
              color: toast.ok ? 'var(--color-online)' : 'var(--color-alert-l4)',
              backdropFilter: 'blur(8px)',
            }}
            initial={{ opacity: 0, y: 12, x: 12 }}
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
