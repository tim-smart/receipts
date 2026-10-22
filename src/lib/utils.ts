import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import * as Uuid from "uuid"
import { BrowserKeyValueStore } from "@effect/platform-browser"
import { Atom } from "effect/reactivity"
import { Equal, Schema, SchemaGetter, String } from "effect"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const uuidString = (uuid: Uint8Array): string => Uuid.stringify(uuid)
export const uuidBytes = (uuid: string): Uint8Array<ArrayBuffer> =>
  Uuid.parse(uuid) as any

// The entries of `next` that differ from `current`. Row patches should only
// carry these, so they don't overwrite concurrent edits to other fields.
export const changedFields = <A extends object, K extends keyof A>(
  current: A,
  next: Pick<A, K>,
): Partial<Pick<A, K>> => {
  const changed: Partial<Pick<A, K>> = {}
  for (const key of Object.keys(next) as Array<K>) {
    if (!Equal.equals(current[key], next[key])) changed[key] = next[key]
  }
  return changed
}

export const kvsRuntime = Atom.runtime(BrowserKeyValueStore.layerLocalStorage)

export const TrimmedString = Schema.String.pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.passthrough(),
    encode: SchemaGetter.transform(String.trim),
  }),
)
