import { CoList, CoMap, co } from "jazz-tools"
import { Folder } from "./Folder"

export class Receipt extends CoMap {
  description = co.string
  amount = co.string
  uri = co.optional.string
  folder = co.ref(Folder)
  deleted = co.boolean
}

export class ReceiptList extends CoList.Of(co.ref(Receipt)) {}
