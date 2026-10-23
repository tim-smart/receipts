import { Effect, Layer, Option } from "effect"
import { ReceiptGroupEvents, ReceiptGroupRow } from "./ReceiptGroups/Events"
import { EventLog, EventRow } from "effect/eventlog"
import { QueryBuilder } from "./IndexedDb"
import { ReceiptGroup } from "./Domain/ReceiptGroup"

const ReceiptGroupsLive = EventLog.group(ReceiptGroupEvents, (handlers) =>
  Effect.gen(function* () {
    const db = yield* QueryBuilder
    const groups = db.from("receiptGroups")
    return handlers.handle(
      "ReceiptGroup",
      EventRow.handler(ReceiptGroupRow, {
        set: (row) => groups.upsert(row).pipe(Effect.orDie),
        // a patch never recreates a removed row
        patch: Effect.fn(function* (
          id: ReceiptGroup["id"],
          fields: Partial<typeof ReceiptGroup.select.Type>,
        ) {
          const current = yield* groups
            .select()
            .equals(id)
            .first()
            .pipe(Effect.catchNoSuchElement)
          if (Option.isNone(current)) return
          yield* groups.upsert({ ...current.value, ...fields })
        }, Effect.orDie),
        remove: (id) => groups.delete().equals(id).pipe(Effect.orDie),
      }),
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
