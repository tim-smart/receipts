import { Atom } from "@effect-atom/atom-react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import * as Uuid from "uuid"
import { BrowserKeyValueStore } from "@effect/platform-browser"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const uuidString = (uuid: Uint8Array): string => Uuid.stringify(uuid)

export const kvsRuntime = Atom.runtime(BrowserKeyValueStore.layerLocalStorage)
