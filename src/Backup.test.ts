import { describe, expect, it } from "@effect/vitest"
import { BigDecimal, DateTime, Effect, Layer, Schema } from "effect"
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate"
import {
  BackupData,
  BackupStore,
  BackupWrite,
  exportBackup,
  importBackup,
} from "./Backup"
import { Image, ImageId } from "./Domain/Image"
import { Receipt, ReceiptId } from "./Domain/Receipt"
import { ReceiptGroup, ReceiptGroupId } from "./Domain/ReceiptGroup"
import { uuidBytes, uuidString } from "./lib/utils"

const at = (iso: string) => DateTime.makeUnsafe(iso)

const home = new ReceiptGroup({
  id: ReceiptGroupId.make(uuidBytes("0b6c1d2e-3f40-4a51-8b62-7c83d94ea5f6")),
  name: "Home",
  defaultCurrency: "NZD",
  createdAt: at("2026-01-02T03:04:05.000Z"),
  updatedAt: at("2026-02-03T04:05:06.000Z"),
})
const work = new ReceiptGroup({
  id: ReceiptGroupId.make(uuidBytes("1c7d2e3f-4051-4b62-9c73-8d94ea5fb607")),
  name: "Work",
  defaultCurrency: "USD",
  createdAt: at("2026-01-05T00:00:00.000Z"),
  updatedAt: at("2026-01-05T00:00:00.000Z"),
})

const groceries = new Receipt({
  id: ReceiptId.make(uuidBytes("2d8e3f40-5162-4c73-ad84-9ea5fb6c0718")),
  date: at("2026-03-04T00:00:00.000Z"),
  description: "Weekly shop — café & bakery",
  merchant: "Countdown",
  amount: BigDecimal.fromStringUnsafe("123.45"),
  currency: "NZD",
  processed: true,
  groupId: home.id,
  createdAt: at("2026-03-04T05:06:07.000Z"),
  updatedAt: at("2026-03-05T05:06:07.000Z"),
})
const taxi = new Receipt({
  id: ReceiptId.make(uuidBytes("3e9f4051-6273-4d84-be95-afb6c7d18229")),
  date: at("2026-04-01T00:00:00.000Z"),
  description: "",
  merchant: "Taxi",
  amount: BigDecimal.fromStringUnsafe("0.5"),
  currency: "USD",
  processed: false,
  groupId: work.id,
  createdAt: at("2026-04-01T10:00:00.000Z"),
  updatedAt: at("2026-04-01T10:00:00.000Z"),
})

// every byte value, so any text / encoding corruption shows up
const allBytes = Uint8Array.from({ length: 256 }, (_, i) => i)

const groceriesFront = new Image({
  id: ImageId.make(uuidBytes("4fa05162-7384-4e95-8fa6-b0c7d8e2933a")),
  receiptId: groceries.id,
  data: allBytes,
  contentType: "image/jpeg",
  createdAt: at("2026-03-04T05:06:08.000Z"),
  updatedAt: at("2026-03-04T05:06:08.000Z"),
})
const groceriesBack = new Image({
  id: ImageId.make(uuidBytes("50b16273-8495-4fa6-90b7-c1d8e9f3a44b")),
  receiptId: groceries.id,
  data: allBytes.slice().reverse(),
  contentType: "image/png",
  createdAt: at("2026-03-04T05:06:09.000Z"),
  updatedAt: at("2026-03-04T05:06:09.000Z"),
})
const taxiPhoto = new Image({
  id: ImageId.make(uuidBytes("61c27384-95a6-40b7-a1c8-d2e9f0a4b55c")),
  receiptId: taxi.id,
  data: new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x0a, 0x0d]),
  contentType: "image/webp",
  createdAt: at("2026-04-01T10:00:01.000Z"),
  updatedAt: at("2026-04-01T10:00:01.000Z"),
})

const fullData: BackupData = {
  groups: [home, work],
  receipts: [groceries, taxi],
  images: [groceriesFront, groceriesBack, taxiPhoto],
}
const emptyData: BackupData = { groups: [], receipts: [], images: [] }

const sortById = <A extends { readonly id: Uint8Array }>(
  items: ReadonlyArray<A>,
) => [...items].sort((a, b) => uuidString(a.id).localeCompare(uuidString(b.id)))

// compare encoded records, so equal values with different internal
// representations (e.g. a cached BigDecimal normalization) still match
const encodeGroup = Schema.encodeSync(Schema.toCodecJson(ReceiptGroup))
const encodeReceipt = Schema.encodeSync(Schema.toCodecJson(Receipt))
const encodeImage = Schema.encodeSync(Schema.toCodecJson(Image))

const normalize = (data: BackupData) => ({
  groups: sortById(data.groups).map((_) => encodeGroup(_)),
  receipts: sortById(data.receipts).map((_) => encodeReceipt(_)),
  images: sortById(data.images).map((_) => encodeImage(_)),
})

