import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import * as Uuid from "uuid"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const uuidString = (uuid: Uint8Array): string => Uuid.stringify(uuid)
