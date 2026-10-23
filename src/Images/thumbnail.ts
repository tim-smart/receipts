import { Image } from "@/Domain/Image"
import { Effect } from "effect"

const size = 128
const urls = new Map<string, string>()

/**
 * An object URL for a small square JPEG of the image, cropped from the top
 * like the list thumbnails. Thumbnails are cached for the session, so the
 * full-size image is only decoded once.
 */
export const thumbnailUrl = Effect.fnUntraced(function* (image: Image) {
  const cached = urls.get(image.idString)
  if (cached) return cached

  const source = yield* Effect.tryPromise(() =>
    createImageBitmap(
      new Blob([image.data as Uint8Array<ArrayBuffer>], {
        type: image.contentType,
      }),
    ),
  )
  const scale = size / Math.min(source.width, source.height)
  const resized = yield* Effect.tryPromise(() =>
    createImageBitmap(source, {
      resizeWidth: Math.round(source.width * scale),
      resizeHeight: Math.round(source.height * scale),
      resizeQuality: "high",
    }),
  ).pipe(Effect.ensuring(Effect.sync(() => source.close())))

  const canvas = new OffscreenCanvas(size, size)
  canvas.getContext("2d")?.drawImage(resized, (size - resized.width) / 2, 0)
  resized.close()
  const blob = yield* Effect.tryPromise(() =>
    canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 }),
  )

  const url = URL.createObjectURL(blob)
  urls.set(image.idString, url)
  return url
})
