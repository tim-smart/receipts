import { useAtom } from "@effect/atom-react"
import { DateTime } from "effect"
import { ReactNode, useMemo } from "react"
import { ChevronDown } from "lucide-react"
import { Receipt } from "@/Domain/Receipt"
import { ReceiptGroup } from "@/Domain/ReceiptGroup"
import { codes, formatAmount, formatCurrency } from "@/Domain/Currency"
import { isApproximate, Summary, summarize } from "@/Domain/Totals"
import { Rates, RatesState, viewCurrenciesAtom } from "@/ExchangeRates/atoms"
import { uuidString } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { TillTape, TillTapeHead, TillTapeLine } from "@/components/ui/TillTape"
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
 * The currency a folder's totals are shown in on this device. Falls back to
 * the folder's default currency when there are no rates to convert with.
 */
export const useViewCurrency = (
  group: ReceiptGroup,
  rates: RatesState | undefined,
) => {
  const [viewCurrencies, setViewCurrencies] = useAtom(viewCurrenciesAtom)
  const groupId = uuidString(group.id)
  const chosen = viewCurrencies[groupId]
  // only use the chosen currency while there's a rate to convert into it
  const currency =
    chosen && rates?._tag === "Available" && rates.rates.rates[chosen]
      ? chosen
      : group.defaultCurrency
  const setCurrency = (currency: string) => {
    const { [groupId]: _, ...rest } = viewCurrencies
    setViewCurrencies(
      currency === group.defaultCurrency
        ? rest
        : { ...rest, [groupId]: currency },
    )
  }
  return [currency, setCurrency] as const
}

export function TotalsTape({
  receipts,
  group,
  rates,
  currency,
  onCurrencyChange,
  onOpenSettings,
  action,
  className,
}: {
  receipts: ReadonlyArray<Receipt>
  group: ReceiptGroup
  /** `undefined` while the rates are loading. */
  rates: RatesState | undefined
  currency: string
  onCurrencyChange: (currency: string) => void
  onOpenSettings: () => void
  action?: ReactNode
  className?: string
}) {
  const available = rates?._tag === "Available" ? rates.rates : undefined
  const summary = useMemo(
    () => summarize({ receipts, currency, rates: available?.rates }),
    [receipts, currency, available],
  )
  if (!summary) return null

  const picker = available && (
    <CurrencyPicker
      value={currency}
      folderCurrency={group.defaultCurrency}
      used={
        summary._tag === "Exact" ? [] : summary.lines.map((_) => _.currency)
      }
      rates={available.rates}
      approximate={isApproximate(summary)}
      onChange={onCurrencyChange}
    />
  )

  return (
    <TillTape className={className}>
      <TillTapeHead>
        <span>
          <span className="whitespace-nowrap">
            {summary.count} {summary.count === 1 ? "receipt" : "receipts"} ·
          </span>{" "}
          <span className="whitespace-nowrap">{dateRange(receipts)}</span>
        </span>
        {action}
      </TillTapeHead>

      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="text-[40px] leading-tight font-bold tracking-[-0.04em] tabular-nums">
          {headline(summary)}
        </span>
        {picker || (
          <span className="pt-2 font-mono text-[13px] text-muted-foreground">
            {summary._tag === "Separate"
              ? summary.lines[0].currency
              : summary.currency}
          </span>
        )}
      </div>

      <Lines summary={summary} />
      <Footer
        summary={summary}
        rates={rates}
        available={available}
        currency={currency}
        folderCurrency={group.defaultCurrency}
        onReset={() => onCurrencyChange(group.defaultCurrency)}
        onOpenSettings={onOpenSettings}
      />
    </TillTape>
  )
}

const headline = (summary: Summary) => {
  return summary._tag === "Separate"
    ? formatCurrency(summary.lines[0])
    : formatCurrency({ amount: summary.total, currency: summary.currency })
}

function Lines({ summary }: { summary: Summary }) {
  if (summary._tag === "Exact") return null
  const lines =
    summary._tag === "Separate" ? summary.lines.slice(1) : summary.lines
  const excluded = summary._tag === "Converted" ? summary.excluded : []
  return (
    <div className="mt-3.5 grid gap-1">
      {lines.map((line) => (
        <TillTapeLine
          key={line.currency}
          label={
            summary._tag === "Separate" || excluded.includes(line.currency)
              ? `+ ${line.currency}`
              : line.currency
          }
          value={formatAmount(line.amount, line.currency)}
        />
      ))}
    </div>
  )
}

function Footer({
  summary,
  rates,
  available,
  currency,
  folderCurrency,
  onReset,
  onOpenSettings,
}: {
  summary: Summary
  rates: RatesState | undefined
  available: Rates | undefined
  currency: string
  folderCurrency: string
  onReset: () => void
  onOpenSettings: () => void
}) {
  let note: ReactNode = null
  let link: ReactNode = null

  if (summary._tag === "Converted" && available) {
    note = ratesNote(available)
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

const ratesNote = (rates: Rates) => {
  const published = DateTime.makeUnsafe(rates.timestamp)
  const day = DateTime.formatLocal({ dateStyle: "short" })
  const when =
    day(published) === day(DateTime.nowUnsafe())
      ? `today, ${DateTime.formatLocal(published, { hour: "numeric", minute: "2-digit" })}`
      : DateTime.formatLocal(published, { day: "numeric", month: "short" })
  if (!rates.stale) return `Rates from ${when}`
  return `${navigator.onLine ? "Couldn't update" : "Offline"} · rates from ${when}`
}

const monthFormat = DateTime.format({ month: "short" })
const monthYearFormat = DateTime.format({ month: "short", year: "numeric" })

/**
 * The months the receipts span, e.g. `Sep – Oct 2026`. Receipts are sorted
 * newest first.
 */
const dateRange = (receipts: ReadonlyArray<Receipt>) => {
  const last = receipts[0].date
  const first = receipts[receipts.length - 1].date
  const a = DateTime.toPartsUtc(first)
  const b = DateTime.toPartsUtc(last)
  if (a.year === b.year && a.month === b.month) return monthYearFormat(last)
  if (a.year === b.year)
    return `${monthFormat(first)} – ${monthYearFormat(last)}`
  return `${monthYearFormat(first)} – ${monthYearFormat(last)}`
}

function CurrencyPicker({
  value,
  folderCurrency,
  used,
  rates,
  approximate,
  onChange,
}: {
  value: string
  folderCurrency: string
  used: ReadonlyArray<string>
  rates: Record<string, number>
  approximate: boolean
  onChange: (currency: string) => void
}) {
  // the folder currency first, then the ones used in the folder, leaving out
  // currencies without a rate
  const items = useMemo(
    () =>
      Array.from(new Set([folderCurrency, ...used, ...codes])).filter(
        (currency) => currency === folderCurrency || rates[currency],
      ),
    [folderCurrency, used, rates],
  )

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
