import { ReceiptRepo } from "./Repo"
import { Layer, Stream } from "effect"
import { eventLogAtom } from "@/EventLog"
import { ReceiptId } from "@/Domain/Receipt"
import { ReceiptGroupId } from "@/Domain/ReceiptGroup"
import { Atom } from "effect/unstable/reactivity"
import { uuidBytes } from "@/lib/utils"

const runtime = Atom.runtime((get) =>
  ReceiptRepo.layer.pipe(Layer.provide(get(eventLogAtom.layer))),
)

export const currentReceiptsAtom = runtime.atom(
  ReceiptRepo.useSync((_) => _.current).pipe(Stream.unwrap),
)

export const receiptAtom = Atom.family((id: string) => {
  const receiptId = ReceiptId.make(uuidBytes(id))
  return runtime
    .atom(ReceiptRepo.useSync((_) => _.byId(receiptId)).pipe(Stream.unwrap))
    .pipe(Atom.setIdleTTL(5000))
})

export const exportReceiptsAtom = runtime.fn(
  (options: {
    readonly groupId: typeof ReceiptGroupId.Type
    readonly rates?: Record<string, number>
    readonly currency?: string
  }) => ReceiptRepo.use((_) => _.exportForGroup(options)),
)
