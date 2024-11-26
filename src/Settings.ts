import { EventLog } from "@effect/experimental"
import { Effect, Layer, Option } from "effect"
import { SqlClient } from "@effect/sql"
import { SqlLive } from "./Sql"
import { SettingEvents } from "./Settings/Events"
import * as Arr from "effect/Array"

export const SettingsLive = EventLog.group(SettingEvents, (handlers) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    return handlers.handle("SettingChange", ({ payload, conflicts }) =>
      Effect.gen(function* () {
        if (conflicts.length > 0) return
        yield* sql`INSERT INTO settings ${sql.insert(payload)} ON CONFLICT (name) DO UPDATE SET json = ${payload.json}`
      }).pipe(Effect.orDie),
    )
  }),
).pipe(Layer.provide(SqlLive))

export const SettingsCompactionLive = EventLog.groupCompaction(
  SettingEvents,
  ({ events, write }) =>
    Effect.gen(function* () {
      const last = Arr.last(events)
      if (Option.isNone(last)) return
      yield* write("SettingChange", last.value.payload)
    }),
)
