import { Atom } from "@effect-atom/atom-react"
import { ReceiptRepo } from "./Repo"
import { Effect, Layer, Stream } from "effect"
import { eventLogAtom } from "@/EventLog"
import { Receipt, ReceiptId } from "@/Domain/Receipt"
import * as Uuid from "uuid"
import { ReceiptGroupId } from "@/Domain/ReceiptGroup"

const runtime = Atom.runtime((get) =>
  ReceiptRepo.Default.pipe(Layer.provide(get(eventLogAtom.layer))),
)

export const currentReceiptsAtom = runtime.atom(
  ReceiptRepo.pipe(
    Effect.map((_) => _.current),
    Stream.unwrap,
  ),
)

export const receiptAtom = Atom.family((id: string) =>
  runtime.atom(
    ReceiptRepo.pipe(
      Effect.map((_) => _.byId(ReceiptId.make(Uuid.parse(id)))),
      Stream.unwrap,
    ),
  ),
)

export const exportReceiptsAtom = runtime.fn(
  (options: {
    readonly groupId: typeof ReceiptGroupId.Type
    readonly rates?: Record<string, number>
    readonly currency?: string
  }) => ReceiptRepo.pipe(Effect.flatMap((_) => _.exportForGroup(options))),
)

export const createReceiptAtom = runtime.fn((id: typeof Receipt.insert.Type) =>
  ReceiptRepo.pipe(Effect.flatMap((_) => _.create(id))),
)

export const updateReceiptAtom = runtime.fn((id: typeof Receipt.update.Type) =>
  ReceiptRepo.pipe(Effect.flatMap((_) => _.update(id))),
)

export const removeReceiptAtom = runtime.fn((id: typeof ReceiptId.Type) =>
  ReceiptRepo.pipe(Effect.flatMap((_) => _.remove(id))),
)
