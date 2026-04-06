import { Receipt } from "@/Domain/Receipt"
import { IndexedDbTable } from "@effect/platform-browser"

export class ReceiptsTable extends IndexedDbTable.make({
  name: "receipts",
  schema: Receipt,
  keyPath: "id",
  indexes: {
    groupIdSort: ["groupId", "date", "merchant"],
  },
}) {}
