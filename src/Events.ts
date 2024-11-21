import { EventLog } from "@effect/experimental"
import { SettingEvents } from "./Settings/Events"
import { ReceiptGroupEvents } from "./ReceiptGroups/Events"
import { ReceiptEvents } from "./Receipts/Events"
import { ImageEvents } from "./Images/Events"

export class ReceiptAppEvents extends EventLog.schema(
  SettingEvents,
  ReceiptGroupEvents,
  ReceiptEvents,
  ImageEvents,
) {}
