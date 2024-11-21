import { EventLog } from "@effect/experimental"
import { Model } from "@effect/sql"
import { Effect, Layer } from "effect"
import { SqlLive } from "./Sql"
import { Image } from "./Domain/Image"
import { ImageEvents } from "./Images/Events"

export const ImagesLive = EventLog.group(ImageEvents, (handlers) =>
  Effect.gen(function* () {
    const repo = yield* Model.makeRepository(Image, {
      tableName: "images",
      idColumn: "id",
      spanPrefix: "Images",
    })

    return handlers
      .handle("ImageCreate", ({ payload }) => repo.insert(payload))
      .handle("ImageDelete", ({ payload }) => repo.delete(payload))
  }),
).pipe(Layer.provide(SqlLive))
