import { useAtom, useAtomValue } from "@effect/atom-react"
import { DateTime } from "effect"
import { AsyncResult } from "effect/reactivity"
import { ReactNode, useMemo } from "react"
import { ChevronDown } from "lucide-react"
import { Receipt } from "@/Domain/Receipt"
import { ReceiptGroup } from "@/Domain/ReceiptGroup"
import { codes, formatAmount, formatCurrency } from "@/Domain/Currency"
import { Summary, summarize } from "@/Domain/Totals"
import { Rates } from "@/ExchangeRates"
import {
  availableRates,
  currentRatesAtom,
  RatesState,
  viewCurrenciesAtom,
} from "@/ExchangeRates/atoms"
import { Button } from "@/components/ui/button"
import {
  TillTape,
  TillTapeAmount,
  TillTapeHead,
  TillTapeLine,
  TillTapeLines,
} from "@/components/ui/TillTape"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox"

/**
 * The current rates and the currency a folder's totals are shown in on this
 * device. Falls back to the folder's default currency when there are no rates
 * to convert with.
 */
export const useViewCurrency = (group: ReceiptGroup) => {
  const rates = useAtomValue(
    currentRatesAtom,
    AsyncResult.getOrElse(() => undefined),
  )
  const [viewCurrencies, setViewCurrencies] = useAtom(viewCurrenciesAtom)
  const chosen = viewCurrencies[group.idString]
  // only use the chosen currency while there's a rate to convert into it
  const currency =
    chosen && availableRates(rates)?.rates[chosen]
      ? chosen
      : group.defaultCurrency
  const setCurrency = (currency: string) => {
    const { [group.idString]: _, ...rest } = viewCurrencies
    setViewCurrencies(
      currency === group.defaultCurrency
        ? rest
        : { ...rest, [group.idString]: currency },
    )
  }
  return { rates, currency, setCurrency }
}

export function TotalsTape({
  receipts,
  folderCurrency,
  rates,
  currency,
  onCurrencyChange,
  onOpenSettings,
  action,
  className,
}: {
  receipts: ReadonlyArray<Receipt>
  folderCurrency: string
  /** `undefined` while the rates are loading. */
  rates: RatesState | undefined
  currency: string
  onCurrencyChange: (currency: string) => void
  onOpenSettings: () => void
  action?: ReactNode
  className?: string
}) {
  const available = availableRates(rates)
  const summary = useMemo(
    () => summarize({ receipts, currency, rates: available?.rates }),
    [receipts, currency, available],
  )
  if (!summary) return null

  const lead =
    summary._tag === "Separate"
      ? summary.lines[0]
      : { currency: summary.currency, amount: summary.total }

  return (
    <TillTape className={className}>
      <TillTapeHead>
        <span>
          <span className="whitespace-nowrap">
            {receipts.length} {receipts.length === 1 ? "receipt" : "receipts"} ·
          </span>{" "}
          <span className="whitespace-nowrap">{dateRange(receipts)}</span>
        </span>
        {action}
      </TillTapeHead>

      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <TillTapeAmount>{formatCurrency(lead)}</TillTapeAmount>
        {available ? (
          <CurrencyPicker
            value={currency}
            folderCurrency={folderCurrency}
            summary={summary}
            rates={available.rates}
            onChange={onCurrencyChange}
          />
        ) : (
          <span className="pt-2 font-mono text-[13px] text-muted-foreground">
            {lead.currency}
          </span>
        )}
      </div>

      <Lines summary={summary} />
      <Footer
        summary={summary}
        rates={rates}
        currency={currency}
        folderCurrency={folderCurrency}
        onReset={() => onCurrencyChange(folderCurrency)}
        onOpenSettings={onOpenSettings}
      />
    </TillTape>
  )
}

function Lines({ summary }: { summary: Summary }) {
  if (summary._tag === "Exact") return null
  const lines =
    summary._tag === "Separate" ? summary.lines.slice(1) : summary.lines
  // currencies that aren't part of the total are shown as additions
  const separate = (currency: string) =>
    summary._tag === "Separate" || summary.excluded.includes(currency)
  return (
    <TillTapeLines>
      {lines.map((line) => (
        <TillTapeLine
          key={line.currency}
          label={separate(line.currency) ? `+ ${line.currency}` : line.currency}
          value={formatAmount(line.amount, line.currency)}
        />
      ))}
    </TillTapeLines>
  )
}

