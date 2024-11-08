import { ReactNode } from "react"
import { TypoH1 } from "./TypoH1"
import { cn } from "@/lib/utils"

export function Scaffold({
  className,
  heading,
  children,
}: {
  heading: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      <header className="pt-20">
        <TypoH1>{heading}</TypoH1>
      </header>

      <div className="h-5" />

      {children}
    </div>
  )
}
