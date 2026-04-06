import { Effect, Layer, ServiceMap } from "effect"
import { downloadZip } from "client-zip"

export class Zip extends ServiceMap.Service<Zip>()("Zip", {
  make: Effect.gen(function* () {
    const make = (files: Iterable<File>) =>
      Effect.promise(() => downloadZip(files).blob())

    return { make } as const
  }),
}) {
  static readonly layer = Layer.effect(this, this.make)
}
