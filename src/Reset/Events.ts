import { Schema } from "effect"
import { EventGroup } from "effect/eventlog"

export const ResetEvents = EventGroup.empty.add({
  tag: "DataReset",
  primaryKey: () => "all",
  payload: Schema.Struct({}),
})
