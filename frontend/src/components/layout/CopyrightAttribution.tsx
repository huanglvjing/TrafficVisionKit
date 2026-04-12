import { cn } from '@/lib/utils'

type Props = {
  className?: string
}

export function CopyrightAttribution({ className }: Props) {
  const year = new Date().getFullYear()

  return (
    <span
      className={cn(
        'flex flex-wrap items-baseline gap-x-1.5 text-[10px] text-text-secondary/50',
        className
      )}
    >
      <span>© {year}</span>
      <span
        className="copyright-author-signature"
        aria-label={'\u503e\u542c\u9189\u68a6\u8bed'}
      />
      <span>· 软件著作权 · 保留所有权利</span>
    </span>
  )
}
