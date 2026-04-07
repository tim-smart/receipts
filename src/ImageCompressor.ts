import Compressor from "compressorjs"
import { Effect, Layer, Schema, ServiceMap } from "effect"

export class ImageCompressor extends ServiceMap.Service<ImageCompressor>()(
  "receipts/ImageCompressor",
  {
    make: Effect.gen(function* () {
      const compress = (file: File) =>
        Effect.callback<File, ImageCompressorError>((resume) => {
          new Compressor(file, {
            quality: 0.6,
            maxHeight: 1500,
            maxWidth: 1500,
            retainExif: true,
            checkOrientation: true,

            success(result) {
              resume(Effect.succeed(result as File))
            },
            error(cause) {
              resume(new ImageCompressorError({ cause }).asEffect())
            },
          })
        })

      return { compress } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}

export class ImageCompressorError extends Schema.TaggedErrorClass<ImageCompressorError>()(
  "ImageCompressorError",
  {
    cause: Schema.DefectWithStack,
  },
) {}
