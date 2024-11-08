import { CoList, CoMap, co } from "jazz-tools"
import { Folder } from "./Folder"
import { Currency } from "./Currency"
import { ImageList } from "./Image"

export class Receipt extends CoMap {
  date = co.optional.Date
  description = co.string
  merchant = co.string
  amount = co.string
  currency = Currency
  uri = co.optional.string
  images = co.ref(ImageList)
  folder = co.ref(Folder)
  deleted = co.boolean
}

export class ReceiptList extends CoList.Of(co.ref(Receipt)) {}
