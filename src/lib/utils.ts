import { Rx } from "@effect-rx/rx-react"
import { clsx, type ClassValue } from "clsx"
import { Option } from "effect"
import { twMerge } from "tailwind-merge"
import * as Uuid from "uuid"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const uuidString = (uuid: Uint8Array): string => Uuid.stringify(uuid)

export const localStorageRx = (key: string) =>
  Rx.writable<Option.Option<string>, Option.Option<string>>(
    (_get) => Option.fromNullable(localStorage.getItem(key)),
    (ctx, option) => {
      if (Option.isSome(option)) {
        localStorage.setItem(key, option.value)
      } else {
        localStorage.removeItem(key)
      }
      ctx.setSelf(option)
    },
  )
