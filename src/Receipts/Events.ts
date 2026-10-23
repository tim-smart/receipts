import { Receipt } from "@/Domain/Receipt"
import { EventGroup, EventRow } from "effect/eventlog"

export const ReceiptRow = EventRow.make("Receipt", {
  key: "id",
  schema: Receipt.select,
})

export const ReceiptEvents = EventGroup.empty.add(ReceiptRow)
