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
 * locally are left untouched, and nothing is ever deleted. Receipts whose
 * group, or images whose receipt, no longer exists are kept: the missing
 * parent is recreated (a "Recovered receipts" group / a placeholder receipt).
 */
import { BigDecimal, Context, DateTime, Effect, Schema } from "effect"
import { Model } from "effect/schema"
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate"
import { Image } from "./Domain/Image"
import { Receipt } from "./Domain/Receipt"
import { ReceiptGroup, ReceiptGroupId } from "./Domain/ReceiptGroup"
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
    ]),
    message: Schema.String,
  },
) {}

export interface ImportSummary {
  readonly groups: number
  readonly receipts: number
  readonly images: number
  readonly skipped: number
  /**
   * Present when the backup contained receipts whose group, or images whose
   * receipt, no longer existed. Those records are imported into recreated
   * "Recovered receipts" groups / placeholder receipts instead of being
   * dropped.
   */
  readonly recovered?: {
    readonly receipts: number
    readonly images: number
  }
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

  const groups: Array<Decoded<(typeof backup.groups)[number]>> = []
  for (const group of backup.groups) {
    groups.push({ ...group, key: yield* idKey("Group", group.id) })
  }
  const receipts: Array<
    Decoded<(typeof backup.receipts)[number]> & { readonly groupKey: string }
  > = []
  for (const receipt of backup.receipts) {
    receipts.push({
      ...receipt,
      key: yield* idKey("Receipt", receipt.id),
      groupKey: yield* idKey("Receipt group", receipt.groupId),
    })
  }
  const images: Array<
    Decoded<typeof Image.json.Type> & { readonly receiptKey: string }
  > = []
  for (const { path, ...image } of backup.images) {
    const key = yield* idKey("Image", image.id)
    const receiptKey = yield* idKey("Image receipt", image.receiptId)
    const data = entries[path]
    if (!data) {
      return yield* fail("MissingImage", `The archive has no ${path}`)
    }
    images.push({ ...image, data, key, receiptKey })
  }

  return { groups, receipts, images }
})

type Decoded<A> = A & { readonly key: string }

const idKey = (label: string, id: Uint8Array) =>
  Effect.try({
    // uuid's stringify ignores bytes past the first 16
    try: () => {
      if (id.length !== 16) throw new Error("invalid length")
      return uuidString(id)
    },
    catch: () =>
      new BackupError({
        reason: "InvalidData",
        message: `${label} id is not a valid UUID`,
      }),
  })

const recoveredGroupName = "Recovered receipts"

