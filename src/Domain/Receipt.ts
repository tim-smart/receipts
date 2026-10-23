import { Currency } from "./Currency"
import { BigDecimal, DateTime, Order, Schema } from "effect"
import { ReceiptGroupId } from "./ReceiptGroup"
import { TrimmedString, uuidString } from "@/lib/utils"
import { Model } from "effect/schema"
import { DateTimeInsert } from "./Fields"

export const ReceiptId = Model.Uint8Array.pipe(Schema.brand("ReceiptId"))
export type ReceiptId = typeof ReceiptId.Type

export class Receipt extends Model.Class<Receipt>("Receipt")({
  id: Model.UuidV4BytesInsert(ReceiptId),
  date: Schema.DateTimeUtcFromMillis,
  description: TrimmedString,
  merchant: TrimmedString,
  amount: Schema.BigDecimalFromString,
  currency: Currency,
  processed: Schema.BooleanFromBit,
  groupId: ReceiptGroupId,
  createdAt: DateTimeInsert,
  updatedAt: Model.DateTimeUpdate,
}) {
  static readonly Array = Schema.Array(Receipt)
  readonly idString = uuidString(this.id)

  /** True while the receipt is still being read from its photo. */
  get processing(): boolean {
    return this.processed === false
  }

  /** The description, falling back to the merchant and then a placeholder. */
  get title(): string {
    return (
      this.description ||
      this.merchant ||
      (this.processing ? "New receipt" : "Receipt")
    )
  }

  /** The name the monogram tile is derived from. */
  get monogramName(): string {
    return this.merchant || this.description
  }

  /** False while a receipt being read from its photo still has no amount. */
  get hasAmount(): boolean {
    return !(this.processing && BigDecimal.isZero(this.amount))
  }
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
