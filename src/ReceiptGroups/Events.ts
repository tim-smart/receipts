import { ReceiptGroup } from "@/Domain/ReceiptGroup"
import { EventGroup, EventRow } from "effect/eventlog"

export const ReceiptGroupRow = EventRow.make("ReceiptGroup", {
  key: "id",
  schema: ReceiptGroup.select,
})

export const ReceiptGroupEvents = EventGroup.empty.add(ReceiptGroupRow)
