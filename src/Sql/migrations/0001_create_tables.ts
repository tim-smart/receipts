import { ReceiptGroupId } from "@/Domain/ReceiptGroup"
import { currentGroupId } from "@/Domain/Setting"
import { SqlClient } from "@effect/sql"
import { Effect } from "effect"

const initialReceiptGroupId = ReceiptGroupId.make(
  new Uint8Array([
    172, 114, 16, 212, 180, 1, 69, 189, 128, 6, 188, 134, 153, 205, 49, 21,
  ]),
)

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE settings (
      name TEXT PRIMARY KEY,
      json TEXT NOT NULL
    )
  `

  yield* sql`INSERT INTO settings ${sql.insert([
    {
      name: "currentGroupId",
      json: currentGroupId.encodeSync(initialReceiptGroupId),
    },
    {
      name: "openAiModel",
      json: JSON.stringify("gpt-4o"),
    },
  ])}`

  yield* sql`
    CREATE TABLE receipt_groups (
      id BLOB PRIMARY KEY,
      name TEXT NOT NULL,
      default_currency TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `

  yield* sql`INSERT INTO receipt_groups ${sql.insert([
    {
      id: initialReceiptGroupId,
      name: "My Receipts",
      defaultCurrency: "USD",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ])}`

  yield* sql`
    CREATE TABLE receipts (
      id BLOB PRIMARY KEY,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      merchant TEXT NOT NULL,
      amount TEXT NOT NULL,
      currency TEXT NOT NULL,
      processed INTEGER NOT NULL,
      group_id BLOB NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `

  yield* sql`
    CREATE TABLE images (
      id BLOB PRIMARY KEY,
      receipt_id BLOB NOT NULL,
      data BLOB NOT NULL,
      content_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `
})
