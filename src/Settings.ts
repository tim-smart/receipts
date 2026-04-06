import { Effect, Layer, Option } from "effect"
import { SettingEvents } from "./Settings/Events"
import * as Arr from "effect/Array"
import { EventLog } from "effect/unstable/eventlog"
import { QueryBuilder } from "./IndexedDb"

export const SettingsLive = EventLog.group(
  SettingEvents,
  Effect.fn(function* (handlers) {
    const db = yield* QueryBuilder
    const settings = db.from("settings")

    return handlers.handle(
      "SettingChange",
      Effect.fn(function* ({ payload, conflicts }) {
        if (conflicts.length > 0) return
        yield* settings.upsert({
          name: payload.name,
          json: payload.json,
        })
      }, Effect.orDie),
    )
  }),
).pipe(Layer.provide(QueryBuilder.layer))

export const SettingsCompactionLive = EventLog.groupCompaction(
  SettingEvents,
  ({ events, write }) =>
    Effect.gen(function* () {
      const last = Arr.last(events)
      if (Option.isNone(last)) return
      yield* write("SettingChange", last.value.payload)
    }),
)

export const SettingsReactivityLive = EventLog.groupReactivity(SettingEvents, [
  "settings",
])

export const SettingsLayer = Layer.mergeAll(
  SettingsLive,
  SettingsCompactionLive,
  SettingsReactivityLive,
)
