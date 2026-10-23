import { Effect, Layer, Option } from "effect"
import { ImageEvents, ImageRow } from "./Images/Events"
import { EventLog, EventRow } from "effect/eventlog"
import { QueryBuilder } from "./IndexedDb"
import { Image } from "./Domain/Image"

const ImagesHandlers = EventLog.group(ImageEvents, (handlers) =>
  Effect.gen(function* () {
    const db = yield* QueryBuilder
    const images = db.from("images")
    return handlers.handle(
      "Image",
      EventRow.handler(ImageRow, {
        set: (row) => images.upsert(new Image(row)).pipe(Effect.orDie),
        // a patch never recreates a removed row
        patch: Effect.fn(function* (
          id: Image["id"],
          fields: Partial<typeof Image.select.Type>,
        ) {
          const current = yield* images
            .select()
            .equals(id)
            .first()
            .pipe(Effect.catchNoSuchElement)
          if (Option.isNone(current)) return
          yield* images.upsert(new Image({ ...current.value, ...fields }))
        }, Effect.orDie),
        remove: (id) => images.delete().equals(id).pipe(Effect.orDie),
      }),
    )
  }),
).pipe(Layer.provide(QueryBuilder.layer))

const ImagesCompaction = EventRow.compaction(ImageEvents, ImageRow)

export const ImagesLive = Layer.mergeAll(ImagesHandlers, ImagesCompaction)
