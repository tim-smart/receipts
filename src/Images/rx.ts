import { Rx } from "@effect-rx/rx-react"
import { ImagesRepo } from "./Repo"
import { eventLogRx } from "@/EventLog"
import { Effect, Layer } from "effect"
import { Image } from "@/Domain/Image"

const runtime = Rx.runtime((get) =>
  ImagesRepo.Default.pipe(Layer.provide(get(eventLogRx.layer))),
)

export const createImageRx = runtime.fn((image: typeof Image.insert.Type) =>
  Effect.gen(function* () {
    const repo = yield* ImagesRepo
    return yield* repo.create(image)
  }),
)
