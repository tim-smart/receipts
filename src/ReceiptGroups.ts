import { Effect, Layer, Option } from "effect"
import { ReceiptGroupEvents, ReceiptGroupRow } from "./ReceiptGroups/Events"
import { EventLog, EventRow } from "effect/eventlog"
import { QueryBuilder } from "./IndexedDb"
import { ReceiptGroup } from "./Domain/ReceiptGroup"

const ReceiptGroupsLive = EventLog.group(ReceiptGroupEvents, (handlers) =>
  Effect.gen(function* () {
    const db = yield* QueryBuilder
    const groups = db.from("receiptGroups")

    return (
      handlers
        .handle(
          "ReceiptGroup",
          EventRow.handler(ReceiptGroupRow, {
            set: (row) => groups.upsert(row).pipe(Effect.orDie),
            patch: Effect.fn(function* (id, fields) {
              const current = yield* groups
                .select()
                .equals(id)
                .first()
                .pipe(Effect.catchNoSuchElement)
              // a patch never recreates a missing (e.g. removed) row
              if (Option.isNone(current)) return
              yield* groups.upsert({ ...current.value, ...fields })
            }, Effect.orDie),
            remove: (id) => groups.delete().equals(id).pipe(Effect.orDie),
          }),
        )
        // legacy events, replay only
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
          groups.delete().equals(payload).pipe(Effect.orDie),
        )
    )
  }),
).pipe(Layer.provide(QueryBuilder.layer))

const ReceiptGroupsCompactionLive = EventRow.compaction(
  ReceiptGroupEvents,
  ReceiptGroupRow,
)

const ReceiptGroupsReactivityLive = EventLog.groupReactivity(
  ReceiptGroupEvents,
  ["receipt_groups"],
)

export const ReceiptGroupsLayer = Layer.mergeAll(
  ReceiptGroupsLive,
  ReceiptGroupsCompactionLive,
  ReceiptGroupsReactivityLive,
)
