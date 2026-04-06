import { ReceiptId } from "@/Domain/Receipt"
import { EventLogClient } from "@/EventLog"
import { QueryBuilder } from "@/IndexedDb"
import { Effect, Layer, ServiceMap } from "effect"

export class ImagesRepo extends ServiceMap.Service<ImagesRepo>()(
  "Images/ImagesRepo",
  {
    make: Effect.gen(function* () {
      const idb = yield* QueryBuilder
      const images = idb.from("images")

      const forReceipt = (receiptId: typeof ReceiptId.Type) =>
        images.select("receiptId").equals(receiptId).asEffect()

      return { forReceipt } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide([QueryBuilder.layer, EventLogClient.layer]),
  )
}
