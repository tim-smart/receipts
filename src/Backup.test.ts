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
import { ImageRow } from "./Images/Events"
import { ReceiptGroupRow } from "./ReceiptGroups/Events"
import { ReceiptRow } from "./Receipts/Events"
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

type Encoded = Record<keyof BackupData, Array<Record<string, unknown>>>

// every receipt is in an existing group and every image on an existing
// receipt, so nothing restored is hidden in the app
const expectReachable = (data: Encoded) => {
  const groupIds = new Set(data.groups.map((_) => _.id))
  const receiptIds = new Set(data.receipts.map((_) => _.id))
  for (const receipt of data.receipts) {
    expect(groupIds).toContain(receipt.groupId)
  }
  for (const image of data.images) {
    expect(receiptIds).toContain(image.receiptId)
  }
}

// In-memory BackupStore. Writes round-trip the payload through the row
// event's payload schema, like the EventLog journal does, then apply the row
// the way the app's event handlers do.
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
        case "ReceiptGroup": {
          const payload = yield* roundTrip(
            ReceiptGroupRow.payload,
            write.payload,
          )
          if (payload._tag !== "set") return yield* Effect.die(payload)
          state.groups.push(new ReceiptGroup(payload.row))
          break
        }
        case "Receipt": {
          const payload = yield* roundTrip(ReceiptRow.payload, write.payload)
          if (payload._tag !== "set") return yield* Effect.die(payload)
          state.receipts.push(new Receipt(payload.row))
          break
        }
        case "Image": {
          const payload = yield* roundTrip(ImageRow.payload, write.payload)
          if (payload._tag !== "set") return yield* Effect.die(payload)
          state.images.push(new Image(payload.row))
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

// backup.json as exported before receipts, groups and images moved to EventRow
const previousVersionManifest = {
  format: "receipts-backup",
  version: 1,
  exportedAt: "1970-01-01T00:00:00.000Z",
  groups: [
    {
      id: "C2wdLj9ASlGLYnyD2U6l9g==",
      name: "Home",
      defaultCurrency: "NZD",
      createdAt: "2026-01-02T03:04:05.000Z",
      updatedAt: "2026-02-03T04:05:06.000Z",
    },
  ],
  receipts: [
    {
      id: "LY4/QFFiTHOthJ6l+2wHGA==",
      date: 1772582400000,
      description: "Weekly shop — café & bakery",
      merchant: "Countdown",
      amount: "123.45",
      currency: "NZD",
      processed: 1,
      groupId: "C2wdLj9ASlGLYnyD2U6l9g==",
      createdAt: "2026-03-04T05:06:07.000Z",
      updatedAt: "2026-03-05T05:06:07.000Z",
    },
  ],
  images: [
    {
      id: "T6BRYnOETpWPprDH2OKTOg==",
      receiptId: "LY4/QFFiTHOthJ6l+2wHGA==",
      contentType: "image/jpeg",
      createdAt: "2026-03-04T05:06:08.000Z",
      updatedAt: "2026-03-04T05:06:08.000Z",
      path: "images/4fa05162-7384-4e95-8fa6-b0c7d8e2933a.jpeg",
    },
  ],
}

describe("Backup", () => {
  it.effect("reads and writes backups of the previous version", () =>
    Effect.gen(function* () {
      const data: BackupData = {
        groups: [home],
        receipts: [groceries],
        images: [groceriesFront],
      }
      const previous = new Blob([
        zipSync({
          "backup.json": strToU8(JSON.stringify(previousVersionManifest)),
          [previousVersionManifest.images[0].path]: groceriesFront.data,
        }) as Uint8Array<ArrayBuffer>,
      ])
      const target = makeStore(emptyData)

      yield* importBackup(previous).pipe(Effect.provide(target.layer))

      expect(target.snapshot()).toEqual(normalize(data))

      const exported = yield* exportFrom(data)
      const entries = unzipSync(
        new Uint8Array(yield* Effect.promise(() => exported.arrayBuffer())),
      )
      const manifest = JSON.parse(strFromU8(entries["backup.json"]))
      expect({
        ...manifest,
        exportedAt: previousVersionManifest.exportedAt,
      }).toEqual(previousVersionManifest)
    }),
  )

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

  it.effect(
    "restores receipts and images whose group or receipt was deleted",
    () =>
      Effect.gen(function* () {
        // deleting a group leaves its receipts (and their images) behind, and
        // an image can outlive its receipt
        const deletedGroupId = ReceiptGroupId.make(
          uuidBytes("72d38495-a6b7-41c8-b2d9-e3f0a1b5c66d"),
        )
        const deletedReceiptId = ReceiptId.make(
          uuidBytes("83e495a6-b7c8-42d9-83ea-f4a1b2c6d77e"),
        )
        const orphanReceipt = new Receipt({
          ...taxi,
          id: ReceiptId.make(uuidBytes("94f5a6b7-c8d9-43ea-94fb-a5b2c3d7e88f")),
          groupId: deletedGroupId,
        })
        const orphanReceipt2 = new Receipt({
          ...groceries,
          id: ReceiptId.make(uuidBytes("e94afb0c-1d2e-483f-a940-fa07b8c23dd4")),
          groupId: deletedGroupId,
        })
        const orphanReceiptImage = new Image({
          ...taxiPhoto,
          id: ImageId.make(uuidBytes("a506b7c8-d9ea-44fb-a50c-b6c3d4e8f990")),
          receiptId: orphanReceipt.id,
        })
        const orphanImage = new Image({
          ...groceriesFront,
          id: ImageId.make(uuidBytes("b617c8d9-eafb-450c-b61d-c7d4e5f90aa1")),
          receiptId: deletedReceiptId,
        })
        const source: BackupData = {
          groups: fullData.groups,
          receipts: [...fullData.receipts, orphanReceipt, orphanReceipt2],
          images: [...fullData.images, orphanReceiptImage, orphanImage],
        }
        const backup = yield* exportFrom(source)
        const target = makeStore(emptyData)

        const summary = yield* importBackup(backup).pipe(
          Effect.provide(target.layer),
        )
        expect(summary.recovered).toEqual({ receipts: 2, images: 1 })

        // nothing from the source is lost or changed
        const restored = target.snapshot() as unknown as Encoded
        const expected = normalize(source) as unknown as Encoded
        expect(restored.groups).toEqual(expect.arrayContaining(expected.groups))
        expect(restored.receipts).toEqual(
          expect.arrayContaining(expected.receipts),
        )
        expect(restored.images).toEqual(expect.arrayContaining(expected.images))

        expectReachable(restored)

        const writesBefore = target.writes.length
        yield* importBackup(backup).pipe(Effect.provide(target.layer))
        expect(target.writes.length).toBe(writesBefore)
      }),
  )

  it.effect(
    "recovers the group of the local receipt, not the group in the backup",
    () =>
      Effect.gen(function* () {
        // locally the receipt was moved to another group, which was then
        // deleted, so the local and backup copies point at different groups
        const localGroupId = ReceiptGroupId.make(
          uuidBytes("c728d9ea-fb0c-461d-a72e-d8e5f6a01bb2"),
        )
        const backupGroupId = ReceiptGroupId.make(
          uuidBytes("d839eafb-0c1d-472e-b83f-e9f6a7b12cc3"),
        )
        const localTaxi = new Receipt({
          ...taxi,
          merchant: "Edited locally",
          groupId: localGroupId,
        })
        const backup = yield* exportFrom({
          groups: [home],
          receipts: [new Receipt({ ...taxi, groupId: backupGroupId })],
          images: [taxiPhoto],
        })
        const target = makeStore({
          groups: [home],
          receipts: [localTaxi],
          images: [],
        })

        yield* importBackup(backup).pipe(Effect.provide(target.layer))

        const restored = target.snapshot() as unknown as Encoded
        expect(restored.receipts).toEqual([encodeReceipt(localTaxi)])
        expect(restored.images).toEqual([encodeImage(taxiPhoto)])
        expectReachable(restored)
        // home plus the recovered local group, and nothing for the backup's
        // group
        expect(restored.groups).toHaveLength(2)
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
        "image with an empty id": yield* tamper(
          backup,
          editJson((json) => {
            json.images[2].id = ""
          }),
        ),
        "image with an over-long id": yield* tamper(
          backup,
          editJson((json) => {
            const id = Buffer.from(json.images[1].id, "base64")
            json.images[1].id = Buffer.concat([id, Buffer.from([0])]).toString(
              "base64",
            )
          }),
        ),
        "receipt with a malformed group id": yield* tamper(
          backup,
          editJson((json) => {
            json.receipts[0].groupId = "AAAA"
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
