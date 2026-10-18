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
import { Context, Effect, Schema } from "effect"
import { Image } from "./Domain/Image"
import { Receipt } from "./Domain/Receipt"
import { ReceiptGroup } from "./Domain/ReceiptGroup"

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

export const exportBackup: Effect.Effect<Blob, never, BackupStore> = Effect.die(
  "Backup.exportBackup: not implemented",
)

export const importBackup = (
  _file: Blob,
): Effect.Effect<ImportSummary, BackupError, BackupStore> =>
  Effect.die("Backup.importBackup: not implemented")
