import { EventGroup } from "@effect/experimental"
import { Schema } from "effect"

export class SettingEvents extends EventGroup.empty.add({
  tag: "SettingChange",
  primaryKey: (_) => _.name,
  payload: Schema.Struct({
    name: Schema.String,
    json: Schema.String,
  }),
}) {}
