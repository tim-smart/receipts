import { Setting } from "@/Domain/Setting"
import { Result, Atom } from "@effect-atom/atom-react"
import { Effect, Layer, Option, Schema, Stream } from "effect"
import { SettingRepo } from "./Repo"
import { eventLogAtom } from "@/EventLog"

const runtime = Atom.runtime((get) =>
  SettingRepo.Default.pipe(Layer.provide(get(eventLogAtom.layer))),
)

export const settingAtom = Atom.family(
  <Name extends string, S extends Schema.Schema.AnyNoContext>(
    setting: Setting<Name, S>,
  ) =>
    runtime
      .atom(
        Effect.gen(function* () {
          const settings = yield* SettingRepo
          return settings.stream(setting)
        }).pipe(Stream.unwrap),
      )
      .pipe(Atom.map(Result.getOrElse(() => Option.none<S["Type"]>()))),
)

export const setSettingAtom = Atom.family(
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
