import { Effect, Layer, Schema, Context } from "effect"
import { LanguageModel, Prompt } from "effect/unstable/ai"

export class AiHelpers extends Context.Service<AiHelpers>()("AiHelpers", {
  make: Effect.gen(function* () {
    const completions = yield* LanguageModel.LanguageModel

    const extractReceipt = (blob: Blob) =>
      Effect.gen(function* () {
        const input = yield* inputFromBlob(blob)
        const result = yield* completions.generateObject({
          prompt: input.pipe(
            Prompt.setSystem(`Extract receipt information from the provided image.

The current date is ${new Date().toDateString()}.`),
          ),
          schema: ReceiptMeta,
        })
        return result.value
      })

    return { extractReceipt } as const
  }),
}) {
  static readonly layer = Layer.effect(this, this.make)
}

const inputFromBlob = (blob: Blob) =>
  Effect.gen(function* () {
    const uint8Array = yield* Effect.promise(() =>
      blob.arrayBuffer().then((buffer) => new Uint8Array(buffer)),
    )
    const part = Prompt.makePart("file", {
      mediaType: blob.type,
      data: uint8Array,
    })
    const message = Prompt.makeMessage("user", {
      content: [part],
    })
    return Prompt.make([message])
  })

class ReceiptMeta extends Schema.Class<ReceiptMeta>("ReceiptMeta")(
  {
    date: Schema.NullOr(Schema.DateTimeUtcFromString).annotate({
      description:
        "The date of the purchase in the format YYYY-MM-DD, or null if not found",
    }),
    merchant: Schema.String.annotate({
      description: "The store / merchant that sold the goods or service",
    }),
    description: Schema.String.annotate({
      description: "A 1-5 word title describing the purchase",
    }),
    amount: Schema.BigDecimalFromString.annotate({
      jsonSchema: {
        type: "string",
        description:
          "The total cost from the receipt, excluding the currency. Include the numeric amount only.",
      },
    }),
    currency: Schema.NullOr(Schema.String).annotate({
      description: "The 3 letter currency code, e.g. USD, or null if not found",
    }),
  },
  {
    description: "Extracted information from a receipt.",
  },
) {}
