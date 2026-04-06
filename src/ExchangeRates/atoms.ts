import { ExchangeRates } from "@/ExchangeRates"
import { Atom } from "effect/unstable/reactivity"

const runtime = Atom.runtime(ExchangeRates.layer)

export const baseCurrencyAtom = Atom.make("")

export const latestRates = runtime.fn((appId: string, get) =>
  ExchangeRates.use((_) => _.rates(appId, get(baseCurrencyAtom))),
)

export const ratesWithAtom = Atom.family((appId: string) =>
  runtime.fn((currency: string) =>
    ExchangeRates.use((_) => _.rates(appId, currency)),
  ),
)
