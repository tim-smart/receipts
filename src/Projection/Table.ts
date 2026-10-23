import { IndexedDbTable } from "@effect/platform-browser"
import { Schema } from "effect"

// Local bookkeeping for the receipts, groups and images tables. Not synced.
export class ProjectionTable extends IndexedDbTable.make({
  name: "projection",
  schema: Schema.Struct({
    name: Schema.Literal("state"),
    // the tables must be rebuilt from the journal
    rebuildPending: Schema.Boolean,
    // id of the newest legacy entry in the journal, or ""
    legacyUntil: Schema.String,
  }),
  keyPath: "name",
}) {}
