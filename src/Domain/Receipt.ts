import { Currency } from "./Currency"
import { DateTime, Order, Schema } from "effect"
import { ReceiptGroupId } from "./ReceiptGroup"
import { uuidString } from "@/lib/utils"
import { Model } from "effect/unstable/schema"
import { DateTimeInsert } from "./Fields"

export const ReceiptId = Model.Uint8Array.pipe(Schema.brand("ReceiptId"))

export class Receipt extends Model.Class<Receipt>("Receipt")({
  id: Model.UuidV4Insert(ReceiptId),
  date: Schema.DateTimeUtcFromMillis,
  description: Schema.String,
  merchant: Schema.String,
  amount: Schema.BigDecimalFromString,
  currency: Currency,
  processed: Schema.BooleanFromBit,
  groupId: ReceiptGroupId,
  createdAt: DateTimeInsert,
  updatedAt: Model.DateTimeUpdate,
}) {
  static readonly Array = Schema.Array(Receipt)
  readonly idString = uuidString(this.id)
}

export const ReceiptOrder = Order.make<Receipt>((a, b) => {
  if (a.date && b.date) {
    return DateTime.Order(b.date, a.date)
  } else if (a.date) {
    return 1
  } else if (b.date) {
    return -1
  }
  return 0
})
