import { Atom } from "@effect-atom/atom-react"
import { ImagesRepo } from "./Repo"
import { eventLogAtom } from "@/EventLog"
import { Effect, Layer } from "effect"
import { Image } from "@/Domain/Image"

const runtime = Atom.runtime((get) =>
  ImagesRepo.Default.pipe(Layer.provide(get(eventLogAtom.layer))),
)

export const createImageAtom = runtime.fn((image: typeof Image.insert.Type) =>
  Effect.gen(function* () {
    const repo = yield* ImagesRepo
    return yield* repo.create(image)
  }),
)
