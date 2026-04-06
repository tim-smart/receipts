import { Setting } from "@/Domain/Setting"
import { Effect, Layer, Option, Schema, Stream } from "effect"
import { SettingRepo } from "./Repo"
import { eventLogAtom, EventLogClient } from "@/EventLog"
import { AsyncResult, Atom } from "effect/unstable/reactivity"

const runtime = Atom.runtime((get) =>
  SettingRepo.layer.pipe(
    Layer.merge(EventLogClient.layer),
    Layer.provide(get(eventLogAtom.layer)),
  ),
)

export const settingAtom = Atom.family(
  <Name extends string, S extends Schema.Top>(setting: Setting<Name, S>) =>
    runtime.atom(
      SettingRepo.useSync((_) => _.stream(setting)).pipe(Stream.unwrap),
    ),
)

export const settingOptionAtom = Atom.family(
  <Name extends string, S extends Schema.Top>(setting: Setting<Name, S>) =>
    Atom.map(settingAtom(setting), AsyncResult.getOrElse(Option.none)),
)

export const setSettingAtom = Atom.family(
  <Name extends string, S extends Schema.Top>(setting: Setting<Name, S>) =>
    runtime.fn(
      Effect.fnUntraced(function* (value: S["Type"]) {
        const client = yield* EventLogClient
        yield* client("SettingChange", {
          name: setting.name,
          json: setting.encodeSync(value),
        })
      }),
    ),
)
