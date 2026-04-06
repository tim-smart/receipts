import { ReceiptGroup, ReceiptGroupId } from "@/Domain/ReceiptGroup"
import { uuidString } from "@/lib/utils"
import { EventGroup } from "effect/unstable/eventlog"

export const ReceiptGroupEvents = EventGroup.empty
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
