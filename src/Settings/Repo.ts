import { Setting } from "@/Domain/Setting"
import { ReceiptAppEvents } from "@/Events"
import { SqlLive } from "@/Sql"
import { EventLog, Reactivity } from "@effect/experimental"
import { SqlClient } from "@effect/sql"
import { Array, Effect, Option, Schema, Stream } from "effect"

export class SettingRepo extends Effect.Service<SettingRepo>()("SettingRepo", {
  effect: Effect.gen(function* () {
    const client = yield* EventLog.makeClient(ReceiptAppEvents)
    const reactivity = yield* Reactivity.Reactivity
    const sql = yield* SqlClient.SqlClient

    const set = <Name extends string, S extends Schema.Schema.AnyNoContext>(
      setting: Setting<Name, S>,
      value: S["Type"],
    ) =>
      client("SettingChange", {
        name: setting.name,
        json: setting.encodeSync(value),
      })

    const get = <Name extends string, S extends Schema.Schema.AnyNoContext>(
      setting: Setting<Name, S>,
    ) =>
      sql<{
        json: string
      }>`SELECT json FROM settings WHERE name = ${setting.name}`.pipe(
        Effect.flatMap(Array.head),
        Effect.flatMap((_) => setting.decode(_.json)),
        Effect.option,
      )

    const stream = <Name extends string, S extends Schema.Schema.AnyNoContext>(
      setting: Setting<Name, S>,
    ): Stream.Stream<Option.Option<S["Type"]>> =>
      reactivity.stream(["settings"], get(setting))

    return { set, get, stream } as const
  }),
  dependencies: [Reactivity.layer, SqlLive],
}) {}
