/**
 * 通用确认对话框（设计稿 8.1 节）
 * 通过 React Portal 渲染到 document.body，确保 z-index 正确。
 */
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = '确认',
  cancelLabel = '取消',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={onCancel}
          />

          {/* Dialog */}
          <motion.div
            className="relative z-10 w-full max-w-sm rounded-sm bg-bg-panel p-6"
            style={{ border: '1px solid rgba(0,212,255,0.2)' }}
            initial={{ scale: 0.95, y: -10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {/* 角标装饰 */}
            <span className="absolute left-0 top-0 h-3 w-3 border-l border-t border-accent" />
            <span className="absolute right-0 top-0 h-3 w-3 border-r border-t border-accent" />
            <span className="absolute bottom-0 left-0 h-3 w-3 border-b border-l border-accent" />
            <span className="absolute bottom-0 right-0 h-3 w-3 border-b border-r border-accent" />

            <h2 className="mb-2 font-display text-sm font-bold tracking-widest text-accent uppercase">
              {title}
            </h2>
            <p className="mb-6 text-sm text-text-secondary leading-relaxed">{message}</p>

            <div className="flex justify-end gap-3">
              <button
                onClick={onCancel}
                disabled={loading}
                className="rounded-sm px-4 py-2 text-xs text-text-secondary ring-1 ring-[#1E2D4A] transition hover:ring-text-secondary/40 disabled:opacity-40"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className="flex items-center gap-2 rounded-sm bg-alert-l4/10 px-4 py-2 text-xs font-semibold text-alert-l4 ring-1 ring-alert-l4/40 transition hover:bg-alert-l4/20 disabled:opacity-40"
              >
                {loading && (
                  <span className="h-3 w-3 animate-spin rounded-full border border-alert-l4 border-t-transparent" />
                )}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
