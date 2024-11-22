import { Setting } from "@/Domain/Setting"
import { Result, Rx } from "@effect-rx/rx-react"
import { Effect, Layer, Option, Schema, Stream } from "effect"
import { SettingRepo } from "./Repo"
import { eventLogRx } from "@/EventLog"

const runtime = Rx.runtime((get) =>
  SettingRepo.Default.pipe(Layer.provide(get(eventLogRx.layer))),
)

export const settingRx = Rx.family(
  <Name extends string, S extends Schema.Schema.AnyNoContext>(
    setting: Setting<Name, S>,
  ) =>
    runtime
      .rx(
        Effect.gen(function* () {
          const settings = yield* SettingRepo
          return settings.stream(setting)
        }).pipe(Stream.unwrap),
      )
      .pipe(Rx.map(Result.getOrElse(() => Option.none<S["Type"]>()))),
)

export const setSettingRx = Rx.family(
  <Name extends string, S extends Schema.Schema.AnyNoContext>(
    setting: Setting<Name, S>,
  ) =>
    runtime.fn((value: S["Type"]) =>
      Effect.gen(function* () {
        const settings = yield* SettingRepo
        return yield* settings.set(setting, value)
      }),
    ),
)
