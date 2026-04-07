import { Effect, Layer } from "effect"
import { ReceiptGroupEvents } from "./ReceiptGroups/Events"
import { EventLog } from "effect/unstable/eventlog"
import { QueryBuilder } from "./IndexedDb"
import { ReceiptGroup } from "./Domain/ReceiptGroup"

const ReceiptGroupsLive = EventLog.group(ReceiptGroupEvents, (handlers) =>
  Effect.gen(function* () {
    const db = yield* QueryBuilder
    const groups = db.from("receiptGroups")

    return handlers
      .handle(
        "GroupCreate",
        Effect.fn(function* ({ payload }) {
          const group = new ReceiptGroup(payload)
          yield* groups.insert(payload)
          return group
        }, Effect.orDie),
      )
      .handle(
        "GroupUpdate",
        Effect.fn(function* ({ payload, conflicts }) {
          const current = yield* groups.select().equals(payload.id).first()
          let merged = Object.assign({}, current, payload)
          for (const conflict in conflicts) {
            Object.assign(merged, conflict)
          }
          yield* groups.upsert(merged)
        }, Effect.orDie),
      )
      .handle("GroupDelete", ({ payload }) =>
        groups.delete().equals(payload).asEffect().pipe(Effect.orDie),
      )
  }),
).pipe(Layer.provide(QueryBuilder.layer))

const ReceiptGroupsReactivityLive = EventLog.groupReactivity(
  ReceiptGroupEvents,
  ["receipt_groups"],
)

export const ReceiptGroupsLayer = Layer.mergeAll(
  ReceiptGroupsLive,
  ReceiptGroupsReactivityLive,
)
