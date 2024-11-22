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
      .handle("ReceiptCreate", ({ payload }) => {
        console.log("ReceiptCreate", payload)
        return repo.insert(payload)
      })
      .handle("ReceiptUpdate", ({ payload, conflicts }) =>
        Effect.gen(function* () {
          console.log("ReceiptUpdate", payload, conflicts)
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
