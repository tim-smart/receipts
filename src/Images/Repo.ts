import { Image, imageBlob, ImageWithObjectUrl } from "@/Domain/Image"
import { ReceiptId } from "@/Domain/Receipt"
import { EventLogClient } from "@/EventLog"
import { QueryBuilder } from "@/IndexedDb"
import { thumbnailUrl } from "./thumbnail"
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
                objectUrl: URL.createObjectURL(imageBlob(image)),
              }),
          ),
        capacity: 100,
      })
      // thumbnails are kept for the session, so the full-size image is only
      // decoded once
      const thumbnails = yield* Cache.make({
        lookup: ({ image }: ObjectUrlLookup) => thumbnailUrl(image),
        capacity: 100,
      })

      const forReceipt = (receiptId: ReceiptId) =>
        images
          .select("receiptId")
          .equals(receiptId)
          .pipe(
            Effect.flatMap(
              Effect.forEach((image) =>
                Cache.get(objectUrls, new ObjectUrlLookup({ image })),
              ),
            ),
          )

      /**
       * A small thumbnail of the receipt's first image, if it has one.
       */
      const thumbnailForReceipt = (receiptId: ReceiptId) =>
        images
          .select("receiptId")
          .equals(receiptId)
          .first()
          .pipe(
            Effect.flatMap((image) =>
              Cache.get(thumbnails, new ObjectUrlLookup({ image })),
            ),
            Effect.option,
          )

      return { forReceipt, thumbnailForReceipt } as const
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
