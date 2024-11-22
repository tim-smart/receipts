import { Receipt, ReceiptId } from "@/Domain/Receipt"
import { ReceiptGroupId } from "@/Domain/ReceiptGroup"
import { currentGroupId } from "@/Domain/Setting"
import { EventLogClient } from "@/EventLog"
import { ImagesRepo } from "@/Images/Repo"
import { SettingRepo } from "@/Settings/Repo"
import { SqlLive } from "@/Sql"
import { Reactivity } from "@effect/experimental"
import { Model, SqlClient } from "@effect/sql"
import { Effect, Schema } from "effect"

export class ReceiptRepo extends Effect.Service<ReceiptRepo>()("ReceiptRepo", {
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const reactivity = yield* Reactivity.Reactivity
    const imageRepo = yield* ImagesRepo
    const settings = yield* SettingRepo
    const repo = yield* Model.makeRepository(Receipt, {
      tableName: "receipts",
      idColumn: "id",
      spanPrefix: "ReceiptRepo",
    })
    const client = yield* EventLogClient

    const forGroup = (groupId: typeof ReceiptGroupId.Type) =>
      sql`select * from receipts where group_id = ${groupId} order by date desc, merchant asc, description asc`.pipe(
        Effect.flatMap(Schema.decodeUnknown(Receipt.Array)),
      )

    const current = reactivity.stream(
      ["receipts", "settings"],
      Effect.gen(function* () {
        const groupId = yield* settings.get(currentGroupId)
        if (groupId._tag === "None") return []
        return yield* forGroup(groupId.value)
      }),
    )

    const byId = (id: typeof ReceiptId.Type) =>
      reactivity.stream(
        ["receipts", "images"],
        Effect.gen(function* () {
          const receipt = yield* repo.findById(id).pipe(Effect.flatten)
          const images = yield* imageRepo.forReceipt(id)
          return { receipt, images } as const
        }),
      )

    const create = (receipt: typeof Receipt.insert.Type) =>
      client("ReceiptCreate", receipt)
    const update = (receipt: typeof Receipt.update.Type) =>
      client("ReceiptUpdate", receipt)
    const remove = (id: typeof ReceiptId.Type) => client("ReceiptDelete", id)

    const unprocessed = reactivity.query(
      ["receipts", "images"],
      sql`select * from receipts where processed = 0`.pipe(
        Effect.flatMap(Schema.decodeUnknown(Receipt.Array)),
        Effect.delay("1 second"),
      ),
    )

    return {
      forGroup,
      byId,
      current,
      unprocessed,
      remove,
      create,
      update,
    } as const
  }),
  dependencies: [
    SqlLive,
    ImagesRepo.Default,
    Reactivity.layer,
    SettingRepo.Default,
    EventLogClient.Default,
  ],
}) {}
