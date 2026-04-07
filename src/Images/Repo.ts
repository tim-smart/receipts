import { Image, ImageWithObjectUrl } from "@/Domain/Image"
import { ReceiptId } from "@/Domain/Receipt"
import { EventLogClient } from "@/EventLog"
import { QueryBuilder } from "@/IndexedDb"
import { Cache, Data, Effect, Equal, Hash, Layer, Context } from "effect"

export class ImagesRepo extends Context.Service<ImagesRepo>()(
  "Images/ImagesRepo",
  {
    make: Effect.gen(function* () {
      const idb = yield* QueryBuilder
      const images = idb.from("images")
      const objectUrls = yield* Cache.make({
        lookup: ({ image }: ObjectUrlLookup) =>
          Effect.sync(
            () =>
              new ImageWithObjectUrl({
                ...image,
                objectUrl: URL.createObjectURL(
                  new Blob([image.data as Uint8Array<ArrayBuffer>], {
                    type: image.contentType,
                  }),
                ),
              }),
          ),
        capacity: 100,
      })

      const forReceipt = (receiptId: typeof ReceiptId.Type) =>
        images
          .select("receiptId")
          .equals(receiptId)
          .asEffect()
          .pipe(
            Effect.flatMap(
              Effect.forEach((image) =>
                Cache.get(objectUrls, new ObjectUrlLookup({ image })),
              ),
            ),
          )

      return { forReceipt } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide([QueryBuilder.layer, EventLogClient.layer]),
  )
}

class ObjectUrlLookup extends Data.Class<{
  image: Image
}> {
  [Hash.symbol]() {
    return Hash.hash(this.image.id)
  }
  [Equal.symbol](that: ObjectUrlLookup) {
    return Equal.equals(this.image.id, that.image.id)
  }
}
