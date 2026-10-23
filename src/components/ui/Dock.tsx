import { ComponentProps, ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Button } from "./button"

/**
 * Pins its actions to the bottom of the screen, fading out the content that
 * scrolls underneath.
 */
export function Dock({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-10 bg-linear-to-t from-background from-60% to-transparent px-5 pt-10 pb-[env(safe-area-inset-bottom)]",
        className,
      )}
    >
      <div className="pointer-events-auto mx-auto flex w-full max-w-sm flex-col items-center gap-2 pb-5">
        {children}
      </div>
    </div>
  )
}

/**
 * The primary action in a `Dock`.
 */
export function DockButton({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(
        "h-12 w-full rounded-2xl text-[15px] font-semibold shadow-lg shadow-black/15 dark:shadow-black/40",
        className,
      )}
      {...props}
    />
  )
}
