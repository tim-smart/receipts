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
import { SchemaBinary } from "effect/encoding"
import { EventJournal, EventLog, EventLogRemote } from "effect/eventlog"
import { Model } from "effect/schema"
import { IDBFactory, IDBKeyRange } from "fake-indexeddb"
import { exportBackup, importBackup } from "./Backup"
import { BackupStoreLive } from "./Backup/Store"
import { Receipt, ReceiptId } from "./Domain/Receipt"
import { ReceiptGroup, ReceiptGroupId } from "./Domain/ReceiptGroup"
import { EventLogClient } from "./EventLog"
import { ReceiptAppEvents } from "./Events"
import { layerEventLog } from "./EventLogLayer"
import { QueryBuilder } from "./IndexedDb"
import { ReceiptGroupRow } from "./ReceiptGroups/Events"
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

      // every delivered batch is replayed
      const settled = journal.nextRemoteSequence(id).pipe(
        Effect.orDie,
        Effect.repeat({
          until: (next) => next >= sequence,
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
// IndexedDB, connected to a `Remote`, with the app's backup store.
const Device = Layer.mergeAll(
  Remote.layer,
  BackupStoreLive.pipe(Layer.provide(EventLogClient.layer)),
).pipe(
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
  const groups = yield* db.from("receiptGroups").select()
  const receipts = yield* db.from("receipts").select()
  return {
    groups: groups.map((_) => [uuidString(_.id), _.name]).sort(),
    receipts: receipts.map((_) => [uuidString(_.id), _.merchant]).sort(),
  }
})

const at = (iso: string) => DateTime.makeUnsafe(iso)

// created with the database on every device
const initialGroup = ["ac7210d4-b401-45bd-8006-bc8699cd3115", "My Receipts"]

const home = ReceiptGroup.insert.make({
  id: ReceiptGroupId.make(uuidBytes("0b6c1d2e-3f40-4a51-8b62-7c83d94ea5f6")),
  name: "Home",
  defaultCurrency: "NZD",
})
const groceries = Receipt.insert.make({
  id: ReceiptId.make(uuidBytes("2d8e3f40-5162-4c73-ad84-9ea5fb6c0718")),
  date: at("2026-03-04T00:00:00.000Z"),
  description: "Weekly shop",
  merchant: "Countdown",
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
const lunch = Receipt.insert.make({
  ...groceries,
  id: ReceiptId.make(uuidBytes("5ac16273-8495-4fa6-90b7-c1d8e9f3a44b")),
  merchant: "Lunch",
  createdAt: Model.Override(groceries.createdAt),
  updatedAt: Model.Override(groceries.updatedAt),
})

// a `ReceiptCreate` entry, as releases before EventRow wrote them
const legacyReceiptCreate = (receipt: typeof Receipt.insert.Type) =>
  new EventJournal.Entry({
    id: EventJournal.makeEntryIdUnsafe({ msecs: Date.now() - 5000 }),
    event: "ReceiptCreate",
    primaryKey: uuidString(receipt.id),
    payload: Schema.encodeSync(SchemaBinary.toCodec(Receipt.insert))(receipt),
  })

describe("Sync", () => {
  it.live("keeps concurrent edits to different fields of a receipt", () =>
    Effect.gen(function* () {
      // created on another device
      yield* receive([[ReceiptRow.set(groceries), 2000]])

      // edited here
      yield* write(ReceiptRow.patch(groceries.id, { merchant: "Edited" }))

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

      const [receipt] = yield* QueryBuilder.use((db) =>
        db.from("receipts").select(),
      )
      expect(receipt.merchant).toBe("Edited")
      expect(BigDecimal.format(receipt.amount)).toBe("12.34")
      expect(receipt.processed).toBe(true)
      expect(receipt.description).toBe("Weekly shop")
    }).pipe(Effect.provide(Device)),
  )

  it.live("deletes all data everywhere and restores it from a backup", () =>
    Effect.gen(function* () {
      const thisDevice = yield* Effect.gen(function* () {
        yield* receive([
          [ReceiptGroupRow.set(home), 3000],
          [ReceiptRow.set(groceries), 3000],
        ])
        const backup = yield* exportBackup

        yield* write({ event: "DataReset", payload: {} })
        const afterReset = yield* tables

        // history from before the reset that syncs late: an edit from
        // another device, and an event from before EventRow
        yield* receive([[ReceiptRow.set(taxi), 1000]])
        yield* Remote.use((remote) =>
          remote.receiveEntries([legacyReceiptCreate(lunch)]),
        )

        const summary = yield* importBackup(backup)

        return {
          afterReset,
          summary,
          restored: yield* tables,
          entries: yield* EventLog.EventLog.use((log) => log.entries),
        }
      }).pipe(Effect.provide(Device))

      expect(thisDevice.afterReset).toEqual({
        groups: [initialGroup],
        receipts: [],
      })
      // the initial group exists again, so it is skipped
      expect(thisDevice.summary).toMatchObject({
        groups: 1,
        receipts: 1,
        skipped: 1,
      })
      expect(thisDevice.restored).toEqual({
        groups: [[uuidString(home.id), "Home"], initialGroup],
        receipts: [[uuidString(groceries.id), "Countdown"]],
      })

      // a device that syncs the whole history ends the same
      newIndexedDb()
      const newDevice = yield* Remote.use((remote) =>
        remote.receiveEntries(thisDevice.entries),
      ).pipe(Effect.andThen(tables), Effect.provide(Device))
      expect(newDevice).toEqual(thisDevice.restored)
    }),
  )
})
