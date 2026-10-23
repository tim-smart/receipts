/**
 * Keeps the receipts, groups and images tables equal to the result of
 * applying every journal entry in id order, across the legacy events and the
 * EventRow events that replaced them.
 *
 * The journal only reports conflicts between entries with the same event
 * tag, so a legacy entry and a row entry for the same row never see each
 * other. A late legacy entry, or a row entry older than a legacy entry
 * already applied, can't be applied incrementally. Those entries rebuild the
 * tables from the whole journal instead, after their batch is committed.
 *
 * The tables are also rebuilt once after upgrading, to apply row entries that
 * a version without the row handlers stored but skipped.
 */
import {
  Context,
  Effect,
  FiberHandle,
  Layer,
  Option,
  Ref,
  Schema,
} from "effect"
import { EventJournal, EventLog } from "effect/eventlog"
import { Reactivity } from "effect/reactivity"
import { SchemaBinary } from "effect/encoding"
import { Image, ImageId } from "./Domain/Image"
import { Receipt, ReceiptId } from "./Domain/Receipt"
import { ReceiptGroup, ReceiptGroupId } from "./Domain/ReceiptGroup"
import { ImageRow } from "./Images/Events"
import { initialReceiptGroupId, QueryBuilder } from "./IndexedDb"
import { ReceiptGroupRow } from "./ReceiptGroups/Events"
import { ReceiptRow, ReceiptSetProcessed } from "./Receipts/Events"
import { uuidString } from "./lib/utils"

type Table = "receipts" | "receiptGroups" | "images"

type Row = { readonly id: Uint8Array }

// a legacy or row event as a row operation
type Op =
  | { readonly _tag: "set"; readonly row: Row }
  | { readonly _tag: "patch"; readonly key: Uint8Array; readonly fields: {} }
  | { readonly _tag: "remove"; readonly key: Uint8Array }

const legacyEvents: ReadonlySet<string> = new Set([
  "ReceiptCreate",
  "ReceiptUpdate",
  "ReceiptDelete",
  "ReceiptSetProcessed",
  "GroupCreate",
  "GroupUpdate",
  "GroupDelete",
  "ImageCreate",
  "ImageDelete",
])

// decodes entry payloads like the journal does
const codecs = {
  Receipt: SchemaBinary.toCodec(ReceiptRow.payload),
  ReceiptCreate: SchemaBinary.toCodec(Receipt.insert),
  ReceiptUpdate: SchemaBinary.toCodec(Receipt.update),
  ReceiptSetProcessed: SchemaBinary.toCodec(ReceiptSetProcessed),
  ReceiptDelete: SchemaBinary.toCodec(ReceiptId),
  ReceiptGroup: SchemaBinary.toCodec(ReceiptGroupRow.payload),
  GroupCreate: SchemaBinary.toCodec(ReceiptGroup.insert),
  GroupUpdate: SchemaBinary.toCodec(ReceiptGroup.update),
  GroupDelete: SchemaBinary.toCodec(ReceiptGroupId),
  Image: SchemaBinary.toCodec(ImageRow.payload),
  ImageCreate: SchemaBinary.toCodec(Image.insert),
  ImageDelete: SchemaBinary.toCodec(ImageId),
}

const decode = <A>(
  codec: Schema.Codec<A, Uint8Array>,
  entry: EventJournal.Entry,
) => Schema.decodeUnknownEffect(codec)(entry.payload)

const toOp = (
  entry: EventJournal.Entry,
): Effect.Effect<readonly [Table, Op] | undefined, Schema.SchemaError> => {
  const op = (table: Table) => (op: Op) => [table, op] as const
  switch (entry.event) {
    case "Receipt":
      return Effect.map(decode(codecs.Receipt, entry), op("receipts"))
    // create and update both carry the whole row
    case "ReceiptCreate":
      return Effect.map(decode(codecs.ReceiptCreate, entry), (row) =>
        op("receipts")({ _tag: "set", row }),
      )
    case "ReceiptUpdate":
      return Effect.map(decode(codecs.ReceiptUpdate, entry), (row) =>
        op("receipts")({ _tag: "set", row }),
      )
    case "ReceiptSetProcessed":
      return Effect.map(
        decode(codecs.ReceiptSetProcessed, entry),
        ({ id, processed }) =>
          op("receipts")({ _tag: "patch", key: id, fields: { processed } }),
      )
    case "ReceiptDelete":
      return Effect.map(decode(codecs.ReceiptDelete, entry), (key) =>
        op("receipts")({ _tag: "remove", key }),
      )
    case "ReceiptGroup":
      return Effect.map(decode(codecs.ReceiptGroup, entry), op("receiptGroups"))
    case "GroupCreate":
      return Effect.map(decode(codecs.GroupCreate, entry), (row) =>
        op("receiptGroups")({ _tag: "set", row }),
      )
    case "GroupUpdate":
      return Effect.map(decode(codecs.GroupUpdate, entry), (row) =>
        op("receiptGroups")({ _tag: "set", row }),
      )
    case "GroupDelete":
      return Effect.map(decode(codecs.GroupDelete, entry), (key) =>
        op("receiptGroups")({ _tag: "remove", key }),
      )
    case "Image":
      return Effect.map(decode(codecs.Image, entry), op("images"))
    case "ImageCreate":
      return Effect.map(decode(codecs.ImageCreate, entry), (row) =>
        op("images")({ _tag: "set", row }),
      )
    case "ImageDelete":
      return Effect.map(decode(codecs.ImageDelete, entry), (key) =>
        op("images")({ _tag: "remove", key }),
      )
    default:
      return Effect.succeed(undefined)
  }
}

