import { CoList, CoMap, co } from "jazz-tools"
import { Folder } from "./Folder"
import { Currency } from "./Currency"
import { ImageList } from "./Image"
import { Order } from "effect"

export class Receipt extends CoMap {
  date = co.optional.Date
  description = co.string
  merchant = co.string
  amount = co.string
  currency = Currency
  processed = co.boolean
  uri = co.optional.string
  images = co.ref(ImageList)
  folder = co.ref(Folder)
  deleted = co.boolean
}

export class ReceiptList extends CoList.Of(co.ref(Receipt)) {}

export const ReceiptOrder = Order.make<Receipt>((a, b) => {
  if (a.date && b.date) {
    return Order.Date(b.date, a.date)
  } else if (a.date) {
    return 1
  } else if (b.date) {
    return -1
  }
  return 0
})
