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
import { IDBFactory, IDBKeyRange } from "fake-indexeddb"
import { Receipt, ReceiptId } from "./Domain/Receipt"
import { ReceiptGroup, ReceiptGroupId } from "./Domain/ReceiptGroup"
import { EventLogClient } from "./EventLog"
import { layerEventLog } from "./EventLogLayer"
import { QueryBuilder } from "./IndexedDb"
import { ReceiptRow } from "./Receipts/Events"
import { uuidBytes } from "./lib/utils"

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

      return Remote.of({
        receive: (events) => {
          const now = Date.now()
          return Queue.offerAll(
            changes,
            events.map(([{ event, payload }, ageMillis]) => {
              const schema = registry.handlers.get(event)!.event
              const entry = new EventJournal.Entry({
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
              return new EventJournal.RemoteEntry({
                remoteSequence: sequence++,
                entry,
              })
            }),
          ).pipe(Effect.andThen(settled))
        },
      })
    }),
  )
}

// A device: the app's EventLog over a fresh in-memory journal and
// IndexedDB, connected to a `Remote`.
const Device = Layer.mergeAll(Remote.layer, EventLogClient.layer).pipe(
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

const write = (event: Parameters<EventLogClient["Service"]>[0]) =>
  EventLogClient.use((client) => client(event))

const receive = (events: ReadonlyArray<readonly [Write, ageMillis: number]>) =>
  Remote.use((remote) => remote.receive(events))

const at = (iso: string) => DateTime.makeUnsafe(iso)

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
})
