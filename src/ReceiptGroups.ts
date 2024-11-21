import { EventLog } from "@effect/experimental"
import { Model } from "@effect/sql"
import { Effect, Layer } from "effect"
import { SqlLive } from "./Sql"
import { ReceiptGroup } from "./Domain/ReceiptGroup"
import { ReceiptGroupEvents } from "./ReceiptGroups/Events"

export const ReceiptGroupsLive = EventLog.group(
  ReceiptGroupEvents,
  (handlers) =>
    Effect.gen(function* () {
      const repo = yield* Model.makeRepository(ReceiptGroup, {
        tableName: "receipt_groups",
        idColumn: "id",
        spanPrefix: "ReceiptGroups",
      })

      return handlers
        .handle("GroupCreate", ({ payload }) => repo.insert(payload))
        .handle("GroupUpdate", ({ payload, conflicts }) =>
          Effect.gen(function* () {
            let merged = Object.assign({}, payload)
            for (const conflict in conflicts) {
              Object.assign(merged, conflict)
            }
            yield* repo.update(merged)
          }),
        )
        .handle("GroupDelete", ({ payload }) => repo.delete(payload))
    }),
).pipe(Layer.provide(SqlLive))
