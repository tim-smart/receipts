import { IndexedDbTable } from "@effect/platform-browser"
import { Schema } from "effect"

export class SettingsTable extends IndexedDbTable.make({
  name: "settings",
  schema: Schema.Struct({
    name: Schema.String,
    json: Schema.Json,
  }),
  keyPath: "name",
}) {}
