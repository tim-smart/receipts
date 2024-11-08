import { ReactNode } from "react"
import { TypoH1 } from "./TypoH1"
import { cn } from "@/lib/utils"
import { TypoH3 } from "./TypoH3"

export function Scaffold({
  className,
  heading,
  subHeading,
  leading,
  children,
}: {
  heading: string
  subHeading?: string
  leading?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col pb-safe", className)}>
      <header className="pt-20 relative">
        {leading && <div className="absolute top-5 left-0">{leading}</div>}
        <TypoH1>{heading}</TypoH1>
        {subHeading && <TypoH3 className="font-medium">{subHeading}</TypoH3>}
      </header>

      <div className="h-5" />

      {children}
    </div>
  )
}
