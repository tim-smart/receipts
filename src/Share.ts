import { BigDecimal, DateTime, Effect } from "effect"
import { Atom } from "effect/reactivity"
import { clientAtom } from "./EventLog"
import { Receipt } from "./Domain/Receipt"
import { settingOptionAtom } from "./Settings/atoms"
import { currentGroupId } from "./Domain/Setting"
import { createImageAtom } from "./Images/atoms"

export const shareAtom = Atom.make(
  Effect.fnUntraced(function* (get) {
    const client = yield* get.result(clientAtom)
    // @effect-diagnostics-next-line asyncFunction:off
    const data = yield* Effect.promise(async () => {
      const cache = await caches.open("receipts")
      const response = await cache.match("/share")
      if (!response) return null
      await cache.delete("/share")
      const contentType = response.headers.get("content-type") ?? "image/jpeg"
      return {
        data: await response.blob(),
        contentType,
      }
    })
    if (!data) return

    const groupId = yield* get.some(settingOptionAtom(currentGroupId))
    const receipt = yield* client({
      event: "ReceiptCreate",
      payload: Receipt.insert.make({
        groupId,
        date: yield* DateTime.now,
        description: "",
        amount: BigDecimal.fromNumberUnsafe(0),
        merchant: "",
        currency: "USD",
        processed: false,
      }),
    })
    yield* get.setResult(createImageAtom, {
      receiptId: receipt.id,
      file: new File([data.data], "receipt", {
        type: data.contentType,
      }),
    })
  }),
)
