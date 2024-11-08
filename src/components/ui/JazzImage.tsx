import { ImageDefinition } from "jazz-tools"
import { useMemo } from "react"

export function JazzImage({
  src,
  className,
  asLink = false,
}: {
  src: ImageDefinition
  className?: string
  asLink?: boolean
}) {
  const res = src.highestResAvailable()
  const url = useMemo(
    () =>
      res ? URL.createObjectURL(res.stream.toBlob()!) : src.placeholderDataURL,
    [res],
  )
  return asLink ? (
    <a href={url} target="_blank">
      <img src={url} className={className} />
    </a>
  ) : (
    <img src={url} className={className} />
  )
}
