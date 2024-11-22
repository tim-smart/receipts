import * as SqliteClient from "@effect/sql-sqlite-wasm/SqliteClient"
import * as SqliteMigrator from "@effect/sql-sqlite-wasm/SqliteMigrator"
import { Effect, Layer, String } from "effect"
import SqlWorker from "./Sql/worker?worker"

const ClientLive = SqliteClient.layer({
  worker: Effect.acquireRelease(
    Effect.sync(() => new SqlWorker()),
    (worker) => Effect.sync(() => worker.terminate()),
  ),
  installReactivityHooks: true,
  transformQueryNames: String.camelToSnake,
  transformResultNames: String.snakeToCamel,
})

export const SqlLive = SqliteMigrator.layer({
  loader: SqliteMigrator.fromGlob(import.meta.glob("./Sql/migrations/*")),
}).pipe(Layer.provideMerge(ClientLive))
