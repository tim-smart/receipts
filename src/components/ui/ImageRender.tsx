import { ImageWithObjectUrl } from "@/Domain/Image"
import { cn } from "@/lib/utils"

export function ImageRender({
  src,
  className,
  asLink = false,
}: {
  src: ImageWithObjectUrl
  className?: string
  asLink?: boolean
}) {
  return asLink ? (
    <a href={src.objectUrl} target="_blank">
      <img
        src={src.objectUrl}
        className={cn(className, "[dynamic-range-limit:standard]")}
      />
    </a>
  ) : (
    <img src={src.objectUrl} className={className} />
  )
}
