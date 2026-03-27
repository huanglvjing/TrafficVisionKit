import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 千分位格式，如 12345 → "12,345" */
export function formatCount(n: number): string {
  return Math.round(n).toLocaleString('zh-CN')
}

/**
 * 秒数 → 时分秒字符串
 * e.g. 307 → "5分07秒"，3665 → "1时01分05秒"
 */
export function formatDuration(s: number): string {
  const total = Math.max(0, Math.floor(s))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  if (h > 0) {
    return `${h}时${m.toString().padStart(2, '0')}分${sec.toString().padStart(2, '0')}秒`
  }
  if (m > 0) {
    return `${m}分${sec.toString().padStart(2, '0')}秒`
  }
  return `${sec}秒`
}

/**
 * ISO 时间字符串 → 本地时间字符串
 * e.g. "2026-03-25T14:30:00.000Z" → "2026/3/25 22:30:00"
 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', { hour12: false })
}

/**
 * 预警等级 → CSS 变量名（用于 style={{ color: alertLevelColor(level) }}）
 * 0=正常（accent色），1~5=对应预警色
 */
export function alertLevelColor(level: number): string {
  if (level <= 0) return 'var(--color-accent)'
  const clamped = Math.min(level, 5)
  return `var(--color-alert-l${clamped})`
}

/** 预警等级 → 中文标签，如 alertLevelLabel(3) → "三级预警" */
export function alertLevelLabel(level: number): string {
  const labels: Record<number, string> = {
    0: '正常',
    1: '一级预警',
    2: '二级预警',
    3: '三级预警',
    4: '四级预警',
    5: '五级预警',
  }
  return labels[Math.max(0, Math.min(level, 5))] ?? '正常'
}

/** 预警类型 → 中文名称 */
export function alertTypeLabel(alertType: string): string {
  const map: Record<string, string> = {
    congestion: '交通拥堵',
    abnormal_stop: '异常停车',
    flow_spike: '流量突增',
    flow_zero: '零流量',
    device_offline: '设备离线',
  }
  return map[alertType] ?? alertType
}
