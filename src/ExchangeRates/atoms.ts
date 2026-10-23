import { ExchangeRates, RatesSnapshot } from "@/ExchangeRates"
import { kvsRuntime } from "@/lib/utils"
import { openExchangeApiKey } from "@/Domain/Setting"
import { settingAtom } from "@/Settings/atoms"
import { Effect, Option, Redacted, Schema } from "effect"
import { Atom } from "effect/reactivity"

const runtime = Atom.runtime(ExchangeRates.layer)

export interface Rates extends RatesSnapshot {
  /** True when the latest rates couldn't be fetched and saved ones are used. */
  readonly stale: boolean
}

const storageKey = "receipts_exchange_rates"
const SavedRates = Schema.fromJsonString(RatesSnapshot)

// storage can throw (quota, private browsing), which must not block the rates
const save = (snapshot: RatesSnapshot) =>
  Schema.encodeEffect(SavedRates)(snapshot).pipe(
    Effect.flatMap((json) =>
      Effect.try(() => localStorage.setItem(storageKey, json)),
    ),
    Effect.ignore,
  )

const loadSaved = Effect.try(() => localStorage.getItem(storageKey)).pipe(
  Effect.flatMap(Schema.decodeUnknownEffect(SavedRates)),
  Effect.map((snapshot): Rates => ({ ...snapshot, stale: true })),
)

/**
 * Changes when the app comes back into view or the device reconnects, so the
 * rates are fetched again. Lookups are cached for 5 minutes.
 */
const refreshSignal = Atom.readable((get) => {
  let count = 0
  const update = () => {
    if (document.visibilityState === "visible") get.setSelf(++count)
  }
  window.addEventListener("visibilitychange", update)
  window.addEventListener("online", update)
  get.addFinalizer(() => {
    window.removeEventListener("visibilitychange", update)
    window.removeEventListener("online", update)
  })
  return count
})

/**
 * The latest rates for an Open Exchange Rates app id. Falls back to the last
 * rates saved on this device when they can't be fetched.
 */
export const ratesAtom = Atom.family((appId: string) =>
  runtime
    .atom(
      ExchangeRates.use((_) => _.latest(appId)).pipe(
        Effect.tap(save),
        Effect.map((snapshot): Rates => ({ ...snapshot, stale: false })),
        Effect.catchCause(() => loadSaved),
      ),
    )
    .pipe(Atom.makeRefreshOnSignal(refreshSignal)),
)

export type RatesState =
  | { readonly _tag: "NoKey" }
  | { readonly _tag: "Unavailable" }
  | { readonly _tag: "Available"; readonly rates: Rates }

/**
 * Rates for the Open Exchange Rates key in settings. `Unavailable` means a
 * key is set but no rates could be fetched and none were saved.
 */
export const currentRatesAtom = Atom.make(
  Effect.fnUntraced(function* (get) {
    const appId = (yield* get.result(settingAtom(openExchangeApiKey))).pipe(
      Option.map(Redacted.value),
      Option.filter((key) => key.trim() !== ""),
    )
    if (Option.isNone(appId)) return { _tag: "NoKey" } as RatesState
    return yield* get.result(ratesAtom(appId.value)).pipe(
      Effect.match({
        onFailure: (): RatesState => ({ _tag: "Unavailable" }),
        onSuccess: (rates): RatesState => ({ _tag: "Available", rates }),
      }),
    )
  }),
)

/**
 * The currency each folder's totals are shown in on this device, keyed by
 * folder id. Folders without an entry use their default currency.
 */
export const viewCurrenciesAtom = Atom.kvs({
  runtime: kvsRuntime,
  key: "receipts_view_currency",
  schema: Schema.Record(Schema.String, Schema.String),
  defaultValue: (): Record<string, string> => ({}),
})
