import { IndexedDbTable } from "@effect/platform-browser"
import { Schema } from "effect"

// Local bookkeeping for data resets. Not synced.
export class ResetTable extends IndexedDbTable.make({
  name: "reset",
  schema: Schema.Struct({
    name: Schema.Literal("state"),
    // id of the newest reset applied on this device, or ""
    appliedId: Schema.String,
    // look for a reset that a version without the reset handler stored but
    // skipped
    scanJournal: Schema.Boolean,
  }),
  keyPath: "name",
}) {}
