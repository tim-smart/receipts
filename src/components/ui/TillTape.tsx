import { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function TillTape({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("till-tape-outline", className)}>
      <div className="till-tape px-5 pt-4.5 pb-7.5">{children}</div>
    </div>
  )
}

export function TillTapeHead({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "flex min-h-8 items-center justify-between gap-2 font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase",
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * A label and value joined by a dotted leader, like a line on a printed
 * receipt.
 */
export function TillTapeLine({
  label,
  value,
  className,
}: {
  label: ReactNode
  value: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-baseline gap-2 font-mono text-[13px] text-muted-foreground",
        className,
      )}
    >
      <span className="shrink-0">{label}</span>
      <span
        aria-hidden
        className="min-w-4 flex-1 -translate-y-1 border-b-[1.5px] border-dotted border-muted-foreground/40"
      />
      <span className="shrink-0 font-medium text-foreground tabular-nums">
        {value}
      </span>
    </div>
  )
}
