import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import * as Uuid from "uuid"
import { BrowserKeyValueStore } from "@effect/platform-browser"
import { Atom } from "effect/reactivity"
import { DateTime, Equal, Schema, SchemaGetter, String } from "effect"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const uuidString = (uuid: Uint8Array): string => Uuid.stringify(uuid)
export const uuidBytes = (uuid: string): Uint8Array<ArrayBuffer> =>
  Uuid.parse(uuid) as any

// A row patch of the fields of `next` that differ from `current`, with a new
// `updatedAt`, or `undefined` when nothing changed. A patch only carries the
// changed fields, so it doesn't overwrite concurrent edits to other fields.
export const patchChanged = <
  A extends { readonly id: unknown; readonly updatedAt: DateTime.Utc },
  K extends Exclude<keyof A, "id" | "updatedAt">,
  W,
>(
  row: {
    readonly patch: (
      key: A["id"],
      fields: Partial<Pick<A, K>> & { readonly updatedAt: DateTime.Utc },
    ) => W
  },
  current: A,
  next: Pick<A, K>,
): W | undefined => {
  const changed: Partial<Pick<A, K>> = {}
  let any = false
  for (const key of Object.keys(next) as Array<K>) {
    if (Equal.equals(current[key], next[key])) continue
    changed[key] = next[key]
    any = true
  }
  if (!any) return undefined
  return row.patch(current.id, { ...changed, updatedAt: DateTime.nowUnsafe() })
}

export const kvsRuntime = Atom.runtime(BrowserKeyValueStore.layerLocalStorage)

export const TrimmedString = Schema.String.pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.passthrough(),
    encode: SchemaGetter.transform(String.trim),
  }),
)
