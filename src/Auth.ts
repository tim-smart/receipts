import {
  Effect,
  Layer,
  Option,
  Redacted,
  ServiceMap,
  Stream,
  SubscriptionRef,
} from "effect"
import { EventLog } from "effect/unstable/eventlog"
import { Identity } from "effect/unstable/eventlog/EventLog"
import { AsyncResult, Atom } from "effect/unstable/reactivity"

const storageKey = "receipts_auth"
const appName = "Receipts"

export class Auth extends ServiceMap.Service<Auth>()("Auth", {
  make: Effect.gen(function* () {
    const get = Effect.sync(() =>
      EventLog.decodeIdentityString(localStorage.getItem(storageKey) ?? ""),
    ).pipe(Effect.sandbox, Effect.option)
    const state = yield* SubscriptionRef.make(yield* get)

    const create = Effect.fnUntraced(function* (options: {
      readonly username: string
    }) {
      const secret = crypto.getRandomValues(new Uint8Array(32))
      const credential = yield* Effect.promise(() =>
        navigator.credentials.create({
          publicKey: {
            challenge: Uint8Array.from([0, 1, 2]),
            rp: {
              name: appName,
              id: location.hostname,
            },
            user: {
              id: secret,
              name: options.username + ` (${new Date().toLocaleString()})`,
              displayName: options.username,
            },
            pubKeyCredParams: [{ alg: -7, type: "public-key" }],
            authenticatorSelection: {
              authenticatorAttachment: "platform",
              residentKey: "required",
              requireResidentKey: true,
            },
            timeout: 60000,
            attestation: "direct",
          },
        }),
      )
      if (!credential) return
      const identity = Identity.of({
        publicKey: credential.id,
        privateKey: Redacted.make(secret),
      })

      localStorage[storageKey] = EventLog.encodeIdentityString(identity)
      yield* SubscriptionRef.set(state, Option.some(identity))
    })

    const login = Effect.gen(function* () {
      const credential = yield* Effect.promise(() =>
        navigator.credentials.get({
          publicKey: {
            challenge: Uint8Array.from([0, 1, 2]),
            rpId: location.hostname,
            allowCredentials: [],
            timeout: 60000,
          },
        }),
      )
      if (!credential) return
      const {
        response: { userHandle },
      } = credential as unknown as { response: { userHandle: ArrayBuffer } }
      const secret = new Uint8Array(userHandle)
      const identity = Identity.of({
        publicKey: credential.id,
        privateKey: Redacted.make(secret),
      })
      localStorage[storageKey] = EventLog.encodeIdentityString(identity)
      yield* SubscriptionRef.set(state, Option.some(identity))
    })

    const logout = Effect.gen(function* () {
      localStorage.removeItem(storageKey)
      location.reload()
    })

    return {
      state: SubscriptionRef.changes(state),
      create,
      login,
      logout,
    } as const
  }),
}) {
  static readonly layer = Layer.effect(Auth, this.make)
}

// atom

const runtime = Atom.runtime(Auth.layer)

export const identityAtom = runtime
  .atom(Auth.useSync((_) => _.state).pipe(Stream.unwrap))
  .pipe(
    Atom.map(
      AsyncResult.getOrElse(() => Option.none<typeof Identity.Service>()),
    ),
    Atom.keepAlive,
  )

export const loginAtom = runtime.fn(() =>
  Effect.gen(function* () {
    const auth = yield* Auth
    yield* auth.login
  }),
)

export const createAccountAtom = runtime.fn((username: string) =>
  Effect.gen(function* () {
    const auth = yield* Auth
    yield* auth.create({ username })
  }),
)

export const logoutAtom = runtime.fn(() =>
  Effect.gen(function* () {
    const auth = yield* Auth
    yield* auth.logout
  }),
)
