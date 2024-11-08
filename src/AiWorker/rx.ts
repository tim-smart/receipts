import { OpenAiCreds } from "@/Ai"
import { AiWorkerLive, JazzAccount } from "@/AiWorker"
import { ReceiptsAccount } from "@/Domain/Account"
import { Rx } from "@effect-rx/rx-react"
import { Data, Hash, Layer, Redacted } from "effect"

export class AiWorkerConfig extends Data.Class<{
  readonly account: ReceiptsAccount
  readonly openaiApiKey: Redacted.Redacted
  readonly openaiModel: string
}> {
  [Hash.symbol]() {
    return Hash.string(Redacted.value(this.openaiApiKey))
  }
}

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
  ).pipe(Rx.setIdleTTL("10 seconds")),
)
