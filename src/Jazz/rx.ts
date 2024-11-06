import { Rx } from "@effect-rx/rx-react"
import { Jazz } from "../Jazz"
import { Effect } from "effect"

const runtime = Rx.runtime(Jazz.Default).pipe(Rx.keepAlive)

export const authStateRx = runtime.subscribable(
  Jazz.use((_) => Effect.succeed(_.authState)),
)

export const jazzRx = runtime.rx(Jazz.jazz)
export const accountRx = Rx.mapResult(jazzRx, (_) => _.me)
