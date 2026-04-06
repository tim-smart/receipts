import { Setting } from "@/Domain/Setting"
import { QueryBuilder } from "@/IndexedDb"
import { Effect, Layer, Option, Schema, ServiceMap, Stream } from "effect"
import { Reactivity } from "effect/unstable/reactivity"

export class SettingRepo extends ServiceMap.Service<SettingRepo>()(
  "SettingRepo",
  {
    make: Effect.gen(function* () {
      const idb = yield* QueryBuilder
      const reactivity = yield* Reactivity.Reactivity
      const settings = idb.from("settings")

      const get = <Name extends string, S extends Schema.Top>(
        setting: Setting<Name, S>,
      ) =>
        settings
          .select()
          .equals(setting.name)
          .first()
          .asEffect()
          .pipe(
            Effect.flatMap((_) => setting.decode(_.json)),
            Effect.option,
          )

      const stream = <Name extends string, S extends Schema.Top>(
        setting: Setting<Name, S>,
      ): Stream.Stream<Option.Option<S["Type"]>> =>
        reactivity.stream(["settings"], get(setting))

      return { get, stream } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide([Reactivity.layer, QueryBuilder.layer]),
  )
}
