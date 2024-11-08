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

  return OpenAiCompletions.layer({
    model,
  }).pipe(
    Layer.provideMerge(
      Layer.effect(
        OpenAiClient.OpenAiClient,
        OpenAiClient.make({
          apiKey,
          transformClient: HttpClient.retryTransient({
            schedule: Schedule.spaced("10 seconds"),
          }),
        }),
      ),
    ),
  )
}).pipe(Layer.unwrapEffect, Layer.provide(FetchHttpClient.layer))

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
      })

    return { extractReceipt } as const
  }),
  dependencies: [OpenAiLive],
}) {}

const inputFromBlob = (blob: Blob) =>
  Effect.gen(function* () {
    const buffer = yield* Effect.promise(() => blob.arrayBuffer())
    const part = new AiInput.ImagePart({
      image: {
        data: new Uint8Array(buffer),
        contentType: blob.type,
      },
      quality: "auto",
    })
    return AiInput.make(part)
  })

class ReceiptMeta extends Schema.Class<ReceiptMeta>("ReceiptMeta")(
  {
    date: Schema.NullOr(
      Schema.DateTimeUtc.annotations({
        description: "The date of the purchase, only if it can be found",
      }),
    ),
    merchant: Schema.String.annotations({
      description: "The store / merchant the sold the goods or service",
    }),
    description: Schema.String.annotations({
      description:
        "A short description of the goods / services that were purchased",
    }),
    amount: Schema.BigDecimal.annotations({
      description: "The total cost from the receipt",
    }),
  },
  { description: "Extracted information from a receipt" },
) {}