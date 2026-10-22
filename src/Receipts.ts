import { Receipt } from "./Domain/Receipt"
import { Effect, Layer, Option } from "effect"
import { ReceiptEvents, ReceiptRow } from "./Receipts/Events"
import { EventLog, EventRow } from "effect/eventlog"
import { QueryBuilder } from "./IndexedDb"

const ReceiptsLive = EventLog.group(ReceiptEvents, (handlers) =>
  Effect.gen(function* () {
    const db = yield* QueryBuilder
    const receipts = db.from("receipts")

    return (
      handlers
        .handle(
          "Receipt",
          EventRow.handler(ReceiptRow, {
            set: (row) => receipts.upsert(new Receipt(row)).pipe(Effect.orDie),
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
        )
        // legacy events, replay only
        .handle(
          "ReceiptCreate",
          Effect.fn(function* ({ payload }) {
            const receipt = new Receipt(payload)
            yield* receipts.insert(receipt)
            return receipt
          }, Effect.orDie),
        )
        .handle(
          "ReceiptUpdate",
          Effect.fn(function* ({ payload, conflicts }) {
            const current = yield* receipts.select().equals(payload.id).first()
            let merged = Object.assign({}, current, payload)
            for (const conflict in conflicts) {
              Object.assign(merged, conflict)
            }
            yield* receipts.upsert(new Receipt(merged))
          }, Effect.orDie),
        )
        .handle(
          "ReceiptDelete",
          Effect.fn(function* ({ payload }) {
            yield* receipts.delete().equals(payload)
          }, Effect.orDie),
        )
        .handle(
          "ReceiptSetProcessed",
          Effect.fn(function* ({ payload, conflicts }) {
            if (conflicts.length) return
            const current = yield* receipts.select().equals(payload.id).first()
            yield* receipts.upsert(
              new Receipt({
                ...current,
                processed: payload.processed,
              }),
            )
          }, Effect.orDie),
        )
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
