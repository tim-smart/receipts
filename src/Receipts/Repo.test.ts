import { afterEach, beforeEach, expect, it, vi } from "@effect/vitest"
import {
  BigDecimal,
  DateTime,
  Effect,
  Layer,
  Queue,
  Redacted,
  Stream,
} from "effect"
import { EventJournal, EventLog } from "effect/eventlog"
import { IDBFactory, IDBKeyRange } from "fake-indexeddb"
import { Receipt, ReceiptId } from "@/Domain/Receipt"
import { ReceiptGroupId } from "@/Domain/ReceiptGroup"
import { EventLogClient } from "@/EventLog"
import { layerEventLog } from "@/EventLogLayer"
import { uuidBytes } from "@/lib/utils"
import { ReceiptRow } from "./Events"
import { ReceiptRepo } from "./Repo"

const Device = ReceiptRepo.layer.pipe(
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

it.live("updates the receipt detail stream after saving an edit", () =>
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
  }).pipe(Effect.scoped, Effect.provide(Device)),
)
