import { Image } from "@/Domain/Image"
import { IndexedDbTable } from "@effect/platform-browser"

export class ImagesTable extends IndexedDbTable.make({
  name: "images",
  schema: Image,
  keyPath: "id",
  indexes: {
    receiptId: "receiptId",
  },
}) {}
