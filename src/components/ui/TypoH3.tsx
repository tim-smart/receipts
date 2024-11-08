import { cn } from "@/lib/utils"
import { ReactNode } from "react"

export function TypoH3({
  children,
  className,
}: {
  children: ReactNode
  className: string
}) {
  return (
    <h3
      className={cn(
        "scroll-m-20 text-2xl font-semibold tracking-tight",
        className,
      )}
    >
      {children}
    </h3>
  )
}
