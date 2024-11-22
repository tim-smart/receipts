import { Receipt, ReceiptId } from "@/Domain/Receipt"
import { ReceiptGroupId } from "@/Domain/ReceiptGroup"
import { currentGroupId } from "@/Domain/Setting"
import { EventLogClient } from "@/EventLog"
import { ImagesRepo } from "@/Images/Repo"
import { SettingRepo } from "@/Settings/Repo"
import { SqlLive } from "@/Sql"
import { Zip } from "@/Zip"
import { Reactivity } from "@effect/experimental"
import { Model, SqlClient } from "@effect/sql"
import { BigDecimal, DateTime, Effect, Schema } from "effect"
import FileSaver from "file-saver"

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
    const zip = yield* Zip

    const forGroup = (groupId: typeof ReceiptGroupId.Type) =>
      sql`select * from receipts where group_id = ${groupId} order by date desc, merchant asc, description asc`.pipe(
        Effect.flatMap(Schema.decodeUnknown(Receipt.Array)),
      )

    const exportForGroup = (options: {
      readonly groupId: typeof ReceiptGroupId.Type
      readonly rates?: Record<string, number>
      readonly currency?: string
    }) =>
      Effect.gen(function* () {
        const receipts = yield* forGroup(options.groupId)
        const allImages = yield* Effect.forEach(
          receipts,
          (receipt) => imageRepo.forReceipt(receipt.id),
          { concurrency: 5 },
        )
        const convert = options.currency && options.rates
        const rows = [
          [
            "#",
            "Date",
            "Merchant",
            "Description",
            "Amount",
            "Currency",
            ...(convert ? [`Amount (${options.currency})`] : []),
          ],
        ]
        const images: Array<File> = []

        for (let i = 0; i < receipts.length; i++) {
          const receipt = receipts[i]
          rows.push([
            String(i + 1),
            DateTime.formatIsoDate(receipt.date),
            receipt.merchant,
            receipt.description,
            BigDecimal.format(receipt.amount),
            receipt.currency,
            ...(convert
              ? [convertString(receipt.amount, options.rates[receipt.currency])]
              : []),
          ])
          for (let j = 0; j < allImages[i].length; j++) {
            const image = allImages[i][j]
            images.push(
              new File(
                [image.data],
                `images/${i + 1}-${j}.${image.contentType.split("/")[1]}`,
                { type: image.contentType },
              ),
            )
          }
        }

        const csv = rows.map((row) => row.join(",")).join("\n") + "\n"
        const blob = yield* zip.make([
          new File([csv], "receipts.csv", { type: "text/csv" }),
          ...images,
        ])

        FileSaver.saveAs(blob, `receipts-${new Date().toISOString()}.zip`)
      })

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
      exportForGroup,
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
    Zip.Default,
  ],
}) {}

const convertString = (amount: BigDecimal.BigDecimal, rate: number) => {
  const rateNumber = 1 / rate
  return BigDecimal.multiply(amount, BigDecimal.fromNumber(rateNumber)).pipe(
    BigDecimal.scale(2),
    BigDecimal.format,
  )
}
