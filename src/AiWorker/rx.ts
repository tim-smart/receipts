import { AiWorkerLive } from "@/AiWorker"
import { openaiApiKey, openaiModel } from "@/Domain/Setting"
import { eventLogRx } from "@/EventLog"
import { settingRx } from "@/Settings/rx"
import { Rx } from "@effect-rx/rx-react"
import { OpenAiClient, OpenAiCompletions } from "@effect/ai-openai"
import { FetchHttpClient, HttpClient } from "@effect/platform"
import { Effect, Layer, Schedule } from "effect"

export const aiWorkerRx = Rx.runtime((get) =>
  Effect.gen(function* () {
    const apiKey = yield* get.some(settingRx(openaiApiKey))
    const model = yield* get.some(settingRx(openaiModel))

    const ClientLive = OpenAiClient.layer({
      apiKey,
      transformClient: HttpClient.retryTransient({
        schedule: Schedule.spaced("1 second"),
      }),
    }).pipe(Layer.provide(FetchHttpClient.layer))
    const CompletionsLive = OpenAiCompletions.layer({ model }).pipe(
      Layer.provide(ClientLive),
    )

    return AiWorkerLive.pipe(
      Layer.provide([CompletionsLive, get(eventLogRx.layer)]),
    )
  }).pipe(Layer.unwrapEffect),
).pipe(Rx.setIdleTTL("10 seconds"))
