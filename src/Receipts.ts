import { Effect, Layer } from "effect"
import { ReceiptEvents, ReceiptRow } from "./Receipts/Events"
import { EventLog, EventRow } from "effect/eventlog"
import { QueryBuilder } from "./IndexedDb"
import { DataReset } from "./Reset"
import { makeRowStores } from "./Rows"

const ReceiptsLive = EventLog.group(ReceiptEvents, (handlers) =>
  Effect.gen(function* () {
    const stores = makeRowStores(yield* QueryBuilder)
    const reset = yield* DataReset
    return handlers.handle(
      "Receipt",
      reset.guard(EventRow.handler(ReceiptRow, stores.Receipt)),
    )
  }),
).pipe(Layer.provide(QueryBuilder.layer))

const ReceiptsCompactionLive = EventRow.compaction(ReceiptEvents, ReceiptRow)

const ReceiptsReactivityLive = EventLog.groupReactivity(ReceiptEvents, [
  "receipts",
])

export const ReceiptsLayer = Layer.mergeAll(
  ReceiptsLive,
  ReceiptsCompactionLive,
  ReceiptsReactivityLive,
)
