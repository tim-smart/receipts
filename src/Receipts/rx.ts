import { Rx } from "@effect-rx/rx-react"
import { ReceiptRepo } from "./Repo"
import { Effect, Layer, Stream } from "effect"
import { eventLogRx } from "@/EventLog"
import { Receipt, ReceiptId } from "@/Domain/Receipt"
import * as Uuid from "uuid"
import { ReceiptGroupId } from "@/Domain/ReceiptGroup"

const runtime = Rx.runtime((get) =>
  ReceiptRepo.Default.pipe(Layer.provide(get(eventLogRx.layer))),
)

export const currentReceiptsRx = runtime.rx(
  ReceiptRepo.pipe(
    Effect.map((_) => _.current),
    Stream.unwrap,
  ),
)

export const receiptRx = Rx.family((id: string) =>
  runtime.rx(
    ReceiptRepo.pipe(
      Effect.map((_) => _.byId(ReceiptId.make(Uuid.parse(id)))),
      Stream.unwrap,
    ),
  ),
)

export const exportReceiptsRx = runtime.fn(
  (options: {
    readonly groupId: typeof ReceiptGroupId.Type
    readonly rates?: Record<string, number>
    readonly currency?: string
  }) => ReceiptRepo.pipe(Effect.flatMap((_) => _.exportForGroup(options))),
)

export const createReceiptRx = runtime.fn((id: typeof Receipt.insert.Type) =>
  ReceiptRepo.pipe(Effect.flatMap((_) => _.create(id))),
)

export const updateReceiptRx = runtime.fn((id: typeof Receipt.update.Type) =>
  ReceiptRepo.pipe(Effect.flatMap((_) => _.update(id))),
)

export const removeReceiptRx = runtime.fn((id: typeof ReceiptId.Type) =>
  ReceiptRepo.pipe(Effect.flatMap((_) => _.remove(id))),
)
