import { Schema } from "effect"
import { ReceiptId } from "./Receipt"
import { uuidString } from "@/lib/utils"
import { Model } from "effect/unstable/schema"
import { DateTimeInsert } from "./Fields"

export const ImageId = Model.Uint8Array.pipe(Schema.brand("ImageId"))

export class Image extends Model.Class<Image>("Image")({
  id: Model.UuidV4Insert(ImageId),
  receiptId: ReceiptId,
  data: Schema.Uint8Array,
  contentType: Schema.String,
  createdAt: DateTimeInsert,
  updatedAt: Model.DateTimeUpdate,
}) {
  static readonly Array = Schema.Array(Image)
  readonly idString = uuidString(this.id)
}
