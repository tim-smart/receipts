import { Effect, Layer, ServiceMap } from "effect"
import { Auth } from "./Auth"
import { eventLogAtom } from "./EventLog"
import { QueryBuilder } from "./IndexedDb"
import { EventLog } from "effect/unstable/eventlog"
import { Atom } from "effect/unstable/reactivity"

export class Session extends ServiceMap.Service<Session>()("Session", {
  make: Effect.gen(function* () {
    const db = yield* QueryBuilder

    const auth = yield* Auth
    const log = yield* EventLog.EventLog

    const destroy = Effect.gen(function* () {
      yield* db.clearAll
      yield* log.destroy
      yield* auth.logout
    }).pipe(Effect.catchCause(Effect.log))

    return { destroy } as const
  }),
}) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide([QueryBuilder.layer, Auth.layer]),
  )
}

const runtime = Atom.runtime((get) =>
  Session.layer.pipe(Layer.provide(get(eventLogAtom.layer))),
)

export const sessionDestroyAtom = runtime.fn(() =>
  Session.use((_) => _.destroy),
)
