/**
 * Full backup / restore of the app data, including images.
 *
 * A backup is a zip archive containing:
 *
 * - `backup.json`: `{ format: "receipts-backup", version: 1, exportedAt,
 *   groups, receipts, images }`. Records use the `json` variant of their
 *   model. Each image entry carries a `path` pointing at its bytes instead of
 *   inlining them.
 * - `images/<image id>.<ext>`: the raw image bytes.
 *
 * Settings are not included (they hold API keys and per-device state).
 *
 * Import is validated in full before anything is written, and is
 * non-destructive: records are merged by id, records that already exist
 * locally are left untouched, and nothing is ever deleted.
 */
import { Context, DateTime, Effect, Schema } from "effect"
import { Model } from "effect/schema"
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate"
import { Image } from "./Domain/Image"
import { Receipt } from "./Domain/Receipt"
import { ReceiptGroup } from "./Domain/ReceiptGroup"
import { uuidString } from "./lib/utils"

export interface BackupData {
  readonly groups: ReadonlyArray<ReceiptGroup>
  readonly receipts: ReadonlyArray<Receipt>
  readonly images: ReadonlyArray<Image>
}

export type BackupWrite =
  | {
      readonly event: "GroupCreate"
      readonly payload: typeof ReceiptGroup.insert.Type
    }
  | {
      readonly event: "ReceiptCreate"
      readonly payload: typeof Receipt.insert.Type
    }
  | {
      readonly event: "ImageCreate"
      readonly payload: typeof Image.insert.Type
    }

/**
 * Where backups are read from and restored to. The app implementation reads
 * from IndexedDB and writes through the EventLog client, so imported data is
 * journaled and synced like any other change.
 */
export class BackupStore extends Context.Service<
  BackupStore,
  {
    readonly snapshot: Effect.Effect<BackupData>
    readonly write: (write: BackupWrite) => Effect.Effect<void>
  }
>()("Backup/BackupStore") {}

export class BackupError extends Schema.TaggedError<BackupError>()(
  "BackupError",
  {
    reason: Schema.Literals([
      "InvalidArchive",
      "UnsupportedVersion",
      "InvalidData",
      "MissingImage",
      "DanglingReference",
    ]),
    message: Schema.String,
  },
) {}

export interface ImportSummary {
  readonly groups: number
  readonly receipts: number
  readonly images: number
  readonly skipped: number
}

const format = "receipts-backup"
const version = 1
const manifestPath = "backup.json"

const { data: _data, ...imageFields } = Image.json.fields

const ImageEntry = Schema.Struct({
  ...imageFields,
  path: Schema.String,
})

const BackupHeader = Schema.Struct({
  format: Schema.String,
  version: Schema.Finite,
})

const BackupFile = Schema.toCodecJson(
  Schema.Struct({
    format: Schema.Literal(format),
    version: Schema.Literal(version),
    exportedAt: Schema.DateTimeUtc,
    groups: Schema.Array(ReceiptGroup.json),
    receipts: Schema.Array(Receipt.json),
    images: Schema.Array(ImageEntry),
  }),
)

const imagePath = (image: {
  readonly id: Uint8Array
  readonly contentType: string
}) => {
  const ext = (image.contentType.split("/")[1] ?? "").replace(/[^a-z0-9]/gi, "")
  return `images/${uuidString(image.id)}.${ext || "bin"}`
}

export const exportBackup: Effect.Effect<Blob, never, BackupStore> = Effect.gen(
  function* () {
    const store = yield* BackupStore
    const data = yield* store.snapshot
    const files: Zippable = {}
    const images = data.images.map(({ data, ...image }) => {
      const path = imagePath(image)
      // images are already compressed
      files[path] = [data, { level: 0 }]
      return { ...image, path }
    })
    const json = yield* Schema.encodeEffect(Schema.fromJsonString(BackupFile))({
      format,
      version,
      exportedAt: yield* DateTime.now,
      groups: data.groups,
      receipts: data.receipts,
      images,
    }).pipe(Effect.orDie)
    files[manifestPath] = strToU8(json)
    return new Blob([zipSync(files) as Uint8Array<ArrayBuffer>], {
      type: "application/zip",
    })
  },
)

const fail = (reason: BackupError["reason"], message: string) =>
  Effect.fail(new BackupError({ reason, message }))

