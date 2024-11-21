import { Schema } from "effect"
import { ReceiptGroupIdJson } from "./ReceiptGroup"

export class Setting<
  const Name extends string,
  S extends Schema.Schema.AnyNoContext,
> {
  constructor(
    readonly name: Name,
    readonly schema: S,
  ) {}

  readonly json: Schema.Schema<S["Type"], string, S["Context"]> =
    Schema.parseJson(this.schema)

  readonly encodeSync = Schema.encodeSync(this.json)
  readonly decode = Schema.decode(this.json)
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
