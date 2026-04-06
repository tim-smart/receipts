import {
  IndexedDb,
  IndexedDbDatabase,
  IndexedDbVersion,
} from "@effect/platform-browser"
import { ImagesTable } from "./Images/Table"
import { ReceiptGroupsTable } from "./ReceiptGroups/Table"
import { ReceiptsTable } from "./Receipts/Table"
import { SettingsTable } from "./Settings/Table"
import { Effect, Layer, ServiceMap } from "effect"
import { ReceiptGroup, ReceiptGroupId } from "./Domain/ReceiptGroup"
import { currentGroupId, openaiModel } from "./Domain/Setting"

export class V1 extends IndexedDbVersion.make(
  ImagesTable,
  ReceiptGroupsTable,
  ReceiptsTable,
  SettingsTable,
) {}

const initialReceiptGroupId = ReceiptGroupId.make(
  new Uint8Array([
    172, 114, 16, 212, 180, 1, 69, 189, 128, 6, 188, 134, 153, 205, 49, 21,
  ]),
)

export class Database extends IndexedDbDatabase.make(
  V1,
  Effect.fn(function* (api) {
    yield* api.createObjectStore("images")
    yield* api.createIndex("images", "receiptId")

    yield* api.createObjectStore("receiptGroups")
    yield* api.createIndex("receiptGroups", "name")

    yield* api.createObjectStore("receipts")
    yield* api.createIndex("receipts", "groupIdSort")
    yield* api.createIndex("receipts", "processed")

    yield* api.createObjectStore("settings")

    yield* api.from("receiptGroups").insert(
      ReceiptGroup.insert.make({
        id: initialReceiptGroupId,
        name: "My Receipts",
      }),
    )
    yield* api.from("settings").insertAll([
      {
        name: currentGroupId.name,
        json: currentGroupId.encodeSync(initialReceiptGroupId),
      },
      {
        name: openaiModel.name,
        json: openaiModel.encodeSync("gpt-5.4"),
      },
    ])
  }),
) {}

export const layerIndexeddb = Database.layer("receipts").pipe(
  Layer.provide(IndexedDb.layerWindow),
)

export class QueryBuilder extends ServiceMap.Service<QueryBuilder>()(
  "receipts/IndexedDb/QueryBuilder",
  {
    make: Database.getQueryBuilder,
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(layerIndexeddb),
  )
}
