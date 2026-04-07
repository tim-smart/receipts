import { BigDecimal, Effect, FiberMap, Layer, Queue, Schedule } from "effect"
import { AiHelpers } from "./Ai"
import { ReceiptRepo } from "./Receipts/Repo"
import { ImagesRepo } from "./Images/Repo"
import { EventLogClient } from "@/EventLog"
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
  yield* Queue.take(mailbox).pipe(
    Effect.tap(
      Effect.fnUntraced(function* (receipts) {
        const ids = new Set<string>()
        for (const receipt of receipts) {
          const idString = uuidString(receipt.id)
          ids.add(idString)
          yield* FiberMap.run(fibers, idString, process(receipt), {
            onlyIfMissing: true,
          })
        }
        for (const [id] of fibers) {
          if (ids.has(id)) continue
          yield* FiberMap.remove(fibers, id)
        }
      }),
    ),
    Effect.forever,
    Effect.forkScoped,
    Effect.uninterruptible,
  )

  const process = Effect.fn(
    function* (receipt: Receipt) {
      const images = yield* imageRepo.forReceipt(receipt.id)
      if (images.length === 0) return
      const image = images[0]
      const blob = new Blob([image.data as Uint8Array<ArrayBuffer>], {
        type: image.contentType,
      })
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
      yield* client(
        "ReceiptUpdate",
        Receipt.update.make({
          ...update,
          updatedAt: undefined,
        }),
      )
    },
    Effect.tapCause(Effect.log),
    Effect.retry({ times: 2, schedule: Schedule.spaced(1000) }),
    Effect.tap(Effect.log("processed")),
    (effect, receipt) =>
      Effect.annotateLogs(effect, "receiptId", uuidString(receipt.id)),
  )
}).pipe(
  Layer.effectDiscard,
  Layer.provide([
    AiHelpers.layer,
    ReceiptRepo.layer,
    EventLogClient.layer,
    ImagesRepo.layer,
  ]),
)
