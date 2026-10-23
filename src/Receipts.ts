import { Receipt } from "./Domain/Receipt"
import { Effect, Layer, Option } from "effect"
import { ReceiptEvents, ReceiptRow } from "./Receipts/Events"
import { EventLog, EventRow } from "effect/eventlog"
import { QueryBuilder } from "./IndexedDb"
import { Projection } from "./Projection"

const ReceiptsLive = EventLog.group(ReceiptEvents, (handlers) =>
  Effect.gen(function* () {
    const db = yield* QueryBuilder
    const projection = yield* Projection
    const receipts = db.from("receipts")

    return (
      handlers
        .handle(
          "Receipt",
          projection.row(
            EventRow.handler(ReceiptRow, {
              set: (row) =>
                receipts.upsert(new Receipt(row)).pipe(Effect.orDie),
              patch: Effect.fn(function* (id, fields) {
                const current = yield* receipts
                  .select()
                  .equals(id)
                  .first()
                  .pipe(Effect.catchNoSuchElement)
                // a patch never recreates a missing (e.g. removed) row
                if (Option.isNone(current)) return
                yield* receipts.upsert(
                  new Receipt({ ...current.value, ...fields }),
                )
              }, Effect.orDie),
              remove: (id) => receipts.delete().equals(id).pipe(Effect.orDie),
            }),
          ),
        )
        // legacy events, only replayed from remotes
        .handle("ReceiptCreate", projection.legacy)
        .handle("ReceiptUpdate", projection.legacy)
        .handle("ReceiptDelete", projection.legacy)
        .handle("ReceiptSetProcessed", projection.legacy)
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
