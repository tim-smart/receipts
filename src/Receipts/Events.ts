import { Receipt, ReceiptId } from "@/Domain/Receipt"
import { uuidString } from "@/lib/utils"
import { EventGroup } from "@effect/experimental"
import { Model } from "@effect/sql"
import { Schema } from "effect"

export class ReceiptEvents extends EventGroup.empty
  .add({
    tag: "ReceiptCreate",
    primaryKey: (g) => uuidString(g.id!),
    payload: Receipt.insert,
    success: Receipt,
  })
  .add({
    tag: "ReceiptUpdate",
    primaryKey: (g) => uuidString(g.id),
    payload: Receipt.update,
  })
  .add({
    tag: "ReceiptDelete",
    primaryKey: (id) => uuidString(id),
    payload: ReceiptId,
  })
  .add({
    tag: "ReceiptSetProcessed",
    primaryKey: ({ id }) => uuidString(id),
    payload: Schema.Struct({
      id: ReceiptId,
      processed: Model.BooleanFromNumber,
    }),
  }) {}
