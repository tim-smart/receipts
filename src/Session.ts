import { Effect, Layer } from "effect"
import { Auth } from "./Auth"
import { EventLog } from "@effect/experimental"
import { SqlClient } from "@effect/sql"
import { SqlLive } from "./Sql"
import { Rx } from "@effect-rx/rx-react"
import { eventLogRx } from "./EventLog"

export class Session extends Effect.Service<Session>()("Session", {
  accessors: true,
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const auth = yield* Auth
    const log = yield* EventLog.EventLog

    const destroy = Effect.gen(function* () {
      yield* sql`DROP TABLE IF EXISTS effect_sql_migrations`
      yield* sql`DROP TABLE IF EXISTS receipts`
      yield* sql`DROP TABLE IF EXISTS receipt_groups`
      yield* sql`DROP TABLE IF EXISTS images`
      yield* sql`DROP TABLE IF EXISTS settings`

      yield* log.destroy
      yield* auth.logout
    }).pipe(Effect.catchAllCause(Effect.log))

    return { destroy } as const
  }),
  dependencies: [SqlLive, Auth.Default],
}) {}

const runtime = Rx.runtime((get) =>
  Session.Default.pipe(Layer.provide(get(eventLogRx.layer))),
)

export const sessionDestroyRx = runtime.fn(() => Session.destroy)