const planImport = (
  backup: Effect.Success<ReturnType<typeof readBackup>>,
  existing: BackupData,
) => {
  const keys = (items: ReadonlyArray<{ readonly id: Uint8Array }>) =>
    new Set(items.map((item) => uuidString(item.id)))
  const groupKeys = keys(existing.groups)
  const localReceipts = new Map(
    existing.receipts.map((receipt) => [uuidString(receipt.id), receipt]),
  )
  const receiptKeys = new Set(localReceipts.keys())
  const imageKeys = keys(existing.images)

  const groupWrites: Array<BackupWrite> = []
  const receiptWrites: Array<BackupWrite> = []
  const imageWrites: Array<BackupWrite> = []
  const summary = { groups: 0, receipts: 0, images: 0, skipped: 0 }
  const recoveredGroupKeys = new Set<string>()
  const recoveredReceiptKeys = new Set<string>()
  let recoveredImages = 0

  for (const group of backup.groups) {
    if (groupKeys.has(group.key)) {
      summary.skipped++
      continue
    }
    groupKeys.add(group.key)
    const { key: _key, ...fields } = group
    groupWrites.push({
      event: "GroupCreate",
      payload: ReceiptGroup.insert.make({
        ...fields,
        createdAt: Model.Override(group.createdAt),
        updatedAt: Model.Override(group.updatedAt),
      }),
    })
    summary.groups++
  }

  // recreate missing parents with their original ids, so the orphaned
  // records import unchanged and a re-import skips them like anything else
  const recoverGroup = (
    id: typeof ReceiptGroupId.Type,
    key: string,
    currency: string,
  ) => {
    groupKeys.add(key)
    recoveredGroupKeys.add(key)
    groupWrites.push({
      event: "GroupCreate",
      payload: ReceiptGroup.insert.make({
        id,
        name: recoveredGroupName,
        defaultCurrency: currency,
      }),
    })
  }

  for (const receipt of backup.receipts) {
    if (receiptKeys.has(receipt.key)) {
      summary.skipped++
      continue
    }
    receiptKeys.add(receipt.key)
    if (!groupKeys.has(receipt.groupKey)) {
      recoverGroup(receipt.groupId, receipt.groupKey, receipt.currency)
    }
    if (recoveredGroupKeys.has(receipt.groupKey)) {
      recoveredReceiptKeys.add(receipt.key)
    }
    const { key: _key, groupKey: _groupKey, ...fields } = receipt
    receiptWrites.push({
      event: "ReceiptCreate",
      payload: Receipt.insert.make({
        ...fields,
        createdAt: Model.Override(receipt.createdAt),
        updatedAt: Model.Override(receipt.updatedAt),
      }),
    })
    summary.receipts++
  }

  let placeholderGroup: typeof ReceiptGroupId.Type | undefined
  const placeholderKeys = new Set<string>()
  for (const image of backup.images) {
    if (imageKeys.has(image.key)) {
      summary.skipped++
      continue
    }
    imageKeys.add(image.key)
    if (!receiptKeys.has(image.receiptKey)) {
      if (placeholderGroup === undefined) {
        const group = ReceiptGroup.insert.make({ name: recoveredGroupName })
        groupWrites.push({ event: "GroupCreate", payload: group })
        placeholderGroup = group.id!
      }
      receiptKeys.add(image.receiptKey)
      placeholderKeys.add(image.receiptKey)
      receiptWrites.push({
        event: "ReceiptCreate",
        payload: Receipt.insert.make({
          id: image.receiptId,
          groupId: placeholderGroup,
          date: image.createdAt,
          description: "",
          merchant: "Recovered image",
          amount: BigDecimal.fromNumberUnsafe(0),
          currency: "USD",
          // don't send recovered images to OpenAI on import
          processed: true,
        }),
      })
    }
    if (placeholderKeys.has(image.receiptKey)) {
      recoveredImages++
    }
    // the image's receipt is kept as it is locally, so follow the local
    // receipt's group rather than the one in the backup
    const local = localReceipts.get(image.receiptKey)
    if (local) {
      const groupKey = uuidString(local.groupId)
      if (!groupKeys.has(groupKey)) {
        recoverGroup(local.groupId, groupKey, local.currency)
      }
      if (recoveredGroupKeys.has(groupKey)) {
        recoveredReceiptKeys.add(image.receiptKey)
      }
    }
    const { key: _key, receiptKey: _receiptKey, ...fields } = image
    imageWrites.push({
      event: "ImageCreate",
      payload: Image.insert.make({
        ...fields,
        createdAt: Model.Override(image.createdAt),
        updatedAt: Model.Override(image.updatedAt),
      }),
    })
    summary.images++
  }

  return {
    // parents before children
    writes: [...groupWrites, ...receiptWrites, ...imageWrites],
    summary:
      recoveredReceiptKeys.size + recoveredImages > 0
        ? {
            ...summary,
            recovered: {
              receipts: recoveredReceiptKeys.size,
              images: recoveredImages,
            },
          }
        : summary,
  }
}

const payloadSchemas = {
  GroupCreate: ReceiptGroup.insert,
  ReceiptCreate: Receipt.insert,
  ImageCreate: Image.insert,
} as const

// encode each payload the way the EventLog journal will, so a write can't
// fail half way through an import
const validateWrite = (write: BackupWrite) =>
  Schema.encodeUnknownEffect(payloadSchemas[write.event])(write.payload).pipe(
    Effect.mapError(
      (error) =>
        new BackupError({ reason: "InvalidData", message: error.message }),
    ),
  )

export const importBackup = (
  file: Blob,
): Effect.Effect<ImportSummary, BackupError, BackupStore> =>
  Effect.gen(function* () {
    const store = yield* BackupStore
    // validate the whole file and every event payload before writing anything
    const backup = yield* readBackup(file)
    const existing = yield* store.snapshot
    const plan = yield* Effect.try({
      try: () => planImport(backup, existing),
      catch: (cause) =>
        new BackupError({ reason: "InvalidData", message: String(cause) }),
    })
    yield* Effect.forEach(plan.writes, validateWrite, { discard: true })
    yield* Effect.forEach(plan.writes, store.write, { discard: true })
    return plan.summary
  })
