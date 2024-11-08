import { CoList, CoMap, co } from "jazz-tools"
import { ReceiptList } from "./Receipt"

export class Folder extends CoMap {
  name = co.string
  items = co.ref(ReceiptList)
  defaultCurrency = co.string
  deleted = co.boolean
}

export class FolderList extends CoList.Of(co.ref(Folder)) {}
