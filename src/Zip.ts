import { Effect } from "effect"
import { downloadZip } from "client-zip"

export class Zip extends Effect.Service<Zip>()("Zip", {
  effect: Effect.gen(function* () {
    const make = (files: Iterable<File>) =>
      Effect.promise(() => downloadZip(files).blob())

    return { make } as const
  }),
}) {}
