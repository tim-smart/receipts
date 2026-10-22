import {
  BigDecimal,
  DateTime,
  Effect,
  FiberMap,
  Layer,
  Queue,
  Schedule,
} from "effect"
import { AiHelpers } from "./Ai"
import { ReceiptRepo } from "./Receipts/Repo"
import { ImagesRepo } from "./Images/Repo"
import { EventLogClient } from "@/EventLog"
import { changedFields, uuidString } from "./lib/utils"
import { Receipt } from "./Domain/Receipt"
import { ReceiptRow } from "./Receipts/Events"

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
      const extracted = {
        amount: BigDecimal.isZero(receipt.amount)
          ? metadata.amount
          : receipt.amount,
        currency: metadata.currency
          ? metadata.currency.toUpperCase()
          : receipt.currency,
        merchant:
          receipt.merchant.trim() === "" ? metadata.merchant : receipt.merchant,
        description:
          receipt.description.trim() === ""
            ? metadata.description
            : receipt.description,
        date: metadata.date ?? receipt.date,
      }
      // only patch what the extraction changed, so edits made meanwhile on
      // other devices are kept
      yield* client(
        ReceiptRow.patch(receipt.id, {
          ...changedFields(receipt, extracted),
          processed: true,
          updatedAt: yield* DateTime.now,
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
