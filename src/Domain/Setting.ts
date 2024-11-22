import { Schema } from "effect"
import { ReceiptGroupIdJson } from "./ReceiptGroup"

export class Setting<
  const Name extends string,
  S extends Schema.Schema.AnyNoContext,
> {
  constructor(
    readonly name: Name,
    readonly schema: S,
  ) {
    this.json = Schema.parseJson(schema)
    this.encodeSync = Schema.encodeSync(this.json)
    this.decode = Schema.decode(this.json)
  }
  readonly json: Schema.Schema<S["Type"], string, S["Context"]>
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
  Schema.NonEmptyTrimmedString,
)

export const openExchangeApiKey = new Setting(
  "openExchangeApiKey",
  Schema.Redacted(Schema.String),
)
