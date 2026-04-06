import { currentGroupId } from "@/Domain/Setting"
import { QueryBuilder } from "@/IndexedDb"
import { SettingRepo } from "@/Settings/Repo"
import { Array, Effect, Layer, Option, ServiceMap } from "effect"
import { Reactivity } from "effect/unstable/reactivity"

export class ReceiptGroupRepo extends ServiceMap.Service<ReceiptGroupRepo>()(
  "ReceiptGroups/ReceiptGroupRepo",
  {
    make: Effect.gen(function* () {
      const settings = yield* SettingRepo
      const reactivity = yield* Reactivity.Reactivity
      const db = yield* QueryBuilder
      const receiptGroups = db.from("receiptGroups")
      const byName = receiptGroups.select("name")

      const all = byName.asEffect()

      const stream = byName.reactive(["receipt_groups"])

      const current = reactivity.stream(
        ["receipt_groups", "settings"],
        Effect.gen(function* () {
          const groupId = yield* settings.get(currentGroupId)
          return yield* Option.match(groupId, {
            onNone: () => all.pipe(Effect.map(Array.head)),
            onSome: (id) =>
              receiptGroups
                .select()
                .equals(id)
                .first()
                .asEffect()
                .pipe(Effect.option),
          })
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
