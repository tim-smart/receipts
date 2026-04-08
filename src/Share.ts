import { BigDecimal, DateTime, Effect } from "effect"
import { Atom } from "effect/unstable/reactivity"
import { clientAtom } from "./EventLog"
import { Image } from "./Domain/Image"
import { Receipt } from "./Domain/Receipt"
import { settingOptionAtom } from "./Settings/atoms"
import { currentGroupId } from "./Domain/Setting"

export const shareAtom = Atom.make(
  Effect.fnUntraced(function* (get) {
    const client = yield* get.result(clientAtom)
    const data = yield* Effect.promise(async () => {
      const cache = await caches.open("receipts")
      const response = await cache.match("/share")
      if (!response) return null
      await cache.delete("/share")
      const contentType = response.headers.get("content-type") ?? "image/jpeg"
      return {
        data: new Uint8Array(await response.arrayBuffer()),
        contentType,
      }
    })
    if (!data) return

    const groupId = yield* get.some(settingOptionAtom(currentGroupId))
    const receipt = yield* client(
      "ReceiptCreate",
      Receipt.insert.make({
        groupId,
        date: yield* DateTime.now,
        description: "",
        amount: BigDecimal.fromNumberUnsafe(0),
        merchant: "",
        currency: "USD",
        processed: false,
      }),
    )
    const image = Image.insert.make({
      receiptId: receipt.id,
      data: data.data,
      contentType: data.contentType,
    })
    yield* client("ImageCreate", image)
  }),
)
