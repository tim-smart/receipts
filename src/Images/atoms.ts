import { Image } from "@/Domain/Image"
import { ReceiptId } from "@/Domain/Receipt"
import { clientAtom } from "@/EventLog"
import { ImageCompressor } from "@/ImageCompressor"
import { Effect } from "effect"
import { Atom } from "effect/unstable/reactivity"

const runtime = Atom.runtime(ImageCompressor.layer)

export const createImageAtom = runtime.fn<{
  readonly file: File
  readonly receiptId: ReceiptId
}>()(
  Effect.fnUntraced(function* ({ file, receiptId }, get) {
    const compress = yield* ImageCompressor
    const client = yield* get.result(clientAtom)
    const resized = yield* compress.compress(file)
    const data = yield* Effect.promise(() => resized.arrayBuffer())
    const image = Image.insert.make({
      receiptId,
      contentType: file.type,
      data: new Uint8Array(data),
    })
    yield* client("ImageCreate", image)
    return new Image(image)
  }),
  { concurrent: true },
)
