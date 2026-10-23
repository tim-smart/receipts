import { BackupStore } from "@/Backup"
import { EventLogClient } from "@/EventLog"
import { QueryBuilder } from "@/IndexedDb"
import { Effect, Layer } from "effect"

export const BackupStoreLive = Layer.effect(
  BackupStore,
  Effect.gen(function* () {
    const db = yield* QueryBuilder
    const client = yield* EventLogClient

    const snapshot = Effect.all(
      {
        groups: db.from("receiptGroups").select(),
        receipts: db.from("receipts").select(),
        images: db.from("images").select(),
      },
      { concurrency: "unbounded" },
    ).pipe(Effect.orDie)

    return BackupStore.of({
      snapshot,
      write: (write) => client(write).pipe(Effect.orDie),
    })
  }),
).pipe(Layer.provide(QueryBuilder.layer))
