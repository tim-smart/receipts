import { Receipt, ReceiptId } from "@/Domain/Receipt"
import { convert } from "@/Domain/Totals"
import { ReceiptGroupId } from "@/Domain/ReceiptGroup"
import { currentGroupId } from "@/Domain/Setting"
import { ImagesRepo } from "@/Images/Repo"
import { SettingRepo } from "@/Settings/Repo"
import { Zip } from "@/Zip"
import { BigDecimal, DateTime, Effect, Layer, Context } from "effect"
import FileSaver from "file-saver"
import * as Csv from "csv-stringify/browser/esm/sync"
import { QueryBuilder } from "@/IndexedDb"
import { Reactivity } from "effect/reactivity"
import { ReceiptRow } from "./Events"

export class ReceiptRepo extends Context.Service<ReceiptRepo>()("ReceiptRepo", {
  make: Effect.gen(function* () {
    const db = yield* QueryBuilder
    const imageRepo = yield* ImagesRepo
    const settings = yield* SettingRepo
    const reactivity = yield* Reactivity.Reactivity
    const zip = yield* Zip

    const receipts = db.from("receipts")

    const forGroup = (
      groupId: typeof ReceiptGroupId.Type,
      options?: {
        readonly sort?: "asc" | "desc"
      },
    ) => {
      const query = receipts
        .select("groupIdSort")
        .between([groupId], [groupId, [], []])
      return options?.sort === "asc" ? query : query.reverse()
    }

    const exportForGroup = Effect.fn(function* (options: {
      readonly groupId: typeof ReceiptGroupId.Type
      readonly rates?: Record<string, number>
      readonly currency?: string
    }) {
      const receipts = yield* forGroup(options.groupId, { sort: "asc" })
      const allImages = yield* Effect.forEach(
        receipts,
        (receipt) => imageRepo.forReceipt(receipt.id),
        { concurrency: 5 },
      )
      const { currency, rates } = options
      const convert = currency && rates
      const rows = [
        [
          "#",
          "Date",
          "Merchant",
          "Description",
          "Amount",
          "Currency",
          ...(convert ? [`Amount (${currency})`] : []),
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
          ...(convert ? [convertedString(receipt, currency, rates)] : []),
        ])
        for (let j = 0; j < allImages[i].length; j++) {
          const image = allImages[i][j]
          const id = String(i + 1).padStart(3, "0")
          images.push(
            new File(
              [image.data as Uint8Array<ArrayBuffer>],
              `images/${id}-${j}.${image.contentType.split("/")[1]}`,
              { type: image.contentType },
            ),
          )
        }
      }

      const csv = Csv.stringify(rows)
      const blob = yield* zip.make([
        new File([csv], "receipts.csv", { type: "text/csv" }),
        ...images,
      ])

      // @effect-diagnostics-next-line globalDateInEffect:off
      FileSaver.saveAs(blob, `receipts-${new Date().toISOString()}.zip`)
    })

    const current = reactivity.stream(
      ["receipts", "settings"] satisfies Reactivity.KeysInput,
      Effect.gen(function* () {
        const groupId = yield* settings.get(currentGroupId)
        if (groupId._tag === "None") return []
        return yield* forGroup(groupId.value)
      }),
    )

    const byId = (id: ReceiptId) =>
      reactivity.stream(
        {
          receipts: [ReceiptRow.keyOf({ id })],
          // Image events are keyed by image ID, so watch all image writes.
          images: [],
        } satisfies Reactivity.KeysInput,
        Effect.gen(function* () {
          const receipt = yield* receipts.select().equals(id).first()
          const images = yield* imageRepo.forReceipt(id)
          return { receipt, images } as const
        }),
      )

    const unprocessed = reactivity.query(
      ["receipts", "images"] satisfies Reactivity.KeysInput,
      receipts
        .select("processed")
        .equals(0)
        .pipe(Effect.tap(Effect.log), Effect.delay("1 second")),
    )

    return {
      forGroup,
      exportForGroup,
      byId,
      current,
      unprocessed,
    } as const
  }),
}) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide([
      QueryBuilder.layer,
      ImagesRepo.layer,
      Reactivity.layer,
      SettingRepo.layer,
      Zip.layer,
    ]),
  )
}

/**
 * The receipt's amount in `currency` to two decimal places, or an empty cell
 * when its currency has no rate.
 */
const convertedString = (
  receipt: Receipt,
  currency: string,
  rates: Record<string, number>,
) => {
  const converted = convert(receipt.amount, receipt.currency, currency, rates)
  if (converted === undefined) return ""
  return BigDecimal.fromNumberUnsafe(converted).pipe(
    BigDecimal.scale(2),
    BigDecimal.format,
  )
}
