import { ExchangeRates } from "@/ExchangeRates"
import { Atom } from "@effect-atom/atom-react"

const runtime = Atom.runtime(ExchangeRates.Default)

export const baseCurrencyAtom = Atom.make("")

export const latestRates = runtime.fn((appId: string, get) =>
  ExchangeRates.rates(appId, get(baseCurrencyAtom)),
)

export const ratesWithAtom = Atom.family((appId: string) =>
  runtime.fn((currency: string) => ExchangeRates.rates(appId, currency)),
)
