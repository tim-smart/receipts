import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform"
import { Cache, Cause, Effect, Schedule, Schema } from "effect"

export class ExchangeRates extends Effect.Service<ExchangeRates>()(
  "ExchangeRates",
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const client = (yield* HttpClient.HttpClient).pipe(
        HttpClient.mapRequest(
          HttpClientRequest.prependUrl("https://openexchangerates.org/api"),
        ),
        HttpClient.retryTransient({
          schedule: Schedule.spaced(1000),
        }),
        HttpClient.transformResponse(HttpClient.withTracerPropagation(false)),
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
            return yield* new Cause.NoSuchElementException()
          }
          const { rates } = yield* latest.get(appId)
          if (base === "USD") {
            return rates
          }
          const baseRate = yield* Effect.fromNullable(rates[base])
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
    dependencies: [FetchHttpClient.layer],
  },
) {}

const Rates = Schema.Struct({
  base: Schema.String,
  rates: Schema.Record({
    key: Schema.String,
    value: Schema.Number,
  }),
})
