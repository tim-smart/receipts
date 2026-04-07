import { Effect, Layer } from "effect"
import { ImageEvents } from "./Images/Events"
import { EventLog } from "effect/unstable/eventlog"
import { QueryBuilder } from "./IndexedDb"
import { Image } from "./Domain/Image"

const ImagesHandlers = EventLog.group(ImageEvents, (handlers) =>
  Effect.gen(function* () {
    const db = yield* QueryBuilder
    const images = db.from("images")

    return handlers
      .handle("ImageCreate", ({ payload }) =>
        images.insert(payload).asEffect().pipe(Effect.orDie),
      )
      .handle("ImageDelete", ({ payload }) =>
        images.delete().equals(payload).asEffect().pipe(Effect.orDie),
      )
  }),
).pipe(Layer.provide([QueryBuilder.layer]))

const ImagesCompaction = EventLog.groupCompaction(
  ImageEvents,
  Effect.fn(function* ({ events, write }) {
    let create: typeof Image.insert.Type | undefined
    for (const event of events) {
      switch (event._tag) {
        case "ImageDelete": {
          return yield* write("ImageDelete", event.payload)
        }
        case "ImageCreate": {
          create = event.payload
          break
        }
      }
    }
    if (create) {
      yield* write("ImageCreate", create)
    }
  }),
)

export const ImagesLive = Layer.mergeAll(ImagesHandlers, ImagesCompaction)
