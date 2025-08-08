import { AiWorkerLive } from "@/AiWorker"
import { identityAtom } from "@/Auth"
import { openaiApiKey, openaiModel } from "@/Domain/Setting"
import { eventLogAtom } from "@/EventLog"
import { settingAtom } from "@/Settings/atoms"
import { Atom } from "@effect-atom/atom-react"
import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai"
import { FetchHttpClient, HttpClient } from "@effect/platform"
import { Effect, Layer, Schedule } from "effect"

export const aiWorkerAtom = Atom.runtime((get) =>
  Effect.gen(function* () {
    yield* get.some(identityAtom)
    const apiKey = yield* get.some(settingAtom(openaiApiKey))
    const model = yield* get.some(settingAtom(openaiModel))

    const ClientLive = OpenAiClient.layer({
      apiKey,
      transformClient: HttpClient.retryTransient({
        schedule: Schedule.spaced("1 second"),
      }),
    }).pipe(Layer.provide(FetchHttpClient.layer))
    const CompletionsLive = OpenAiLanguageModel.layer({ model }).pipe(
      Layer.provide(ClientLive),
    )

    return AiWorkerLive.pipe(
      Layer.provide([CompletionsLive, get(eventLogAtom.layer)]),
    )
  }).pipe(Layer.unwrapEffect),
).pipe(Atom.setIdleTTL("10 seconds"))
