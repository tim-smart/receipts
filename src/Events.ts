import { SettingEvents } from "./Settings/Events"
import { ReceiptGroupEvents } from "./ReceiptGroups/Events"
import { ReceiptEvents } from "./Receipts/Events"
import { ImageEvents } from "./Images/Events"
import { EventLog } from "effect/unstable/eventlog"

export const ReceiptAppEvents = EventLog.schema(
  SettingEvents,
  ReceiptGroupEvents,
  ReceiptEvents,
  ImageEvents,
)
