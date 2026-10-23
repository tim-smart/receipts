/**
 * Deleting all groups, receipts and images, on every device.
 *
 * A reset is a synced `DataReset` event. Applying it clears the tables, and
 * from then on row entries older than the reset are ignored, so history that
 * is still on the remote, or edits that sync late, can't bring old data back.
 * Row entries newer than the reset that this device already has are applied
 * again, so every device ends with the result of applying entries in id
 * order.
 */
import { Context, Effect, Layer, Option, Ref, Schema } from "effect"
import { SchemaBinary } from "effect/encoding"
import { EventJournal, EventLog } from "effect/eventlog"
import { ImageRow } from "./Images/Events"
import { makeInitialReceiptGroup, QueryBuilder } from "./IndexedDb"
import { ReceiptGroupRow } from "./ReceiptGroups/Events"
import { ReceiptRow } from "./Receipts/Events"
import { ResetEvents } from "./Reset/Events"
import { makeRowStores } from "./Rows"

const decodeReceipt = Schema.decodeUnknownEffect(
  SchemaBinary.toCodec(ReceiptRow.payload),
)
const decodeReceiptGroup = Schema.decodeUnknownEffect(
  SchemaBinary.toCodec(ReceiptGroupRow.payload),
)
const decodeImage = Schema.decodeUnknownEffect(
  SchemaBinary.toCodec(ImageRow.payload),
)

export class DataReset extends Context.Service<
  DataReset,
  {
    readonly apply: (reset: EventJournal.Entry) => Effect.Effect<void>
    /**
     * Wraps a row event handler, skipping entries older than the newest
     * reset.
     */
    readonly guard: <
      Options extends { readonly entry: EventJournal.Entry },
      E,
      R,
    >(
      handler: (options: Options) => Effect.Effect<void, E, R>,
    ) => (options: Options) => Effect.Effect<void, E, R>
  }
>()("receipts/DataReset") {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const db = yield* QueryBuilder
      const journal = yield* EventJournal.EventJournal
      const stores = makeRowStores(db)

      // re-applies an entry with the same semantics as `EventRow.handler`
      const rows: Record<
        string,
        (entry: EventJournal.Entry) => Effect.Effect<void, Schema.SchemaError>
      > = {
        Receipt: (entry) =>
          decodeReceipt(entry.payload).pipe(
            Effect.flatMap((op) => applyOp(stores.Receipt, op)),
          ),
        ReceiptGroup: (entry) =>
          decodeReceiptGroup(entry.payload).pipe(
            Effect.flatMap((op) => applyOp(stores.ReceiptGroup, op)),
          ),
        Image: (entry) =>
          decodeImage(entry.payload).pipe(
            Effect.flatMap((op) => applyOp(stores.Image, op)),
          ),
      }

      const state = yield* db
        .from("reset")
        .select()
        .equals("state")
        .first()
        .pipe(Effect.catchNoSuchElement, Effect.orDie)
      const appliedId = yield* Ref.make(
        Option.match(state, {
          onNone: () => "",
          onSome: (_) => _.appliedId,
        }),
      )

      const apply = Effect.fn(function* (reset: EventJournal.Entry) {
        if (reset.idString <= (yield* Ref.get(appliedId))) return
        // entries in the batch that delivered the reset aren't stored yet,
        // and their handlers run after this one
        const newer = (yield* journal.entries)
          .filter(
            (entry) => entry.event in rows && entry.idString > reset.idString,
          )
          .sort(EventJournal.Entry.Order)

        yield* db.from("receipts").clear
        yield* db.from("receiptGroups").clear
        yield* db.from("images").clear
        // as on a new device
        yield* db.from("receiptGroups").insert(makeInitialReceiptGroup())
        for (const entry of newer) {
          yield* rows[entry.event](entry)
        }
        yield* db.from("reset").upsert({
          name: "state",
          appliedId: reset.idString,
          scanJournal: false,
        })
        yield* Ref.set(appliedId, reset.idString)
      }, Effect.orDie)

      // after upgrading, apply a reset that the old version skipped
      if (Option.isNone(state) || state.value.scanJournal) {
        const resets = (yield* Effect.orDie(journal.entries))
          .filter((entry) => entry.event === "DataReset")
          .sort(EventJournal.Entry.Order)
        if (resets.length > 0) yield* apply(resets[resets.length - 1])
        yield* db
          .from("reset")
          .upsert({
            name: "state",
            appliedId: yield* Ref.get(appliedId),
            scanJournal: false,
          })
          .pipe(Effect.orDie)
      }

      return DataReset.of({
        apply,
        guard: (handler) => (options) =>
          Effect.flatMap(Ref.get(appliedId), (id) =>
            options.entry.idString < id ? Effect.void : handler(options),
          ),
      })
    }),
  ).pipe(Layer.provide(QueryBuilder.layer))
}

type Op<Row, Key> =
  | { readonly _tag: "set"; readonly row: Row }
  | { readonly _tag: "patch"; readonly key: Key; readonly fields: Partial<Row> }
  | { readonly _tag: "remove"; readonly key: Key }

const applyOp = <Row, Key>(
  store: {
    readonly set: (row: Row) => Effect.Effect<void>
    readonly patch: (key: Key, fields: Partial<Row>) => Effect.Effect<void>
    readonly remove: (key: Key) => Effect.Effect<void>
  },
  op: Op<Row, Key>,
): Effect.Effect<void> => {
  switch (op._tag) {
    case "set":
      return store.set(op.row)
    case "patch":
      return Object.keys(op.fields).length === 0
        ? Effect.void
        : store.patch(op.key, op.fields)
    case "remove":
      return store.remove(op.key)
  }
}

const ResetHandlers = EventLog.group(ResetEvents, (handlers) =>
  Effect.gen(function* () {
    const reset = yield* DataReset
    return handlers.handle("DataReset", ({ entry }) => reset.apply(entry))
  }),
)

export const ResetLayer = Layer.mergeAll(
  ResetHandlers,
  EventLog.groupReactivity(ResetEvents, ["receipts", "receipt_groups"]),
)
