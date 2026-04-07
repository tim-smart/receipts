import { Receipt } from "./Domain/Receipt"
import { Effect, Layer } from "effect"
import { ReceiptEvents } from "./Receipts/Events"
import { EventLog } from "effect/unstable/eventlog"
import { QueryBuilder } from "./IndexedDb"

const ReceiptsLive = EventLog.group(ReceiptEvents, (handlers) =>
  Effect.gen(function* () {
    const db = yield* QueryBuilder
    const receipts = db.from("receipts")

    return handlers
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
  }),
).pipe(Layer.provide(QueryBuilder.layer))

const ReceiptsCompactionLive = EventLog.groupCompaction(
  ReceiptEvents,
  Effect.fn(function* ({ events, write }) {
    let create = false
    const payload = {} as any
    for (const event of events) {
      switch (event._tag) {
        case "ReceiptDelete": {
          return yield* write("ReceiptDelete", event.payload)
        }
        case "ReceiptCreate": {
          create = true
          Object.assign(payload, event.payload)
          break
        }
        default: {
          Object.assign(payload, event.payload)
          break
        }
      }
    }
    if (create) {
      yield* write("ReceiptCreate", Receipt.insert.make(payload))
    } else {
      yield* write("ReceiptUpdate", Receipt.update.make(payload))
    }
  }),
)

const ReceiptsReactivityLive = EventLog.groupReactivity(ReceiptEvents, [
  "receipts",
])

export const ReceiptsLayer = Layer.mergeAll(
  ReceiptsLive,
  ReceiptsCompactionLive,
  ReceiptsReactivityLive,
)
