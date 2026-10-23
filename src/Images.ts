import { Effect, Layer } from "effect"
import { ImageEvents, ImageRow } from "./Images/Events"
import { EventLog, EventRow } from "effect/eventlog"
import { QueryBuilder } from "./IndexedDb"
import { DataReset } from "./Reset"
import { makeRowStores } from "./Rows"

const ImagesHandlers = EventLog.group(ImageEvents, (handlers) =>
  Effect.gen(function* () {
    const stores = makeRowStores(yield* QueryBuilder)
    const reset = yield* DataReset
    return handlers.handle(
      "Image",
      reset.guard(EventRow.handler(ImageRow, stores.Image)),
    )
  }),
).pipe(Layer.provide([QueryBuilder.layer]))

const ImagesCompaction = EventRow.compaction(ImageEvents, ImageRow)

export const ImagesLive = Layer.mergeAll(ImagesHandlers, ImagesCompaction)
