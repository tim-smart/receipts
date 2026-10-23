import { afterEach, beforeEach, describe, expect, it, vi } from "@effect/vitest"
import {
  BigDecimal,
  Context,
  DateTime,
  Effect,
  Layer,
  Queue,
  Redacted,
  Schedule,
  Schema,
} from "effect"
import { EventJournal, EventLog, EventLogRemote } from "effect/eventlog"
import { Model } from "effect/schema"
import { IDBFactory, IDBKeyRange } from "fake-indexeddb"
import { Image, ImageId } from "./Domain/Image"
import { Receipt, ReceiptId } from "./Domain/Receipt"
import { ReceiptGroup, ReceiptGroupId } from "./Domain/ReceiptGroup"
import { ReceiptAppEvents } from "./Events"
import { layerEventLog } from "./EventLogLayer"
import { QueryBuilder } from "./IndexedDb"
import { ReceiptRow } from "./Receipts/Events"
import { uuidBytes, uuidString } from "./lib/utils"

type Write = { readonly event: string; readonly payload: unknown }

// A remote that delivers entries written on other devices, through the
// EventLog's own replay, including compaction of each received batch.
class Remote extends Context.Service<
  Remote,
  {
    // events written `ageMillis` ago
    readonly receive: (
      events: ReadonlyArray<readonly [Write, ageMillis: number]>,
    ) => Effect.Effect<void>
    readonly receiveEntries: (
      entries: ReadonlyArray<EventJournal.Entry>,
    ) => Effect.Effect<void>
  }
>()("test/Remote") {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const registry = yield* EventLog.Registry
      const journal = yield* EventJournal.EventJournal
      const db = yield* QueryBuilder
      const id = EventJournal.makeRemoteIdUnsafe()
      const changes = yield* Queue.unbounded<
        EventJournal.RemoteEntry,
        EventLogRemote.EventLogRemoteError
      >()
      let sequence = 0
      yield* registry.registerRemote({
        id,
        changes: () => Effect.succeed(changes),
        write: () => Effect.void,
        whenAuthenticated: (effect) => effect,
      })

      // the batches are replayed, and any rebuild they requested is done
      const settled = Effect.gen(function* () {
        const next = yield* journal.nextRemoteSequence(id)
        const state = yield* db.from("projection").select().first()
        return next >= sequence && !state.rebuildPending
      }).pipe(
        Effect.orDie,
        Effect.repeat({
          until: (done) => done,
          schedule: Schedule.spaced("5 millis"),
        }),
      )

      const receiveEntries = (entries: ReadonlyArray<EventJournal.Entry>) =>
        Queue.offerAll(
          changes,
          entries.map(
            (entry) =>
              new EventJournal.RemoteEntry({
                remoteSequence: sequence++,
                entry,
              }),
          ),
        ).pipe(Effect.andThen(settled))

      return Remote.of({
        receiveEntries,
        receive: (events) => {
          const now = Date.now()
          return receiveEntries(
            events.map(([{ event, payload }, ageMillis]) => {
              const schema = registry.handlers.get(event)!.event
              return new EventJournal.Entry({
                id: EventJournal.makeEntryIdUnsafe({ msecs: now - ageMillis }),
                event,
                primaryKey: schema.primaryKey(payload as never),
                payload: Schema.encodeUnknownSync(
                  schema.payloadSchemaBinary as Schema.Codec<
                    unknown,
                    Uint8Array
                  >,
                )(payload),
              })
            }),
          )
        },
      })
    }),
  )
}

// A device: the app's EventLog over a fresh in-memory journal and
// IndexedDB, connected to a `Remote`.
const Device = Remote.layer.pipe(
  Layer.provideMerge(
    Layer.mergeAll(layerEventLog(EventJournal.layerMemory), QueryBuilder.layer),
  ),
  Layer.provide(
    Layer.succeed(EventLog.Identity, {
      publicKey: "test",
      privateKey: Redacted.make(new Uint8Array(32)),
    }),
  ),
)

const newIndexedDb = () =>
  vi.stubGlobal("window", { indexedDB: new IDBFactory(), IDBKeyRange })

beforeEach(newIndexedDb)
afterEach(() => {
  vi.unstubAllGlobals()
})

const write = (
  event: Write,
): Effect.Effect<unknown, unknown, EventLog.EventLog> =>
  EventLog.EventLog.use((log) =>
    log.write({ schema: ReceiptAppEvents, ...event } as any),
  )

const receive = (events: ReadonlyArray<readonly [Write, ageMillis: number]>) =>
  Remote.use((remote) => remote.receive(events))

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
  it.live("replays journals written with the legacy events", () =>
    Effect.gen(function* () {
      yield* receive([
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
    }).pipe(Effect.provide(Device)),
  )

  it.live("keeps concurrent edits to different fields of a receipt", () =>
    Effect.gen(function* () {
      // created on another device
      yield* receive([[ReceiptRow.set(groceries), 2000]])

      // edited here
      yield* write(ReceiptRow.patch(groceries.id, { merchant: "Countdown" }))

      // the other device's AI worker finished before the edit above but
      // syncs after it
      yield* receive([
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
    }).pipe(Effect.provide(Device)),
  )

  it.live("converges when legacy edits arrive after newer row edits", () =>
    Effect.gen(function* () {
      const thisDevice = yield* Effect.gen(function* () {
        yield* receive([
          [{ event: "ReceiptCreate", payload: groceries }, 10_000],
        ])
        yield* write(ReceiptRow.patch(groceries.id, { merchant: "New edit" }))

        // a device that upgraded with unsynced legacy edits, in the same batch
        // as two patches of which compaction keeps only the newer
        yield* receive([
          [
            {
              event: "ReceiptUpdate",
              payload: Receipt.update.make({
                ...groceries,
                merchant: "Old edit",
                description: "Old description",
              }),
            },
            2000,
          ],
          [ReceiptRow.patch(groceries.id, { currency: "AUD" }), 1500],
          [ReceiptRow.patch(groceries.id, { currency: "USD" }), 1000],
        ])

        return {
          receipts: (yield* tables).receipts,
          entries: yield* EventLog.EventLog.use((log) => log.entries),
        }
      }).pipe(Effect.provide(Device))

      newIndexedDb()
      const newDevice = yield* Effect.gen(function* () {
        yield* Remote.use((remote) => remote.receiveEntries(thisDevice.entries))
        return (yield* tables).receipts
      }).pipe(Effect.provide(Device))

      expect(
        thisDevice.receipts.map((_) => [_.merchant, _.description, _.currency]),
      ).toEqual([["New edit", "Old description", "USD"]])
      expect(newDevice).toEqual(thisDevice.receipts)
    }),
  )
})