// In-memory BackupStore. Writes round-trip the payload through the event's
// payload schema, like the EventLog journal does, then apply it the way the
// app's event handlers do.
const makeStore = (initial: BackupData) => {
  const state = {
    groups: [...initial.groups],
    receipts: [...initial.receipts],
    images: [...initial.images],
  }
  const writes: Array<BackupWrite> = []
  const roundTrip = <S extends Schema.Codec<any, any>>(
    schema: S,
    value: S["Type"],
  ): Effect.Effect<S["Type"]> =>
    Schema.encodeEffect(schema)(value).pipe(
      Effect.flatMap(Schema.decodeEffect(schema)),
      Effect.orDie,
    )
  const layer = Layer.succeed(BackupStore)({
    snapshot: Effect.sync(() => ({
      groups: [...state.groups],
      receipts: [...state.receipts],
      images: [...state.images],
    })),
    write: Effect.fnUntraced(function* (write) {
      writes.push(write)
      switch (write.event) {
        case "GroupCreate": {
          const payload = yield* roundTrip(ReceiptGroup.insert, write.payload)
          state.groups.push(new ReceiptGroup(payload))
          break
        }
        case "ReceiptCreate": {
          const payload = yield* roundTrip(Receipt.insert, write.payload)
          state.receipts.push(new Receipt(payload))
          break
        }
        case "ImageCreate": {
          const payload = yield* roundTrip(Image.insert, write.payload)
          state.images.push(new Image(payload))
          break
        }
      }
    }),
  })
  return {
    layer,
    writes,
    snapshot: () => normalize(state),
  }
}

const exportFrom = (data: BackupData) =>
  exportBackup.pipe(Effect.provide(makeStore(data).layer))

const tamper = (
  backup: Blob,
  f: (entries: Record<string, Uint8Array>) => void,
): Effect.Effect<Blob> =>
  Effect.promise(async () => {
    const entries = unzipSync(new Uint8Array(await backup.arrayBuffer()))
    f(entries)
    return new Blob([zipSync(entries) as Uint8Array<ArrayBuffer>])
  })

const editJson =
  (f: (json: any) => void) => (entries: Record<string, Uint8Array>) => {
    const json = JSON.parse(strFromU8(entries["backup.json"]))
    f(json)
    entries["backup.json"] = strToU8(JSON.stringify(json))
  }

describe("Backup", () => {
  it.effect("restores all data and image bytes into an empty app", () =>
    Effect.gen(function* () {
      const backup = yield* exportFrom(fullData)
      const target = makeStore(emptyData)

      const summary = yield* importBackup(backup).pipe(
        Effect.provide(target.layer),
      )

      expect(target.snapshot()).toEqual(normalize(fullData))
      expect(summary).toEqual({
        groups: 2,
        receipts: 2,
        images: 3,
        skipped: 0,
      })
    }),
  )

  it.effect(
    "merges by id: existing records are kept and re-importing is a no-op",
    () =>
      Effect.gen(function* () {
        const backup = yield* exportFrom(fullData)
        const editedGroceries = new Receipt({
          ...groceries,
          merchant: "Edited locally",
        })
        const target = makeStore({
          groups: [home],
          receipts: [editedGroceries],
          images: [],
        })

        const first = yield* importBackup(backup).pipe(
          Effect.provide(target.layer),
        )

        expect(target.snapshot()).toEqual(
          normalize({
            ...fullData,
            receipts: [editedGroceries, taxi],
          }),
        )
        expect(first.skipped).toBe(2)

        const writesBefore = target.writes.length
        const second = yield* importBackup(backup).pipe(
          Effect.provide(target.layer),
        )

        expect(target.writes.length).toBe(writesBefore)
        expect(second).toEqual({
          groups: 0,
          receipts: 0,
          images: 0,
          skipped: 7,
        })
      }),
  )

  it.effect("rejects invalid backups without writing anything", () =>
    Effect.gen(function* () {
      const backup = yield* exportFrom(fullData)
      const invalid: Record<string, Blob> = {
        "not a zip": new Blob(["definitely not a zip file"]),
        "missing backup.json": yield* tamper(backup, (entries) => {
          delete entries["backup.json"]
        }),
        "unknown format": yield* tamper(
          backup,
          editJson((json) => {
            json.format = "something-else"
          }),
        ),
        "unsupported version": yield* tamper(
          backup,
          editJson((json) => {
            json.version = 2
          }),
        ),
        "invalid receipt": yield* tamper(
          backup,
          editJson((json) => {
            json.receipts[1].amount = "not a number"
          }),
        ),
        "missing image file": yield* tamper(backup, (entries) => {
          const json = JSON.parse(strFromU8(entries["backup.json"]))
          delete entries[json.images[2].path]
        }),
        "receipt references a missing group": yield* tamper(
          backup,
          editJson((json) => {
            json.groups = json.groups.slice(1)
          }),
        ),
      }

      for (const [name, file] of Object.entries(invalid)) {
        const target = makeStore({
          groups: [work],
          receipts: [taxi],
          images: [],
        })
        const error = yield* importBackup(file).pipe(
          Effect.provide(target.layer),
          Effect.flip,
        )

        expect(error._tag, name).toBe("BackupError")
        expect(target.writes, name).toEqual([])
      }
    }),
  )
})
