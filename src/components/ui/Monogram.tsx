import { CSSProperties } from "react"
import { ReceiptText } from "lucide-react"
import { cn } from "@/lib/utils"

const hue = (name: string) => {
  let hash = 0
  for (const char of name.toLowerCase()) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360
  }
  return hash
}

/**
 * The first letter of a merchant's name on a tint derived from the name, so
 * the same merchant always gets the same colour.
 */
export function Monogram({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const letter = name.match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase()
  return (
    <div
      aria-hidden
      className={cn(
        "monogram grid size-10.5 shrink-0 place-items-center rounded-[11px] text-base font-semibold",
        className,
      )}
      style={{ "--hue": hue(name) } as CSSProperties}
    >
      {letter ?? <ReceiptText className="size-4.5" />}
    </div>
  )
}
