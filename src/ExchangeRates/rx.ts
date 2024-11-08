import { ExchangeRates } from "@/ExchangeRates"
import { Rx } from "@effect-rx/rx-react"

const runtime = Rx.runtime(ExchangeRates.Default)

export const baseCurrencyRx = Rx.make("")

export const latestRates = runtime.fn((appId: string, get) =>
  ExchangeRates.rates(appId, get(baseCurrencyRx)),
)
