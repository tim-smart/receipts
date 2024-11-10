import { ExchangeRates } from "@/ExchangeRates"
import { Rx } from "@effect-rx/rx-react"

const runtime = Rx.runtime(ExchangeRates.Default)

export const baseCurrencyRx = Rx.make("")

export const latestRates = runtime.fn((appId: string, get) =>
  ExchangeRates.rates(appId, get(baseCurrencyRx)),
)

export const ratesWithRx = Rx.family((appId: string) =>
  runtime.fn((currency: string) => ExchangeRates.rates(appId, currency)),
)
