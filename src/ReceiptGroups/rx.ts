import { Rx } from "@effect-rx/rx-react"
import { ReceiptGroupRepo } from "./Repo"
import { Effect, identity, Layer, Stream } from "effect"
import { eventLogRx } from "@/EventLog"
import { ReceiptGroup, ReceiptGroupId } from "@/Domain/ReceiptGroup"

const runtime = Rx.runtime((get) =>
  ReceiptGroupRepo.Default.pipe(Layer.provide(get(eventLogRx.layer))),
)

export const receiptGroupsRx = runtime.rx(
  ReceiptGroupRepo.pipe(
    Effect.map((_) => _.stream),
    Stream.unwrap,
  ),
)

export const currentGroupRx = runtime.rx(
  ReceiptGroupRepo.pipe(
    Effect.map((_) => _.current),
    Stream.unwrap,
    Stream.filterMap(identity),
  ),
)

export const createGroupRx = runtime.fn((_: typeof ReceiptGroup.insert.Type) =>
  Effect.gen(function* () {
    const repo = yield* ReceiptGroupRepo
    return yield* repo.create(_)
  }),
)

export const updateGroupRx = runtime.fn((_: typeof ReceiptGroup.update.Type) =>
  Effect.gen(function* () {
    const repo = yield* ReceiptGroupRepo
    return yield* repo.update(_)
  }),
)

export const removeGroupRx = runtime.fn((_: typeof ReceiptGroupId.Type) =>
  Effect.gen(function* () {
    const repo = yield* ReceiptGroupRepo
    return yield* repo.remove(_)
  }),
)
