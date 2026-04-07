import { Schema } from "effect"
import { Model } from "effect/unstable/schema"

export const DateTimeInsert = Model.Field({
  select: Schema.DateTimeUtcFromString,
  insert: Model.DateTimeWithNow,
  update: Schema.DateTimeUtcFromString,
  json: Schema.DateTimeUtcFromString,
})
