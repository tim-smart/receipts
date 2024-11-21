import { Model } from "@effect/sql"
import { Schema } from "effect"
import { ReceiptId } from "./Receipt"
import { uuidString } from "@/lib/utils"

export const ImageId = Schema.Uint8ArrayFromSelf.pipe(Schema.brand("ImageId"))

export class Image extends Model.Class<Image>("Image")({
  id: Model.UuidV4Insert(ImageId),
  receiptId: ReceiptId,
  data: Schema.Uint8ArrayFromSelf,
  contentType: Schema.String,
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate,
}) {
  static readonly Array = Schema.Array(Image)
  readonly idString = uuidString(this.id)
}
