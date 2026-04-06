import { Effect, Layer } from "effect"
import { ImageEvents } from "./Images/Events"
import { EventLog } from "effect/unstable/eventlog"
import { QueryBuilder } from "./IndexedDb"

export const ImagesLive = EventLog.group(ImageEvents, (handlers) =>
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
