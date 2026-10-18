import { exportBackup, importBackup } from "@/Backup"
import { eventLogAtom } from "@/EventLog"
import { DateTime, Effect, Layer } from "effect"
import { Atom } from "effect/reactivity"
import FileSaver from "file-saver"
import { BackupStoreLive } from "./Store"

const runtime = Atom.runtime((get) =>
  BackupStoreLive.pipe(Layer.provide(get(eventLogAtom.layer))),
)

export const exportBackupAtom = runtime.fn(() =>
  Effect.gen(function* () {
    const blob = yield* exportBackup
    const now = yield* DateTime.now
    FileSaver.saveAs(blob, `receipts-backup-${DateTime.formatIso(now)}.zip`)
  }),
)

export const importBackupAtom = runtime.fn((file: File) => importBackup(file))
