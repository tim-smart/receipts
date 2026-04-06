import { Schema } from "effect"
import { EventGroup } from "effect/unstable/eventlog"

export const SettingEvents = EventGroup.empty.add({
  tag: "SettingChange",
  primaryKey: (_) => _.name,
  payload: Schema.Struct({
    name: Schema.String,
    json: Schema.Json,
  }),
})
