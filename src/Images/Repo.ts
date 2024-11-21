import { Image } from "@/Domain/Image"
import { ReceiptId } from "@/Domain/Receipt"
import { EventLogClient } from "@/EventLog"
import { SqlLive } from "@/Sql"
import { SqlClient } from "@effect/sql"
import { Effect, Schema } from "effect"

export class ImagesRepo extends Effect.Service<ImagesRepo>()(
  "Images/ImagesRepo",
  {
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const client = yield* EventLogClient

      const forReceipt = (receiptId: typeof ReceiptId.Type) =>
        sql`select * from images where receipt_id = ${receiptId}`.pipe(
          Effect.flatMap(Schema.decodeUnknown(Image.Array)),
        )

      const create = (image: typeof Image.insert.Type) =>
        client("ImageCreate", image)

      return { forReceipt, create } as const
    }),
    dependencies: [SqlLive, EventLogClient.Default],
  },
) {}
