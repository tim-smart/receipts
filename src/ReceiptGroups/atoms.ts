import { Atom } from "@effect-atom/atom-react"
import { ReceiptGroupRepo } from "./Repo"
import { Effect, identity, Layer, Stream } from "effect"
import { eventLogAtom } from "@/EventLog"
import { ReceiptGroup, ReceiptGroupId } from "@/Domain/ReceiptGroup"

const runtime = Atom.runtime((get) =>
  ReceiptGroupRepo.Default.pipe(Layer.provide(get(eventLogAtom.layer))),
)

export const receiptGroupsAtom = runtime.atom(
  ReceiptGroupRepo.pipe(
    Effect.map((_) => _.stream),
    Stream.unwrap,
  ),
)

export const currentGroupAtom = runtime.atom(
  ReceiptGroupRepo.pipe(
    Effect.map((_) => _.current),
    Stream.unwrap,
    Stream.filterMap(identity),
  ),
)

export const createGroupAtom = runtime.fn(
  (_: typeof ReceiptGroup.insert.Type) =>
    Effect.gen(function* () {
      const repo = yield* ReceiptGroupRepo
      return yield* repo.create(_)
    }),
)

export const updateGroupAtom = runtime.fn(
  (_: typeof ReceiptGroup.update.Type) =>
    Effect.gen(function* () {
      const repo = yield* ReceiptGroupRepo
      return yield* repo.update(_)
    }),
)

export const removeGroupAtom = runtime.fn((_: typeof ReceiptGroupId.Type) =>
  Effect.gen(function* () {
    const repo = yield* ReceiptGroupRepo
    return yield* repo.remove(_)
  }),
)
