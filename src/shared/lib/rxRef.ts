import { Result, Rx, RxRef } from "@effect-rx/rx-react"

export const rxRefRx =
  (get: Rx.Context) =>
  <A>(ref: RxRef.RxRef<A>): A => {
    get.addFinalizer(
      ref.subscribe((_) => {
        console.log("changed", _)
        return get.setSelf(Result.success(_))
      }),
    )
    console.log("rx", ref, ref.value)
    return ref.value
  }
