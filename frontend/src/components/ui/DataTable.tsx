/**
 * 泛型分页表格（设计稿 8.1 节）
 *
 * DataTable<T>
 * Column<T>: key, header, render?, className?
 */
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T, index: number) => React.ReactNode
  className?: string
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  total: number
  page: number
  pageSize?: number
  onPageChange: (page: number) => void
  rowKey: (row: T) => string | number
  loading?: boolean
  emptyText?: string
}

export function DataTable<T>({
  columns,
  data,
  total,
  page,
  pageSize = 20,
  onPageChange,
  rowKey,
  loading = false,
  emptyText = '暂无数据',
}: DataTableProps<T>) {
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-sm border border-[#1E2D4A]">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#1E2D4A] bg-bg-surface/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2 text-left font-medium tracking-widest text-text-secondary uppercase ${col.className ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-text-secondary">
                  <div className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                    加载中...
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-text-secondary/50"
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr
                  key={rowKey(row)}
                  className="border-b border-[#1E2D4A]/50 transition hover:bg-bg-surface/30"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 py-2 text-text-primary ${col.className ?? ''}`}
                    >
                      {col.render
                        ? col.render(row, idx)
                        : String((row as Record<string, unknown>)[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页控制 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-secondary">
            共 {total} 条，第 {page} / {totalPages} 页
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="flex h-6 w-6 items-center justify-center rounded-sm text-text-secondary ring-1 ring-[#1E2D4A] transition hover:text-text-primary disabled:opacity-30"
            >
              <ChevronLeft size={12} />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              // simple page numbers (up to 7)
              const p = i + 1
              return (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  className={[
                    'flex h-6 w-6 items-center justify-center rounded-sm text-[10px] transition',
                    p === page
                      ? 'bg-accent/10 text-accent ring-1 ring-accent/40'
                      : 'text-text-secondary ring-1 ring-[#1E2D4A] hover:text-text-primary',
                  ].join(' ')}
                >
                  {p}
                </button>
              )
            })}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="flex h-6 w-6 items-center justify-center rounded-sm text-text-secondary ring-1 ring-[#1E2D4A] transition hover:text-text-primary disabled:opacity-30"
            >
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
