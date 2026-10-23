import { BigDecimal } from "effect"
import type { Receipt } from "./Receipt"

export interface CurrencyTotal {
  readonly currency: string
  readonly amount: BigDecimal.BigDecimal
  readonly count: number
}

/**
 * Sums receipts per currency. `lead` is listed first when present, followed by
 * the most used currencies.
 */
export const totalsByCurrency = (
  receipts: ReadonlyArray<Receipt>,
  lead?: string,
): Array<CurrencyTotal> => {
  const totals = new Map<string, CurrencyTotal>()
  for (const receipt of receipts) {
    const prev = totals.get(receipt.currency)
    totals.set(receipt.currency, {
      currency: receipt.currency,
      amount: prev
        ? BigDecimal.sum(prev.amount, receipt.amount)
        : receipt.amount,
      count: (prev?.count ?? 0) + 1,
    })
  }
  return Array.from(totals.values()).sort((a, b) =>
    a.currency === lead
      ? -1
      : b.currency === lead
        ? 1
        : b.count - a.count || a.currency.localeCompare(b.currency),
  )
}

/**
 * Converts an amount using rates expressed as units of each currency per US
 * dollar. Returns `undefined` when either currency has no rate.
 */
export const convert = (
  amount: BigDecimal.BigDecimal,
  from: string,
  to: string,
  rates: Record<string, number>,
): number | undefined => {
  const value = BigDecimal.toNumberUnsafe(amount)
  if (from === to) return value
  const fromRate = rates[from]
  const toRate = rates[to]
  if (!fromRate || !toRate) return undefined
  return (value / fromRate) * toRate
}

/**
 * Re-expresses US dollar based rates as units of each currency per `base`.
 */
export const rebase = (
  rates: Record<string, number>,
  base: string,
): Record<string, number> | undefined => {
  const baseRate = rates[base]
  if (!baseRate) return undefined
  return Object.fromEntries(
    Object.entries(rates).map(([currency, rate]) => [
      currency,
      currency === base ? 1 : rate / baseRate,
    ]),
  )
}

export type Summary =
  /** Every receipt is in `currency`, so the total needs no conversion. */
  | {
      readonly _tag: "Exact"
      readonly currency: string
      readonly total: BigDecimal.BigDecimal
      readonly count: number
    }
  /** Converted into `currency`. `excluded` currencies have no rate. */
  | {
      readonly _tag: "Converted"
      readonly currency: string
      readonly total: number
      readonly lines: ReadonlyArray<CurrencyTotal>
      readonly excluded: ReadonlyArray<string>
      readonly count: number
    }
  /** Mixed currencies that can't be combined. The first line leads. */
  | {
      readonly _tag: "Separate"
      readonly lines: ReadonlyArray<CurrencyTotal>
      readonly count: number
    }

export const summarize = (options: {
  readonly receipts: ReadonlyArray<Receipt>
  readonly currency: string
  readonly rates: Record<string, number> | undefined
}): Summary | undefined => {
  const { receipts, currency, rates } = options
  const lines = totalsByCurrency(receipts, currency)
  const count = receipts.length
  if (lines.length === 0) return undefined
  if (lines.length === 1 && lines[0].currency === currency) {
    return { _tag: "Exact", currency, total: lines[0].amount, count }
  }
  if (rates && rates[currency]) {
    let total = 0
    const excluded: Array<string> = []
    for (const line of lines) {
      const value = convert(line.amount, line.currency, currency, rates)
      if (value === undefined) {
        excluded.push(line.currency)
      } else {
        total += value
      }
    }
    if (excluded.length < lines.length) {
      return { _tag: "Converted", currency, total, lines, excluded, count }
    }
  }
  if (lines.length === 1) {
    return {
      _tag: "Exact",
      currency: lines[0].currency,
      total: lines[0].amount,
      count,
    }
  }
  return { _tag: "Separate", lines, count }
}

/**
 * Whether a summary's total depends on exchange rates.
 */
export const isApproximate = (summary: Summary): boolean =>
  summary._tag === "Converted" &&
  summary.lines.some(
    (line) =>
      line.currency !== summary.currency &&
      !summary.excluded.includes(line.currency),
  )
