import { ReceiptsAccount } from "@/Domain/Account"
import { Effect, Stream } from "effect"
import { createJazzReactApp } from "jazz-react"
import { CoValue, DeeplyLoaded, DepthsIn } from "jazz-tools"
import { subscribeToExistingCoValue } from "jazz-tools/src/internal.js"

export const {
  Provider,
  useAccount,
  useCoState,
  useAcceptInvite,
  useAccountOrGuest,
} = createJazzReactApp({
  AccountSchema: ReceiptsAccount,
})

export const coStream = <V extends CoValue, Depth>(
  existing: V,
  depth: Depth & DepthsIn<V> = [] as any,
): Stream.Stream<DeeplyLoaded<V, Depth>> =>
  Stream.asyncPush((emit) =>
    Effect.acquireRelease(
      Effect.sync(() =>
        subscribeToExistingCoValue(existing, depth, (value) =>
          emit.single(value),
        ),
      ),
      Effect.sync,
    ),
  )
