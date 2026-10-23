import { Cache, Effect, Exit, Layer, Schedule, Schema, Context } from "effect"
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/http"
import { TracerPropagationEnabled } from "effect/http/HttpClient"
import { KeyValueStore } from "effect/persistence"
import { BrowserKeyValueStore } from "@effect/platform-browser"

/**
 * Latest exchange rates, as units of each currency per US dollar.
 */
export const RatesSnapshot = Schema.Struct({
  rates: Schema.Record(Schema.String, Schema.Finite),
  /** When the rates were published, in epoch milliseconds. */
  timestamp: Schema.Finite,
})
export type RatesSnapshot = typeof RatesSnapshot.Type

export interface Rates extends RatesSnapshot {
  /** True when the latest rates couldn't be fetched and saved ones are used. */
  readonly stale: boolean
}

const savedKey = "receipts_exchange_rates"

export class ExchangeRates extends Context.Service<ExchangeRates>()(
  "ExchangeRates",
  {
    make: Effect.gen(function* () {
      const client = (yield* HttpClient.HttpClient).pipe(
        HttpClient.mapRequest(
          HttpClientRequest.prependUrl("https://openexchangerates.org/api"),
        ),
        HttpClient.retryTransient({
          schedule: Schedule.spaced(1000),
          times: 2,
        }),
        HttpClient.transformResponse(
          Effect.provideService(TracerPropagationEnabled, false),
        ),
      )
      // the last fetched rates are kept on the device for offline use
      const saved = KeyValueStore.toSchemaStore(
        yield* KeyValueStore.KeyValueStore,
        RatesSnapshot,
      )

      const latest = yield* Cache.makeWith(
        (appId: string) =>
          client
            .get(`/latest.json`, {
              headers: {
                authorization: `Token ${appId}`,
              },
            })
            .pipe(
              Effect.flatMap(HttpClientResponse.schemaBodyJson(LatestJson)),
              Effect.scoped,
              Effect.map(({ rates, timestamp }): RatesSnapshot => ({
                rates,
                timestamp: timestamp * 1000,
              })),
              // storage can fail (quota, private browsing), which must not
              // block the rates
              Effect.tap((snapshot) =>
                saved.set(savedKey, snapshot).pipe(Effect.ignore),
              ),
              Effect.map((snapshot): Rates => ({ ...snapshot, stale: false })),
            ),
        {
          // only cache successful lookups, so a failed request can be retried
          timeToLive: (exit) => (Exit.isSuccess(exit) ? "5 minutes" : 0),
          capacity: 2,
        },
      )

      const loadSaved = saved.get(savedKey).pipe(
        Effect.flatMap(Effect.fromOption),
        Effect.map((snapshot): Rates => ({ ...snapshot, stale: true })),
      )

      return {
        /**
         * The latest rates for an Open Exchange Rates app id, or the last
         * rates saved on this device when they can't be fetched.
         */
        latest: (appId: string) =>
          Cache.get(latest, appId).pipe(Effect.catchCause(() => loadSaved)),
      } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide([
      FetchHttpClient.layer,
      BrowserKeyValueStore.layerLocalStorage,
    ]),
  )
}

const LatestJson = Schema.Struct({
  base: Schema.String,
  timestamp: Schema.Finite,
  rates: Schema.Record(Schema.String, Schema.Finite),
})
