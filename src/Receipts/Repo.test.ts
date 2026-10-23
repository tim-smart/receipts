import { afterEach, beforeEach, expect, it, vi } from "@effect/vitest"
import {
  BigDecimal,
  DateTime,
  Effect,
  Layer,
  Option,
  Queue,
  Redacted,
  Stream,
} from "effect"
import { EventJournal, EventLog } from "effect/eventlog"
import { IDBFactory, IDBKeyRange } from "fake-indexeddb"
import { Receipt, ReceiptId } from "@/Domain/Receipt"
import { ReceiptGroupId } from "@/Domain/ReceiptGroup"
import { Image } from "@/Domain/Image"
import { openaiModel } from "@/Domain/Setting"
import { SettingRepo } from "@/Settings/Repo"
import { ImageRow } from "@/Images/Events"
import { EventLogClient } from "@/EventLog"
import { layerEventLog } from "@/EventLogLayer"
import { uuidBytes } from "@/lib/utils"
import { ReceiptRow } from "./Events"
import { ReceiptRepo } from "./Repo"

const Device = Layer.merge(ReceiptRepo.layer, SettingRepo.layer).pipe(
  Layer.provideMerge(EventLogClient.layer),
  Layer.provide(layerEventLog(EventJournal.layerMemory)),
  Layer.provide(
    Layer.succeed(EventLog.Identity, {
      publicKey: "test",
      privateKey: Redacted.make(new Uint8Array(32)),
    }),
  ),
)

beforeEach(() => {
  vi.stubGlobal("window", { indexedDB: new IDBFactory(), IDBKeyRange })
})
afterEach(() => vi.unstubAllGlobals())

it.live("updates a setting stream after saving a setting", () =>
  Effect.gen(function* () {
    const write = yield* EventLogClient
    const repo = yield* SettingRepo
    const changes = yield* Stream.toQueue(repo.stream(openaiModel), {
      capacity: 8,
    })
    expect(yield* Queue.take(changes)).toEqual(Option.some("gpt-5.4"))

    yield* write({
      event: "SettingChange",
      payload: { name: openaiModel.name, json: "updated-model" },
    })

    expect(yield* Queue.take(changes).pipe(Effect.timeout("1 second"))).toEqual(
      Option.some("updated-model"),
    )
  }).pipe(Effect.scoped, Effect.provide(Device)),
)

it.live("updates the receipt detail stream after receipt and image edits", () =>
  Effect.gen(function* () {
    const write = yield* EventLogClient
    const repo = yield* ReceiptRepo
    const receipt = Receipt.insert.make({
      id: ReceiptId.make(uuidBytes("2d8e3f40-5162-4c73-ad84-9ea5fb6c0718")),
      groupId: ReceiptGroupId.make(
        uuidBytes("0b6c1d2e-3f40-4a51-8b62-7c83d94ea5f6"),
      ),
      date: DateTime.makeUnsafe("2026-10-23T00:00:00.000Z"),
      description: "Groceries",
      merchant: "Original merchant",
      amount: BigDecimal.fromStringUnsafe("12.34"),
      currency: "NZD",
      processed: true,
    })
    yield* write(ReceiptRow.set(receipt))
    const changes = yield* Stream.toQueue(repo.byId(receipt.id), {
      capacity: 8,
    })
    expect((yield* Queue.take(changes)).receipt.merchant).toBe(
      "Original merchant",
    )

    yield* write(
      ReceiptRow.patch(receipt.id, {
        merchant: "Edited merchant",
        amount: BigDecimal.fromStringUnsafe("56.78"),
      }),
    )

    const updated = yield* Queue.take(changes).pipe(Effect.timeout("1 second"))
    expect(updated.receipt.merchant).toBe("Edited merchant")
    expect(BigDecimal.format(updated.receipt.amount)).toBe("56.78")
    expect(updated.receipt.description).toBe("Groceries")
    expect(updated.images).toEqual([])

    const image = Image.insert.make({
      receiptId: receipt.id,
      contentType: "image/png",
      data: new Uint8Array([1, 2, 3]),
    })
    yield* write(ImageRow.set(image))
    const withImage = yield* Queue.take(changes).pipe(
      Effect.timeout("1 second"),
    )
    expect(withImage.images.map((image) => image.contentType)).toEqual([
      "image/png",
    ])

    yield* write(ImageRow.remove(image.id))
    const withoutImage = yield* Queue.take(changes).pipe(
      Effect.timeout("1 second"),
    )
    expect(withoutImage.images).toEqual([])
  }).pipe(Effect.scoped, Effect.provide(Device)),
)
