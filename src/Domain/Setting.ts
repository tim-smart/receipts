import { Schema } from "effect"
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

export const currentGroupId = new Setting("currentGroupId", ReceiptGroupIdJson)

export const openaiApiKey = new Setting(
  "openaiApiKey",
  Schema.Redacted(Schema.String),
)
export const openaiModel = new Setting(
  "openaiModel",
  Schema.Trim.pipe(Schema.decodeTo(Schema.NonEmptyString)),
)

export const openExchangeApiKey = new Setting(
  "openExchangeApiKey",
  Schema.Redacted(Schema.String),
)
