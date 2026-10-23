import { Effect, Layer, Option } from "effect"
import { ReceiptGroupEvents, ReceiptGroupRow } from "./ReceiptGroups/Events"
import { EventLog, EventRow } from "effect/eventlog"
import { QueryBuilder } from "./IndexedDb"
import { Projection } from "./Projection"

const ReceiptGroupsLive = EventLog.group(ReceiptGroupEvents, (handlers) =>
  Effect.gen(function* () {
    const db = yield* QueryBuilder
    const projection = yield* Projection
    const groups = db.from("receiptGroups")

    return (
      handlers
        .handle(
          "ReceiptGroup",
          projection.row(
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
          ),
        )
        // legacy events, only replayed from remotes
        .handle("GroupCreate", projection.legacy)
        .handle("GroupUpdate", projection.legacy)
        .handle("GroupDelete", projection.legacy)
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
