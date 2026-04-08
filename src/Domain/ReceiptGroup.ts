import { Effect, Schema } from "effect"
import { Currency } from "./Currency"
import { Model } from "effect/unstable/schema"
import { DateTimeInsert } from "./Fields"
import { TrimmedString } from "@/lib/utils"

export const ReceiptGroupId = Model.Uint8Array.pipe(
  Schema.brand("ReceiptGroupId"),
)

export const ReceiptGroupIdJson = Schema.Uint8ArrayFromHex.pipe(
  Schema.decodeTo(ReceiptGroupId),
)

export class ReceiptGroup extends Model.Class<ReceiptGroup>("ReceiptGroup")({
  id: Model.UuidV4Insert(ReceiptGroupId),
  name: Schema.NonEmptyString.pipe(Schema.decodeTo(TrimmedString)),
  defaultCurrency: Currency.pipe(
    Schema.withConstructorDefault(Effect.succeed("USD")),
  ),
  createdAt: DateTimeInsert,
  updatedAt: Model.DateTimeUpdate,
}) {
  static readonly Array = Schema.Array(ReceiptGroup)
}
