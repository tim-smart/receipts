import { ReceiptGroup } from "@/Domain/ReceiptGroup"
import { IndexedDbTable } from "@effect/platform-browser"

export class ReceiptGroupsTable extends IndexedDbTable.make({
  name: "receiptGroups",
  schema: ReceiptGroup,
  keyPath: "id",
  indexes: {
    name: "name",
  },
}) {}
