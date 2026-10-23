import { Effect, Layer } from "effect"
import { ReceiptGroupEvents, ReceiptGroupRow } from "./ReceiptGroups/Events"
import { EventLog, EventRow } from "effect/eventlog"
import { QueryBuilder } from "./IndexedDb"
import { DataReset } from "./Reset"
import { makeRowStores } from "./Rows"

const ReceiptGroupsLive = EventLog.group(ReceiptGroupEvents, (handlers) =>
  Effect.gen(function* () {
    const stores = makeRowStores(yield* QueryBuilder)
    const reset = yield* DataReset
    return handlers.handle(
      "ReceiptGroup",
      reset.guard(EventRow.handler(ReceiptGroupRow, stores.ReceiptGroup)),
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
