import { Context, Effect, Layer, Redacted, Schedule, Schema } from "effect"
import { AiInput, Completions } from "@effect/ai"
import { OpenAiClient, OpenAiCompletions } from "@effect/ai-openai"
import { FetchHttpClient, HttpClient } from "@effect/platform"

export class OpenAiCreds extends Context.Tag("OpenAiCreds")<
  OpenAiCreds,
  {
    readonly apiKey: Redacted.Redacted
    readonly model: string
  }
>() {}

const OpenAiLive = Effect.gen(function* () {
  const { apiKey, model } = yield* OpenAiCreds

  const ClientLive = OpenAiClient.layer({
    apiKey,
    transformClient: HttpClient.retryTransient({
      schedule: Schedule.spaced("1 seconds"),
    }),
  }).pipe(Layer.provide(FetchHttpClient.layer))

  return Layer.provide(OpenAiCompletions.layer({ model }), ClientLive)
}).pipe(Layer.unwrapEffect)

export class AiHelpers extends Effect.Service<AiHelpers>()("AiHelpers", {
  effect: Effect.gen(function* () {
    const completions = yield* Completions.Completions

    const extractReceipt = (blob: Blob) =>
      Effect.gen(function* () {
        const input = yield* inputFromBlob(blob)
        const result = yield* completions.structured({
          input,
          schema: ReceiptMeta,
        })
        return yield* result.value
      }).pipe(
        AiInput.provideSystem(`Extract receipt information from the provided image.

The current date is ${new Date().toDateString()}.`),
      )

    return { extractReceipt } as const
  }),
  dependencies: [OpenAiLive],
}) {}

const inputFromBlob = (blob: Blob) =>
  Effect.gen(function* () {
    const part = yield* AiInput.ImagePart.fromBlob(blob)
    return AiInput.make(part)
  })

class ReceiptMeta extends Schema.Class<ReceiptMeta>("ReceiptMeta")(
  {
    date: Schema.NullOr(Schema.DateTimeUtc).annotations({
      description:
        "The date of the purchase in the format YYYY-MM-DD, or null if not found",
    }),
    merchant: Schema.String.annotations({
      description: "The store / merchant that sold the goods or service",
    }),
    description: Schema.String.annotations({
      description: "1-5 words describing the purchase",
    }),
    amount: Schema.BigDecimal.annotations({
      jsonSchema: {
        type: "string",
        description:
          "The total cost from the receipt, excluding the currency. Include the numeric amount only.",
      },
    }),
    currency: Schema.NullOr(Schema.String).annotations({
      description: "The 3 letter currency code, e.g. USD, or null if not found",
    }),
  },
  {
    description: "Extracted information from a receipt.",
  },
) {}
