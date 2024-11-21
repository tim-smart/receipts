import { Image } from "@/Domain/Image"
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
    () => URL.createObjectURL(new Blob([src.data], { type: src.contentType })),
    [src],
  )
  return asLink ? (
    <a href={url} target="_blank">
      <img src={url} className={className} />
    </a>
  ) : (
    <img src={url} className={className} />
  )
}
