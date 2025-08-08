import { Effect, Layer } from "effect"
import { Auth } from "./Auth"
import { EventLog } from "@effect/experimental"
import { SqlClient } from "@effect/sql"
import { SqlLive } from "./Sql"
import { Atom } from "@effect-atom/atom-react"
import { eventLogAtom } from "./EventLog"

export class Session extends Effect.Service<Session>()("Session", {
  accessors: true,
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const auth = yield* Auth
    const log = yield* EventLog.EventLog

    const destroy = Effect.gen(function* () {
      const tables = yield* sql<{
        name: string
      }>`SELECT name FROM sqlite_master WHERE type='table'`
      for (const table of tables) {
        yield* sql`DROP TABLE IF EXISTS ${sql(table.name)}`.withoutTransform.pipe(
          Effect.ignore,
        )
      }
      yield* log.destroy
      yield* auth.logout
    }).pipe(Effect.catchAllCause(Effect.log))

    return { destroy } as const
  }),
  dependencies: [SqlLive, Auth.Default],
}) {}

const runtime = Atom.runtime((get) =>
  Session.Default.pipe(Layer.provide(get(eventLogAtom.layer))),
)

export const sessionDestroyAtom = runtime.fn(() => Session.destroy)
