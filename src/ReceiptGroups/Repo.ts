import { ReceiptGroup, ReceiptGroupId } from "@/Domain/ReceiptGroup"
import { currentGroupId } from "@/Domain/Setting"
import { EventLogClient } from "@/EventLog"
import { SettingRepo } from "@/Settings/Repo"
import { SqlLive } from "@/Sql"
import { Reactivity } from "@effect/experimental"
import { Model, SqlClient } from "@effect/sql"
import { Array, Effect, Option, Schema } from "effect"

export class ReceiptGroupRepo extends Effect.Service<ReceiptGroupRepo>()(
  "ReceiptGroups/ReceiptGroupRepo",
  {
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const reactivity = yield* Reactivity.Reactivity
      const client = yield* EventLogClient
      const settings = yield* SettingRepo
      const repo = yield* Model.makeRepository(ReceiptGroup, {
        tableName: "receipt_groups",
        idColumn: "id",
        spanPrefix: "ReceiptGroupRepo",
      })

      const all = sql`select * from receipt_groups order by name asc`.pipe(
        Effect.flatMap(Schema.decodeUnknown(ReceiptGroup.Array)),
      )

      const stream = reactivity.stream(["receipt_groups"], all)

      const current = reactivity.stream(
        ["receipt_groups", "settings"],
        Effect.gen(function* () {
          const groupId = yield* settings.get(currentGroupId)
          return yield* Option.match(groupId, {
            onNone: () => all.pipe(Effect.map(Array.head)),
            onSome: (id) => repo.findById(id),
          })
        }),
      )

      const create = (payload: typeof ReceiptGroup.insert.Type) =>
        client("GroupCreate", payload)

      const update = (payload: typeof ReceiptGroup.update.Type) =>
        client("GroupUpdate", payload)

      const remove = (id: typeof ReceiptGroupId.Type) =>
        client("GroupDelete", id)

      return { stream, create, update, remove, current } as const
    }),
    dependencies: [
      SqlLive,
      Reactivity.layer,
      EventLogClient.Default,
      SettingRepo.Default,
    ],
  },
) {}
