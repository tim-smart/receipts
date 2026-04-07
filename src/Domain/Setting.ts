import { Redacted, Schema, SchemaGetter } from "effect"
import { ReceiptGroupIdJson } from "./ReceiptGroup"

export class Setting<const Name extends string, S extends Schema.Top> {
  constructor(
    readonly name: Name,
    readonly schema: S,
  ) {
    this.json = Schema.toCodecJson(schema) as any
    this.encode = Schema.encodeEffect(this.json)
    this.encodeSync = Schema.encodeSync(this.json)
    this.decode = Schema.decodeEffect(this.json)
  }
  readonly json: Schema.Codec<S["Type"], Schema.Json>
  readonly encode
  readonly encodeSync
  readonly decode
}

const RedactedSchema = <S extends Schema.Top>(schema: S) =>
  schema.pipe(
    Schema.decodeTo(Schema.Redacted(schema), {
      decode: SchemaGetter.transform(Redacted.make),
      encode: SchemaGetter.transform(Redacted.value),
    }),
  )

export const currentGroupId = new Setting("currentGroupId", ReceiptGroupIdJson)

export const openaiApiKey = new Setting(
  "openaiApiKey",
  RedactedSchema(Schema.String),
)
export const openaiModel = new Setting(
  "openaiModel",
  Schema.Trim.pipe(Schema.decodeTo(Schema.NonEmptyString)),
)

export const openExchangeApiKey = new Setting(
  "openExchangeApiKey",
  RedactedSchema(Schema.String),
)
