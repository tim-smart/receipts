import { Model } from "@effect/sql"
import { Schema } from "effect"
import { Currency } from "./Currency"

export const ReceiptGroupId = Schema.Uint8ArrayFromSelf.pipe(
  Schema.brand("ReceiptGroupId"),
)

export const ReceiptGroupIdJson = Schema.Uint8Array.pipe(
  Schema.compose(ReceiptGroupId),
)

export class ReceiptGroup extends Model.Class<ReceiptGroup>("ReceiptGroup")({
  id: Model.UuidV4Insert(ReceiptGroupId),
  name: Schema.NonEmptyTrimmedString,
  defaultCurrency: Currency.pipe(
    Schema.propertySignature,
    Schema.withConstructorDefault(() => "USD"),
  ),
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate,
}) {
  static readonly Array = Schema.Array(ReceiptGroup)
}
