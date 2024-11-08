import { CoList, CoMap, co } from "jazz-tools"
import { Receipt } from "./Receipt"

export class AiJob extends CoMap {
  receipt = co.ref(Receipt)
  processed = co.boolean
}

export class AiJobList extends CoList.Of(co.ref(AiJob)) {}
