import { Effect, Layer, Option } from "effect"
import { ReceiptEvents, ReceiptRow } from "./Receipts/Events"
import { EventLog, EventRow } from "effect/eventlog"
import { QueryBuilder } from "./IndexedDb"
import { Receipt } from "./Domain/Receipt"

const ReceiptsLive = EventLog.group(ReceiptEvents, (handlers) =>
  Effect.gen(function* () {
    const db = yield* QueryBuilder
    const receipts = db.from("receipts")
    return handlers.handle(
      "Receipt",
      EventRow.handler(ReceiptRow, {
        set: (row) => receipts.upsert(new Receipt(row)).pipe(Effect.orDie),
        // a patch never recreates a removed row
        patch: Effect.fn(function* (
          id: Receipt["id"],
          fields: Partial<typeof Receipt.select.Type>,
        ) {
          const current = yield* receipts
            .select()
            .equals(id)
            .first()
            .pipe(Effect.catchNoSuchElement)
          if (Option.isNone(current)) return
          yield* receipts.upsert(new Receipt({ ...current.value, ...fields }))
        }, Effect.orDie),
        remove: (id) => receipts.delete().equals(id).pipe(Effect.orDie),
      }),
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
