import { Effect, Layer, Option } from "effect"
import { ImageEvents, ImageRow } from "./Images/Events"
import { EventLog, EventRow } from "effect/eventlog"
import { QueryBuilder } from "./IndexedDb"
import { Projection } from "./Projection"
import { Image } from "./Domain/Image"

const ImagesHandlers = EventLog.group(ImageEvents, (handlers) =>
  Effect.gen(function* () {
    const db = yield* QueryBuilder
    const projection = yield* Projection
    const images = db.from("images")

    return (
      handlers
        .handle(
          "Image",
          projection.row(
            EventRow.handler(ImageRow, {
              set: (row) => images.upsert(new Image(row)).pipe(Effect.orDie),
              patch: Effect.fn(function* (id, fields) {
                const current = yield* images
                  .select()
                  .equals(id)
                  .first()
                  .pipe(Effect.catchNoSuchElement)
                // a patch never recreates a missing (e.g. removed) row
                if (Option.isNone(current)) return
                yield* images.upsert(new Image({ ...current.value, ...fields }))
              }, Effect.orDie),
              remove: (id) => images.delete().equals(id).pipe(Effect.orDie),
            }),
          ),
        )
        // legacy events, only replayed from remotes
        .handle("ImageCreate", projection.legacy)
        .handle("ImageDelete", projection.legacy)
    )
  }),
).pipe(Layer.provide([QueryBuilder.layer]))

const ImagesCompaction = EventRow.compaction(ImageEvents, ImageRow)

export const ImagesLive = Layer.mergeAll(ImagesHandlers, ImagesCompaction)
