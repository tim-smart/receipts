import { afterEach, beforeEach, describe, expect, it, vi } from "@effect/vitest"
import { BigDecimal, DateTime, Effect, Layer, Redacted, Schema } from "effect"
import { EventJournal, EventLog, EventLogMessage } from "effect/eventlog"
import { Model } from "effect/schema"
import { Reactivity } from "effect/reactivity"
import { IDBFactory, IDBKeyRange } from "fake-indexeddb"
import { Image, ImageId } from "./Domain/Image"
import { Receipt, ReceiptId } from "./Domain/Receipt"
import { ReceiptGroup, ReceiptGroupId } from "./Domain/ReceiptGroup"
import { ReceiptAppEvents } from "./Events"
import { ImagesLive } from "./Images"
import { QueryBuilder } from "./IndexedDb"
import { ReceiptGroupsLayer } from "./ReceiptGroups"
import { ReceiptsLayer } from "./Receipts"
import { ReceiptRow } from "./Receipts/Events"
import { SettingsLayer } from "./Settings"
import { uuidBytes, uuidString } from "./lib/utils"

// The app's EventLog over a fresh in-memory journal and IndexedDB.
const identity = {
  publicKey: "test",
  privateKey: Redacted.make(new Uint8Array(32)),
}
const TestLayer = Layer.mergeAll(
  EventLog.layer(
    ReceiptAppEvents,
    Layer.mergeAll(
      ReceiptGroupsLayer,
      ReceiptsLayer,
      SettingsLayer,
      ImagesLive,
    ),
  ),
  QueryBuilder.layer,
  Reactivity.layer,
).pipe(
  Layer.provideMerge(EventJournal.layerMemory),
  Layer.provide(Layer.succeed(EventLog.Identity, identity)),
)

beforeEach(() => {
  vi.stubGlobal("window", { indexedDB: new IDBFactory(), IDBKeyRange })
})
afterEach(() => {
  vi.unstubAllGlobals()
})

type Write = { readonly event: string; readonly payload: unknown }

const write = (
  event: Write,
): Effect.Effect<unknown, unknown, EventLog.EventLog> =>
  EventLog.EventLog.use((log) =>
    log.write({ schema: ReceiptAppEvents, ...event } as any),
  )

const remoteId = EventJournal.makeRemoteIdUnsafe()
let remoteSequence = 0

// Delivers events written on another device `ageMillis` ago, the way the
// EventLog replays a batch from a remote.
const receiveFromRemote = Effect.fnUntraced(function* (
  events: ReadonlyArray<readonly [Write, ageMillis: number]>,
) {
  const journal = yield* EventJournal.EventJournal
  const registry = yield* EventLog.Registry
  const replay = EventLog.makeReplayFromRemote({
    handlers: registry.handlers,
    storeId: EventLogMessage.StoreId.make("default"),
    identity,
    reactivity: yield* Reactivity.Reactivity,
    reactivityKeys: registry.reactivityKeys,
    logAnnotations: { service: "test", effect: "receiveFromRemote" },
  })
  const now = Date.now()
  const entries = events.map(([{ event, payload }, ageMillis]) => {
    const schema = registry.handlers.get(event)!.event
    return new EventJournal.RemoteEntry({
      remoteSequence: remoteSequence++,
      entry: new EventJournal.Entry({
        id: EventJournal.makeEntryIdUnsafe({ msecs: now - ageMillis }),
        event,
        primaryKey: schema.primaryKey(payload as never),
        payload: Schema.encodeUnknownSync(
          schema.payloadSchemaBinary as Schema.Codec<unknown, Uint8Array>,
        )(payload),
      }),
    })
  })
  yield* journal.writeFromRemote({
    remoteId,
    entries,
    effect: (batch) =>
      Effect.forEach(batch, replay, { discard: true }).pipe(Effect.orDie),
  })
})

const tables = Effect.gen(function* () {
  const db = yield* QueryBuilder
  return yield* Effect.all({
    groups: db.from("receiptGroups").select(),
    receipts: db.from("receipts").select(),
    images: db.from("images").select(),
  })
})

const at = (iso: string) => DateTime.makeUnsafe(iso)

