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

export const receiptAtom = Atom.family((id: string) =>
  runtime.atom(
    ReceiptRepo.useSync((_) => _.byId(ReceiptId.make(uuidBytes(id)))).pipe(
      Stream.unwrap,
    ),
  ),
)

export const exportReceiptsAtom = runtime.fn(
  (options: {
    readonly groupId: typeof ReceiptGroupId.Type
    readonly rates?: Record<string, number>
    readonly currency?: string
  }) => ReceiptRepo.use((_) => _.exportForGroup(options)),
)
