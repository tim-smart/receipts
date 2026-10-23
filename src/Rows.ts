import { Effect, Option } from "effect"
import { Image } from "./Domain/Image"
import { Receipt } from "./Domain/Receipt"
import { ReceiptGroup } from "./Domain/ReceiptGroup"
import { QueryBuilder } from "./IndexedDb"

// How the receipts, groups and images tables store their row events, for
// `EventRow.handler` and for re-applying entries after a reset. A patch never
// recreates a missing (e.g. removed) row.
export const makeRowStores = (db: QueryBuilder["Service"]) => {
  const receipts = db.from("receipts")
  const groups = db.from("receiptGroups")
  const images = db.from("images")

  return {
    Receipt: {
      set: (row: typeof Receipt.select.Type) =>
        receipts.upsert(new Receipt(row)).pipe(Effect.orDie),
      patch: Effect.fn(function* (
        id: Receipt["id"],
        fields: Partial<typeof Receipt.select.Type>,
      ) {
        const current = yield* receipts
          .select()
          .equals(id)
          .first()
          .pipe(Effect.catchNoSuchElement)
        if (Option.isNone(current)) return
        yield* receipts.upsert(new Receipt({ ...current.value, ...fields }))
      }, Effect.orDie),
      remove: (id: Receipt["id"]) =>
        receipts.delete().equals(id).pipe(Effect.orDie),
    },
    ReceiptGroup: {
      set: (row: typeof ReceiptGroup.select.Type) =>
        groups.upsert(row).pipe(Effect.orDie),
      patch: Effect.fn(function* (
        id: ReceiptGroup["id"],
        fields: Partial<typeof ReceiptGroup.select.Type>,
      ) {
        const current = yield* groups
          .select()
          .equals(id)
          .first()
          .pipe(Effect.catchNoSuchElement)
        if (Option.isNone(current)) return
        yield* groups.upsert({ ...current.value, ...fields })
      }, Effect.orDie),
      remove: (id: ReceiptGroup["id"]) =>
        groups.delete().equals(id).pipe(Effect.orDie),
    },
    Image: {
      set: (row: typeof Image.select.Type) =>
        images.upsert(new Image(row)).pipe(Effect.orDie),
      patch: Effect.fn(function* (
        id: Image["id"],
        fields: Partial<typeof Image.select.Type>,
      ) {
        const current = yield* images
          .select()
          .equals(id)
          .first()
          .pipe(Effect.catchNoSuchElement)
        if (Option.isNone(current)) return
        yield* images.upsert(new Image({ ...current.value, ...fields }))
      }, Effect.orDie),
      remove: (id: Image["id"]) =>
        images.delete().equals(id).pipe(Effect.orDie),
    },
  } as const
}
