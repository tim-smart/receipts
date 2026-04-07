import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import * as Uuid from "uuid"
import { BrowserKeyValueStore } from "@effect/platform-browser"
import { Atom } from "effect/unstable/reactivity"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const uuidString = (uuid: Uint8Array): string => Uuid.stringify(uuid)
export const uuidBytes = (uuid: string): Uint8Array<ArrayBuffer> =>
  Uuid.parse(uuid) as any

export const kvsRuntime = Atom.runtime(BrowserKeyValueStore.layerLocalStorage)
