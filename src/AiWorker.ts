import { BigDecimal, Effect, FiberMap, Layer, Schedule } from "effect"
import { AiHelpers } from "./Ai"
import { ReceiptRepo } from "./Receipts/Repo"
import { ImagesRepo } from "./Images/Repo"
import { EventLogClient } from "./EventLog"
import { uuidString } from "./lib/utils"
import { Receipt } from "./Domain/Receipt"

export const AiWorkerLive = Effect.gen(function* () {
  const ai = yield* AiHelpers
  const receiptRepo = yield* ReceiptRepo
  const imageRepo = yield* ImagesRepo
  const client = yield* EventLogClient
  const fibers = yield* FiberMap.make<string>()

  yield* Effect.log("starting worker")

  const mailbox = yield* receiptRepo.unprocessed
  yield* mailbox.take.pipe(
    Effect.tap((receipts) =>
      Effect.gen(function* () {
        for (const receipt of receipts) {
          const idString = uuidString(receipt.id)
          if (FiberMap.unsafeHas(fibers, idString)) continue
          yield* FiberMap.run(fibers, idString, process(receipt))
        }
      }),
    ),
    Effect.forever,
    Effect.forkScoped,
    Effect.uninterruptible,
  )

  const process = (receipt: Receipt) =>
    Effect.gen(function* () {
      const images = yield* imageRepo.forReceipt(receipt.id)
      if (images.length === 0) return
      const image = images[0]
      const blob = new Blob([image.data], { type: image.contentType })
      const metadata = yield* ai.extractReceipt(blob)
      const update = {
        ...receipt,
        processed: true,
      }
      if (BigDecimal.isZero(update.amount)) {
        update.amount = metadata.amount
      }
      if (metadata.currency) {
        update.currency = metadata.currency.toUpperCase()
      }
      if (update.merchant.trim() === "") {
        update.merchant = metadata.merchant
      }
      if (update.description.trim() === "") {
        update.description = metadata.description
      }
      if (metadata.date) {
        update.date = metadata.date
      }
      yield* client("ReceiptUpdate", {
        ...update,
        updatedAt: undefined,
      })
    }).pipe(
      Effect.retry({ times: 2, schedule: Schedule.spaced(1000) }),
      Effect.tap(Effect.log("processed")),
      Effect.catchAllCause(Effect.log),
      Effect.annotateLogs("receiptId", uuidString(receipt.id)),
    )
}).pipe(
  Layer.scopedDiscard,
  Layer.provide([
    AiHelpers.Default,
    ReceiptRepo.Default,
    EventLogClient.Default,
    ImagesRepo.Default,
  ]),
)
