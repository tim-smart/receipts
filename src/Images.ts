import { EventLog, Reactivity } from "@effect/experimental"
import { Model } from "@effect/sql"
import { Effect, Layer, pipe } from "effect"
import { SqlLive } from "./Sql"
import { Image } from "./Domain/Image"
import { ImageEvents } from "./Images/Events"
import { uuidString } from "./lib/utils"

export const ImagesLive = EventLog.group(ImageEvents, (handlers) =>
  Effect.gen(function* () {
    const repo = yield* Model.makeRepository(Image, {
      tableName: "images",
      idColumn: "id",
      spanPrefix: "Images",
    })
    const reactivity = yield* Reactivity.Reactivity

    return handlers
      .handle("ImageCreate", ({ payload }) =>
        pipe(
          repo.insert(payload),
          Effect.zipLeft(
            reactivity.invalidate({
              receipts: [uuidString(payload.receiptId)],
            }),
          ),
        ),
      )
      .handle("ImageDelete", ({ payload }) =>
        pipe(
          repo.delete(payload),
          Effect.zipLeft(reactivity.invalidate(["receipts"])),
        ),
      )
  }),
).pipe(Layer.provide([SqlLive, Reactivity.layer]))