const readBackup = Effect.fnUntraced(function* (file: Blob) {
  const bytes = new Uint8Array(yield* Effect.promise(() => file.arrayBuffer()))
  const entries = yield* Effect.try({
    try: () => unzipSync(bytes),
    catch: () =>
      new BackupError({
        reason: "InvalidArchive",
        message: "The file is not a zip archive",
      }),
  })
  const manifest = entries[manifestPath]
  if (!manifest) {
    return yield* fail("InvalidArchive", `The archive has no ${manifestPath}`)
  }
  const json = yield* Schema.decodeEffect(
    Schema.fromJsonString(Schema.Unknown),
  )(strFromU8(manifest)).pipe(
    Effect.mapError(
      () =>
        new BackupError({
          reason: "InvalidArchive",
          message: `${manifestPath} is not valid JSON`,
        }),
    ),
  )

  const header = yield* Schema.decodeUnknownEffect(BackupHeader)(json).pipe(
    Effect.mapError(
      () =>
        new BackupError({
          reason: "InvalidArchive",
          message: "The file is not a receipts backup",
        }),
    ),
  )
  if (header.format !== format) {
    return yield* fail("InvalidArchive", "The file is not a receipts backup")
  }
  if (header.version !== version) {
    return yield* fail(
      "UnsupportedVersion",
      `Backup version ${header.version} is not supported`,
    )
  }

  const backup = yield* Schema.decodeUnknownEffect(BackupFile)(json).pipe(
    Effect.mapError(
      (error) =>
        new BackupError({ reason: "InvalidData", message: error.message }),
    ),
  )

  const groupIds = new Set(backup.groups.map((group) => uuidString(group.id)))
  const receiptIds = new Set(
    backup.receipts.map((receipt) => uuidString(receipt.id)),
  )
  for (const receipt of backup.receipts) {
    if (!groupIds.has(uuidString(receipt.groupId))) {
      return yield* fail(
        "DanglingReference",
        `Receipt ${uuidString(receipt.id)} belongs to a group that is not in the backup`,
      )
    }
  }
  const images: Array<typeof Image.json.Type> = []
  for (const { path, ...image } of backup.images) {
    if (!receiptIds.has(uuidString(image.receiptId))) {
      return yield* fail(
        "DanglingReference",
        `Image ${uuidString(image.id)} belongs to a receipt that is not in the backup`,
      )
    }
    const data = entries[path]
    if (!data) {
      return yield* fail("MissingImage", `The archive has no ${path}`)
    }
    images.push({ ...image, data })
  }

  return { groups: backup.groups, receipts: backup.receipts, images }
})

export const importBackup = (
  file: Blob,
): Effect.Effect<ImportSummary, BackupError, BackupStore> =>
  Effect.gen(function* () {
    const store = yield* BackupStore
    // validate the whole file before writing anything
    const backup = yield* readBackup(file)
    const existing = yield* store.snapshot

    const idSet = (items: ReadonlyArray<{ readonly id: Uint8Array }>) =>
      new Set(items.map((item) => uuidString(item.id)))
    const groupIds = idSet(existing.groups)
    const receiptIds = idSet(existing.receipts)
    const imageIds = idSet(existing.images)
    const summary = { groups: 0, receipts: 0, images: 0, skipped: 0 }

    for (const group of backup.groups) {
      const id = uuidString(group.id)
      if (groupIds.has(id)) {
        summary.skipped++
        continue
      }
      groupIds.add(id)
      yield* store.write({
        event: "GroupCreate",
        payload: ReceiptGroup.insert.make({
          ...group,
          createdAt: Model.Override(group.createdAt),
          updatedAt: Model.Override(group.updatedAt),
        }),
      })
      summary.groups++
    }

    for (const receipt of backup.receipts) {
      const id = uuidString(receipt.id)
      if (receiptIds.has(id)) {
        summary.skipped++
        continue
      }
      receiptIds.add(id)
      yield* store.write({
        event: "ReceiptCreate",
        payload: Receipt.insert.make({
          ...receipt,
          createdAt: Model.Override(receipt.createdAt),
          updatedAt: Model.Override(receipt.updatedAt),
        }),
      })
      summary.receipts++
    }

    for (const image of backup.images) {
      const id = uuidString(image.id)
      if (imageIds.has(id)) {
        summary.skipped++
        continue
      }
      imageIds.add(id)
      yield* store.write({
        event: "ImageCreate",
        payload: Image.insert.make({
          ...image,
          createdAt: Model.Override(image.createdAt),
          updatedAt: Model.Override(image.updatedAt),
        }),
      })
      summary.images++
    }

    return summary
  })
