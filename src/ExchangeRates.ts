import { Cache, Cause, Effect, Layer, Schedule, Schema, Context } from "effect"
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http"
import { TracerPropagationEnabled } from "effect/unstable/http/HttpClient"

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
        }),
        HttpClient.transformResponse(
          Effect.provideService(TracerPropagationEnabled, false),
        ),
      )

      const latest = yield* Cache.make({
        lookup: (appId: string) =>
          client
            .get(`/latest.json`, {
              headers: {
                authorization: `Token ${appId}`,
              },
            })
            .pipe(
              Effect.flatMap(HttpClientResponse.schemaBodyJson(Rates)),
              Effect.scoped,
            ),
        timeToLive: "5 minutes",
        capacity: 2,
      })

      const rates = (appId: string, base: string) =>
        Effect.gen(function* () {
          if (base === "") {
            return yield* new Cause.NoSuchElementError()
          }
          const { rates } = yield* Cache.get(latest, appId)
          if (base === "USD") {
            return rates
          }
          const baseRate = yield* Effect.fromNullishOr(rates[base])
          const adjustment = 1 / baseRate
          return Object.fromEntries(
            Object.entries(rates).map(([key, value]) => [
              key,
              key === base ? 1 : value * adjustment,
            ]),
          )
        })

      return { rates } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(FetchHttpClient.layer),
  )
}

const Rates = Schema.Struct({
  base: Schema.String,
  rates: Schema.Record(Schema.String, Schema.Number),
})
