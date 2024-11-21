/// <reference lib="webworker" />
import { OpfsWorker } from "@effect/sql-sqlite-wasm"
import { Effect } from "effect"

OpfsWorker.run({
  port: self,
  dbName: "sync.sqlite",
}).pipe(Effect.catchAllCause(Effect.log), Effect.runFork)
