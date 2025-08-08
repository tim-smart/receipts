import { Result, Atom } from "@effect-atom/atom-react"
import { Identity } from "@effect/experimental/EventLog"
import {
  Effect,
  Option,
  Redacted,
  Schema,
  Stream,
  SubscriptionRef,
} from "effect"

const storageKey = "receipts_auth"
const appName = "Receipts"

const IdentitySchema = Schema.parseJson(
  Schema.Struct({
    publicKey: Schema.String,
    privateKey: Schema.Redacted(Schema.Uint8Array),
  }),
)

export class Auth extends Effect.Service<Auth>()("Auth", {
  effect: Effect.gen(function* () {
    const get = Effect.sync(() =>
      Schema.decodeUnknownOption(IdentitySchema)(
        localStorage.getItem(storageKey),
      ),
    )
    const state = yield* SubscriptionRef.make(yield* get)

    const create = (options: { readonly username: string }) =>
      Effect.gen(function* () {
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
        localStorage[storageKey] = Schema.encodeSync(IdentitySchema)(identity)
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
      localStorage[storageKey] = Schema.encodeSync(IdentitySchema)(identity)
      yield* SubscriptionRef.set(state, Option.some(identity))
    })

    const logout = Effect.gen(function* () {
      localStorage.removeItem(storageKey)
      location.reload()
    })

    return { state: state.changes, create, login, logout } as const
  }),
}) {}

// atom

const runtime = Atom.runtime(Auth.Default)

export const identityAtom = runtime
  .atom(
    Auth.pipe(
      Effect.map((auth) => auth.state),
      Stream.unwrap,
    ),
  )
  .pipe(
    Atom.map(Result.getOrElse(() => Option.none<typeof Identity.Service>())),
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
