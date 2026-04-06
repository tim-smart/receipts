import { ReceiptGroupRepo } from "./Repo"
import { Effect, identity, Layer, Result, Stream } from "effect"
import { eventLogAtom } from "@/EventLog"
import { ReceiptGroup, ReceiptGroupId } from "@/Domain/ReceiptGroup"
import { Atom } from "effect/unstable/reactivity"
import { constVoid } from "effect/Function"

const runtime = Atom.runtime((get) =>
  ReceiptGroupRepo.layer.pipe(Layer.provide(get(eventLogAtom.layer))),
)

export const receiptGroupsAtom = runtime.atom(
  ReceiptGroupRepo.useSync((_) => _.stream).pipe(Stream.unwrap),
)

export const currentGroupAtom = runtime.atom(
  ReceiptGroupRepo.useSync((_) => _.current).pipe(
    Stream.unwrap,
    Stream.filterMap(Result.fromOption(constVoid)),
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
