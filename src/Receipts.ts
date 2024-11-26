import { EventLog } from "@effect/experimental"
import { Model, SqlClient } from "@effect/sql"
import { Receipt } from "./Domain/Receipt"
import { Effect, Layer } from "effect"
import { SqlLive } from "./Sql"
import { ReceiptEvents } from "./Receipts/Events"

export const ReceiptsLive = EventLog.group(ReceiptEvents, (handlers) =>
  Effect.gen(function* () {
    const repo = yield* Model.makeRepository(Receipt, {
      tableName: "receipts",
      idColumn: "id",
      spanPrefix: "Receipts",
    })
    const sql = yield* SqlClient.SqlClient

    return handlers
      .handle("ReceiptCreate", ({ payload }) => repo.insert(payload))
      .handle("ReceiptUpdate", ({ payload, conflicts }) =>
        Effect.gen(function* () {
          let merged = Object.assign({}, payload)
          for (const conflict in conflicts) {
            Object.assign(merged, conflict)
          }
          yield* repo.update(merged)
        }),
      )
      .handle("ReceiptDelete", ({ payload }) => repo.delete(payload))
      .handle("ReceiptSetProcessed", ({ payload, conflicts }) =>
        Effect.gen(function* () {
          if (conflicts.length) return
          yield* sql`update receipts set processed = ${payload.processed} where id = ${payload.id}`.pipe(
            Effect.orDie,
          )
        }),
      )
  }),
).pipe(Layer.provide(SqlLive))

export const ReceiptsCompactionLive = EventLog.groupCompaction(
  ReceiptEvents,
  ({ events, write }) =>
    Effect.gen(function* () {
      if (events.some((_) => _._tag === "ReceiptDelete")) return
      let create = false
      const payload = {} as any
      for (const event of events) {
        switch (event._tag) {
          case "ReceiptCreate": {
            create = true
            Object.assign(payload, event.payload)
            break
          }
          case "ReceiptUpdate": {
            Object.assign(payload, event.payload)
            break
          }
          case "ReceiptSetProcessed": {
            payload.processed = event.payload.processed
            break
          }
        }
      }
      yield* write(create ? "ReceiptCreate" : "ReceiptUpdate", payload)
    }),
)
