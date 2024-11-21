import { Model } from "@effect/sql"
import { Currency } from "./Currency"
import { DateTime, Order, Schema } from "effect"
import { ReceiptGroupId } from "./ReceiptGroup"
import { uuidString } from "@/lib/utils"

export const ReceiptId = Schema.Uint8ArrayFromSelf.pipe(
  Schema.brand("ReceiptId"),
)

const BooleanFromNumber = Schema.transform(
  Schema.Literal(0, 1),
  Schema.Boolean,
  {
    decode(fromA) {
      return fromA === 1
    },
    encode(toI) {
      return toI ? 1 : 0
    },
  },
)

export class Receipt extends Model.Class<Receipt>("Receipt")({
  id: Model.UuidV4Insert(ReceiptId),
  date: Schema.DateTimeUtc,
  description: Schema.String,
  merchant: Schema.String,
  amount: Schema.BigDecimal,
  currency: Currency,
  processed: BooleanFromNumber,
  groupId: ReceiptGroupId,
  createdAt: Model.DateTimeInsert,
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