function Footer({
  summary,
  rates,
  currency,
  folderCurrency,
  onReset,
  onOpenSettings,
}: {
  summary: Summary
  rates: RatesState | undefined
  currency: string
  folderCurrency: string
  onReset: () => void
  onOpenSettings: () => void
}) {
  let note: ReactNode = null
  let link: ReactNode = null

  if (summary._tag === "Converted") {
    const available = availableRates(rates)
    if (available) note = ratesNote(available)
  } else if (summary._tag === "Separate") {
    if (rates === undefined) {
      note = "Updating rates…"
    } else if (rates._tag === "NoKey") {
      note = "Add an exchange rates key to combine these."
      link = <FooterLink onClick={onOpenSettings}>Settings</FooterLink>
    } else if (rates._tag === "Unavailable") {
      note = navigator.onLine
        ? "Couldn't load exchange rates."
        : "Offline · no saved exchange rates."
    }
  }
  if (currency !== folderCurrency) {
    link = <FooterLink onClick={onReset}>Reset to {folderCurrency}</FooterLink>
  }
  const excluded = summary._tag === "Converted" ? summary.excluded : []

  if (!note && !link && excluded.length === 0) return null
  return (
    <div className="mt-3 grid gap-1 font-mono text-[11px] text-muted-foreground">
      {excluded.length > 0 && (
        <div>{excluded.join(", ")} not included: no rate</div>
      )}
      {(note || link) && (
        <div className="flex items-baseline justify-between gap-3">
          <span>{note}</span>
          {link}
        </div>
      )}
    </div>
  )
}

function FooterLink({
  onClick,
  children,
}: {
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-sm text-foreground underline underline-offset-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
    </button>
  )
}

const dayFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "short" })
const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
})
const dayMonthFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
})

const ratesNote = (rates: Rates) => {
  const published = DateTime.makeUnsafe(rates.timestamp)
  const today =
    DateTime.formatIntl(published, dayFormat) ===
    DateTime.formatIntl(DateTime.nowUnsafe(), dayFormat)
  const when = today
    ? `today, ${DateTime.formatIntl(published, timeFormat)}`
    : DateTime.formatIntl(published, dayMonthFormat)
  if (!rates.stale) return `Rates from ${when}`
  return `${navigator.onLine ? "Couldn't update" : "Offline"} · rates from ${when}`
}

const monthFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  timeZone: "UTC",
})
const monthYearFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

/**
 * The months the receipts span, e.g. `Sep – Oct 2026`. Receipts are sorted
 * newest first.
 */
const dateRange = (receipts: ReadonlyArray<Receipt>) => {
  const last = receipts[0].date
  const first = receipts[receipts.length - 1].date
  const a = DateTime.toPartsUtc(first)
  const b = DateTime.toPartsUtc(last)
  const end = DateTime.formatIntl(last, monthYearFormat)
  if (a.year === b.year && a.month === b.month) return end
  const start = DateTime.formatIntl(
    first,
    a.year === b.year ? monthFormat : monthYearFormat,
  )
  return `${start} – ${end}`
}

function CurrencyPicker({
  value,
  folderCurrency,
  summary,
  rates,
  onChange,
}: {
  value: string
  folderCurrency: string
  summary: Summary
  rates: Record<string, number>
  onChange: (currency: string) => void
}) {
  // the folder currency first, then the ones used in the folder, leaving out
  // currencies without a rate
  const items = useMemo(() => {
    const used =
      summary._tag === "Exact" ? [] : summary.lines.map((_) => _.currency)
    return Array.from(new Set([folderCurrency, ...used, ...codes])).filter(
      (currency) => currency === folderCurrency || rates[currency],
    )
  }, [folderCurrency, summary, rates])
  const approximate = summary._tag === "Converted" && summary.approximate

  return (
    <Combobox
      items={items}
      value={value}
      onValueChange={(currency) => {
        if (currency) onChange(currency)
      }}
    >
      <ComboboxTrigger
        aria-label={`Show totals in another currency, currently ${value}`}
        render={
          <Button
            variant="outline"
            size="sm"
            className="mt-2 gap-1 rounded-lg bg-background px-2 font-mono text-[13px] font-normal"
          >
            {approximate && <span aria-hidden>≈</span>}
            {value}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        }
      />
      <ComboboxContent className="w-52 font-mono" align="end">
        <ComboboxInput showTrigger={false} placeholder="Search currencies" />
        <ComboboxEmpty>No currencies</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              <span className="flex-1">{item}</span>
              {item === folderCurrency && (
                <span className="text-xs text-muted-foreground">folder</span>
              )}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
