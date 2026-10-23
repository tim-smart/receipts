import { Image, imageBlob } from "@/Domain/Image"
import { Effect } from "effect"

const size = 128

/**
 * An object URL for a small square JPEG of the image, cropped from the top
 * like the list thumbnails.
 */
export const thumbnailUrl = Effect.fnUntraced(function* (image: Image) {
  const source = yield* Effect.tryPromise(() =>
    createImageBitmap(imageBlob(image)),
  )
  const canvas = new OffscreenCanvas(size, size)
  const context = canvas.getContext("2d")
  if (context) {
    context.imageSmoothingQuality = "high"
    const side = Math.min(source.width, source.height)
    context.drawImage(
      source,
      (source.width - side) / 2,
      0,
      side,
      side,
      0,
      0,
      size,
      size,
    )
  }
  source.close()
  const blob = yield* Effect.tryPromise(() =>
    canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 }),
  )
  return URL.createObjectURL(blob)
})
