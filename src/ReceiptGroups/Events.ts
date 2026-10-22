import { ReceiptGroup, ReceiptGroupId } from "@/Domain/ReceiptGroup"
import { uuidString } from "@/lib/utils"
import { EventGroup, EventRow } from "effect/eventlog"

export const ReceiptGroupRow = EventRow.make("ReceiptGroup", {
  key: "id",
  schema: ReceiptGroup.select,
})

export const ReceiptGroupEvents = EventGroup.empty
  .add(ReceiptGroupRow)
  // Legacy events, kept only so existing journals still replay. Nothing
  // writes them any more.
  .add({
    tag: "GroupCreate",
    primaryKey: (g) => uuidString(g.id!),
    payload: ReceiptGroup.insert,
    success: ReceiptGroup,
  })
  .add({
    tag: "GroupUpdate",
    primaryKey: (g) => uuidString(g.id),
    payload: ReceiptGroup.update,
  })
  .add({
    tag: "GroupDelete",
    primaryKey: (id) => uuidString(id),
    payload: ReceiptGroupId,
  })