// the same semantics as the EventRow handlers
const applyOp = (rows: Map<string, Row>, op: Op) => {
  switch (op._tag) {
    case "set": {
      rows.set(uuidString(op.row.id), op.row)
      break
    }
    case "patch": {
      const key = uuidString(op.key)
      const current = rows.get(key)
      if (current) rows.set(key, { ...current, ...op.fields })
      break
    }
    case "remove": {
      rows.delete(uuidString(op.key))
      break
    }
  }
}

export class Projection extends Context.Service<
  Projection,
  {
    /**
     * Handler for the legacy events: they are only replayed from remotes, and
     * rebuild the tables.
     */
    readonly legacy: () => Effect.Effect<void>
    /**
     * Wraps a row event handler, rebuilding the tables instead when the entry
     * is older than a legacy entry in the journal.
     */
    readonly row: <
      Options extends { readonly entry: EventJournal.Entry },
      E,
      R,
    >(
      handler: (options: Options) => Effect.Effect<void, E, R>,
    ) => (options: Options) => Effect.Effect<void, E, R>
  }
>()("receipts/Projection") {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const db = yield* QueryBuilder
      const journal = yield* EventJournal.EventJournal
      const reactivity = yield* Reactivity.Reactivity
      const storeId = yield* EventLog.CurrentStoreId
      const rebuilds = yield* FiberHandle.make()

      const state = yield* db
        .from("projection")
        .select()
        .equals("state")
        .first()
        .pipe(Effect.catchNoSuchElement, Effect.orDie)
      const legacyUntil = yield* Ref.make(
        Option.match(state, {
          onNone: () => "",
          onSome: (_) => _.legacyUntil,
        }),
      )

      const rebuild = Effect.gen(function* () {
        const entries = [...(yield* journal.entries)].sort(
          EventJournal.Entry.Order,
        )
        const tables: Record<Table, Map<string, Row>> = {
          receipts: new Map(),
          receiptGroups: new Map(),
          images: new Map(),
        }
        // created with the database rather than by an event
        const initialGroup = yield* db
          .from("receiptGroups")
          .select()
          .equals(initialReceiptGroupId)
          .first()
          .pipe(Effect.catchNoSuchElement)
        if (Option.isSome(initialGroup)) {
          applyOp(tables.receiptGroups, {
            _tag: "set",
            row: initialGroup.value,
          })
        }
        let newestLegacy = ""
        for (const entry of entries) {
          if (legacyEvents.has(entry.event)) newestLegacy = entry.idString
          const op = yield* toOp(entry).pipe(
            Effect.tapError((error) =>
              Effect.logWarning("Skipping undecodable entry", entry, error),
            ),
            Effect.orElseSucceed(() => undefined),
          )
          if (op) applyOp(tables[op[0]], op[1])
        }
        const receipts = Array.from(
          tables.receipts.values(),
          (row) => new Receipt(row as Receipt),
        )
        const groups = Array.from(
          tables.receiptGroups.values(),
          (row) => new ReceiptGroup(row as ReceiptGroup),
        )
        const images = Array.from(
          tables.images.values(),
          (row) => new Image(row as Image),
        )
        yield* Effect.gen(function* () {
          yield* db.from("receipts").clear
          yield* db.from("receiptGroups").clear
          yield* db.from("images").clear
          if (receipts.length > 0) {
            yield* db.from("receipts").insertAll(receipts)
          }
          if (groups.length > 0) {
            yield* db.from("receiptGroups").insertAll(groups)
          }
          if (images.length > 0) {
            yield* db.from("images").insertAll(images)
          }
          yield* db.from("projection").upsert({
            name: "state",
            rebuildPending: false,
            legacyUntil: newestLegacy,
          })
        }).pipe(
          db.withTransaction({
            tables: ["receipts", "receiptGroups", "images", "projection"],
            mode: "readwrite",
          }),
        )
        yield* Ref.set(legacyUntil, newestLegacy)
        yield* reactivity.invalidate(["receipts", "receipt_groups"])
      }).pipe(
        // waits for the batch that requested it to be committed
        journal.withLock(storeId),
        Effect.annotateLogs({ service: "Projection", effect: "rebuild" }),
      )

      // persisted, so a rebuild interrupted by a reload still runs
      const requestRebuild = Effect.gen(function* () {
        yield* db.from("projection").upsert({
          name: "state",
          rebuildPending: true,
          legacyUntil: yield* Ref.get(legacyUntil),
        })
        yield* FiberHandle.run(
          rebuilds,
          rebuild.pipe(Effect.catchCause(Effect.logError)),
          { onlyIfMissing: true },
        )
      }).pipe(Effect.orDie)

      if (Option.isNone(state) || state.value.rebuildPending) {
        yield* rebuild.pipe(Effect.orDie)
      }

      return Projection.of({
        legacy: () => requestRebuild,
        row: (handler) => (options) =>
          Effect.flatMap(Ref.get(legacyUntil), (until) =>
            options.entry.idString < until ? requestRebuild : handler(options),
          ),
      })
    }),
  ).pipe(Layer.provide([QueryBuilder.layer, Reactivity.layer]))
}
