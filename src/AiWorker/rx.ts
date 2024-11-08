import { OpenAiCreds } from "@/Ai"
import { AiWorkerLive, JazzAccount } from "@/AiWorker"
import { ReceiptsAccount } from "@/Domain/Account"
import { Rx } from "@effect-rx/rx-react"
import { Data, Layer, Redacted } from "effect"

export class AiWorkerConfig extends Data.Class<{
  readonly account: ReceiptsAccount
  readonly openaiApiKey: Redacted.Redacted
  readonly openaiModel: string
}> {}

export const aiWorkerRx = Rx.family((config: AiWorkerConfig) =>
  Rx.runtime(
    AiWorkerLive.pipe(
      Layer.provide(
        Layer.succeed(OpenAiCreds, {
          apiKey: config.openaiApiKey,
          model: config.openaiModel,
        }),
      ),
      Layer.provide(Layer.succeed(JazzAccount, config.account)),
    ),
  ),
)
