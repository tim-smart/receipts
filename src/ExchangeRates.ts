import { Cache, Effect, Exit, Layer, Schedule, Schema, Context } from "effect"
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/http"
import { TracerPropagationEnabled } from "effect/http/HttpClient"

/**
 * Latest exchange rates, as units of each currency per US dollar.
 */
export const RatesSnapshot = Schema.Struct({
  rates: Schema.Record(Schema.String, Schema.Finite),
  /** When the rates were published, in epoch milliseconds. */
  timestamp: Schema.Finite,
})
export type RatesSnapshot = typeof RatesSnapshot.Type

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

      const latest = yield* Cache.makeWith(
        (appId: string) =>
          client
            .get(`/latest.json`, {
              headers: {
                authorization: `Token ${appId}`,
              },
            })
            .pipe(
              Effect.flatMap(HttpClientResponse.schemaBodyJson(Rates)),
              Effect.scoped,
              Effect.map(({ rates, timestamp }): RatesSnapshot => ({
                rates,
                timestamp: timestamp * 1000,
              })),
            ),
        {
          // only cache successful lookups, so a failed request can be retried
          timeToLive: (exit) => (Exit.isSuccess(exit) ? "5 minutes" : 0),
          capacity: 2,
        },
      )

      return { latest: (appId: string) => Cache.get(latest, appId) } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(FetchHttpClient.layer),
  )
}

const Rates = Schema.Struct({
  base: Schema.String,
  timestamp: Schema.Finite,
  rates: Schema.Record(Schema.String, Schema.Finite),
})