const home = ReceiptGroup.insert.make({
  id: ReceiptGroupId.make(uuidBytes("0b6c1d2e-3f40-4a51-8b62-7c83d94ea5f6")),
  name: "Home",
  defaultCurrency: "NZD",
})
const work = ReceiptGroup.insert.make({
  id: ReceiptGroupId.make(uuidBytes("1c7d2e3f-4051-4b62-9c73-8d94ea5fb607")),
  name: "Work",
})
const groceries = Receipt.insert.make({
  id: ReceiptId.make(uuidBytes("2d8e3f40-5162-4c73-ad84-9ea5fb6c0718")),
  date: at("2026-03-04T00:00:00.000Z"),
  description: "Weekly shop",
  merchant: "",
  amount: BigDecimal.fromNumberUnsafe(0),
  currency: "NZD",
  processed: false,
  groupId: home.id,
})
const taxi = Receipt.insert.make({
  ...groceries,
  id: ReceiptId.make(uuidBytes("3e9f4051-6273-4d84-be95-afb6c7d18229")),
  merchant: "Taxi",
  createdAt: Model.Override(groceries.createdAt),
  updatedAt: Model.Override(groceries.updatedAt),
})
const photo = Image.insert.make({
  id: ImageId.make(uuidBytes("4fa05162-7384-4e95-8fa6-b0c7d8e2933a")),
  receiptId: groceries.id,
  data: new Uint8Array([1, 2, 3]),
  contentType: "image/jpeg",
})
const otherPhoto = Image.insert.make({
  ...photo,
  id: ImageId.make(uuidBytes("50b16273-8495-4fa6-90b7-c1d8e9f3a44b")),
  createdAt: Model.Override(photo.createdAt),
  updatedAt: Model.Override(photo.updatedAt),
})

describe("Sync", () => {
  it.effect("replays journals written with the legacy events", () =>
    Effect.gen(function* () {
      yield* receiveFromRemote([
        [{ event: "GroupCreate", payload: home }, 90],
        [{ event: "GroupCreate", payload: work }, 89],
        [
          {
            event: "GroupUpdate",
            payload: ReceiptGroup.update.make({ ...work, name: "Office" }),
          },
          88,
        ],
        [{ event: "ReceiptCreate", payload: groceries }, 80],
        [
          {
            event: "ReceiptUpdate",
            payload: Receipt.update.make({
              ...groceries,
              merchant: "Countdown",
            }),
          },
          79,
        ],
        [
          {
            event: "ReceiptSetProcessed",
            payload: { id: groceries.id, processed: true },
          },
          78,
        ],
        [{ event: "ReceiptCreate", payload: taxi }, 77],
        [{ event: "ReceiptDelete", payload: taxi.id }, 76],
        [{ event: "ImageCreate", payload: photo }, 70],
        [{ event: "ImageCreate", payload: otherPhoto }, 69],
        [{ event: "ImageDelete", payload: otherPhoto.id }, 68],
      ])

      // new row events apply on top of rows created by legacy events
      yield* write(ReceiptRow.patch(groceries.id, { description: "Edited" }))

      const state = yield* tables
      expect(
        state.groups.map((_) => [uuidString(_.id), _.name]).sort(),
      ).toEqual([
        [uuidString(home.id), "Home"],
        [uuidString(work.id), "Office"],
        // created with the database
        ["ac7210d4-b401-45bd-8006-bc8699cd3115", "My Receipts"],
      ])
      expect(
        state.receipts.map((_) => [
          uuidString(_.id),
          _.merchant,
          _.description,
          _.processed,
        ]),
      ).toEqual([[uuidString(groceries.id), "Countdown", "Edited", true]])
      expect(state.images.map((_) => uuidString(_.id))).toEqual([
        uuidString(photo.id),
      ])
    }).pipe(Effect.provide(TestLayer)),
  )

  it.effect("keeps concurrent edits to different fields of a receipt", () =>
    Effect.gen(function* () {
      // created on another device
      yield* receiveFromRemote([[ReceiptRow.set(groceries), 2000]])

      // edited here
      yield* write(ReceiptRow.patch(groceries.id, { merchant: "Countdown" }))

      // the other device's AI worker finished before the edit above but
      // syncs after it
      yield* receiveFromRemote([
        [
          ReceiptRow.patch(groceries.id, {
            merchant: "COUNTDOWN LTD",
            amount: BigDecimal.fromStringUnsafe("12.34"),
            processed: true,
          }),
          1000,
        ],
      ])

      const [receipt] = (yield* tables).receipts
      expect(receipt.merchant).toBe("Countdown")
      expect(BigDecimal.format(receipt.amount)).toBe("12.34")
      expect(receipt.processed).toBe(true)
      expect(receipt.description).toBe("Weekly shop")
    }).pipe(Effect.provide(TestLayer)),
  )
})
