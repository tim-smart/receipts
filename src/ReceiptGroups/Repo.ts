import { currentGroupId } from "@/Domain/Setting"
import { QueryBuilder } from "@/IndexedDb"
import { SettingRepo } from "@/Settings/Repo"
import { Array, Effect, Layer, Option, Context } from "effect"
import { Reactivity } from "effect/reactivity"

export class ReceiptGroupRepo extends Context.Service<ReceiptGroupRepo>()(
  "ReceiptGroups/ReceiptGroupRepo",
  {
    make: Effect.gen(function* () {
      const settings = yield* SettingRepo
      const reactivity = yield* Reactivity.Reactivity
      const db = yield* QueryBuilder
      const receiptGroups = db.from("receiptGroups")
      const byName = receiptGroups.select("name")

      const all = byName

      const stream = byName.reactive(["receipt_groups"])

      const current = reactivity.stream(
        ["receipt_groups", "settings"],
        Effect.gen(function* () {
          const groupId = yield* settings.get(currentGroupId)
          const selected = yield* Option.match(groupId, {
            onNone: () => Effect.succeedNone,
            onSome: (id) =>
              receiptGroups
                .select()
                .equals(id)
                .first()
                .pipe(Effect.catchNoSuchElement),
          })
          // the selected group can be removed, e.g. by a data reset
          return Option.isSome(selected)
            ? selected
            : yield* all.pipe(Effect.map(Array.head))
        }),
      )

      return { stream, current } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide([Reactivity.layer, QueryBuilder.layer, SettingRepo.layer]),
  )
}
