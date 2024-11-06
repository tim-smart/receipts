import { Effect, SubscriptionRef } from "effect"
import { BrowserPasskeyAuth, createJazzBrowserContext } from "jazz-browser"
import { ReceiptsAccount } from "./Domain/Account"
import { PasskeyAuthState } from "jazz-react/src/auth/PasskeyAuth"

export class Jazz extends Effect.Service<Jazz>()("Jazz", {
  accessors: true,
  scoped: Effect.gen(function* () {
    const authState = yield* SubscriptionRef.make<PasskeyAuthState>({
      state: "uninitialized",
      errors: [],
    })

    const auth = new BrowserPasskeyAuth(
      {
        onReady(next) {
          Effect.runFork(
            SubscriptionRef.set(authState, {
              ...next,
              state: "ready",
              errors: [],
            }),
          )
        },
        onError(error) {
          Effect.runFork(
            SubscriptionRef.update(authState, (state) => ({
              ...state,
              errors: [...state.errors, error.toString()],
            })),
          )
        },
        onSignedIn(next) {
          Effect.runFork(
            SubscriptionRef.set(authState, {
              state: "signedIn",
              logOut: () => {
                next.logOut()
                Effect.runFork(
                  SubscriptionRef.set(authState, {
                    state: "loading",
                    errors: [],
                  }),
                )
              },
              errors: [],
            }),
          )
        },
      },
      "Receipts",
    )

    const promise = createJazzBrowserContext({
      peer: "wss://cloud.jazz.tools/?key=hello@timsmart.co",
      AccountSchema: ReceiptsAccount,
      auth,
      storage: "indexedDB",
    })
    const context = yield* Effect.promise(() => promise).pipe(Effect.cached)
    yield* Effect.addFinalizer(() =>
      context.pipe(Effect.andThen((_) => _.done())),
    )

    return { jazz: context, authState } as const
  }).pipe(Effect.annotateLogs({ service: "Jazz" })),
}) {}
