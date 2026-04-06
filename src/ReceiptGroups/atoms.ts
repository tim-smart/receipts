import { ReceiptGroupRepo } from "./Repo"
import { Layer, Result, Stream } from "effect"
import { eventLogAtom } from "@/EventLog"
import { Atom } from "effect/unstable/reactivity"
import { constVoid } from "effect/Function"

const runtime = Atom.runtime((get) =>
  ReceiptGroupRepo.layer.pipe(Layer.provide(get(eventLogAtom.layer))),
)

export const receiptGroupsAtom = runtime
  .atom(ReceiptGroupRepo.useSync((_) => _.stream).pipe(Stream.unwrap))
  .pipe(Atom.keepAlive)

export const currentGroupAtom = runtime
  .atom(
    ReceiptGroupRepo.useSync((_) => _.current).pipe(
      Stream.unwrap,
      Stream.filterMap(Result.fromOption(constVoid)),
    ),
  )
  .pipe(Atom.keepAlive)
