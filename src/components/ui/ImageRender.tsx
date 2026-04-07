import { Image } from "@/Domain/Image"
import { cn } from "@/lib/utils"
import { useMemo } from "react"

export function ImageRender({
  src,
  className,
  asLink = false,
}: {
  src: Image
  className?: string
  asLink?: boolean
}) {
  const url = useMemo(
    () =>
      URL.createObjectURL(
        new Blob([src.data as Uint8Array<ArrayBuffer>], {
          type: src.contentType,
        }),
      ),
    [src],
  )
  return asLink ? (
    <a href={url} target="_blank">
      <img
        src={url}
        className={cn(className, "[dynamic-range-limit:standard]")}
      />
    </a>
  ) : (
    <img src={url} className={className} />
  )
}
