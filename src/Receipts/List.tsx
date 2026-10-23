import { Link } from "@tanstack/react-router"
import { DateTime } from "effect"
import { memo, useMemo } from "react"
import { Receipt } from "@/Domain/Receipt"
import { formatAmount } from "@/Domain/Currency"
import { summarize } from "@/Domain/Totals"
import { Monogram } from "@/components/ui/Monogram"

interface Month {
  readonly key: string
  readonly year: number
  readonly date: DateTime.Utc
  readonly receipts: Array<Receipt>
}

const groupByMonth = (receipts: ReadonlyArray<Receipt>): Array<Month> => {
  const months: Array<Month> = []
  for (const receipt of receipts) {
    const { year, month } = DateTime.toPartsUtc(receipt.date)
    const key = `${year}-${month}`
    const last = months[months.length - 1]
    if (last?.key === key) {
      last.receipts.push(receipt)
    } else {
      months.push({ key, year, date: receipt.date, receipts: [receipt] })
    }
  }
  return months
}

export function ReceiptList({
  receipts,
  currency,
  rates,
}: {
  receipts: ReadonlyArray<Receipt>
  currency: string
  rates: Record<string, number> | undefined
}) {
  const months = useMemo(() => groupByMonth(receipts), [receipts])
  const thisYear = DateTime.toPartsUtc(DateTime.nowUnsafe()).year

  return (
    <div className="flex flex-col gap-9">
      {months.map((month) => (
        <MonthSection
          key={month.key}
          month={month}
          showYear={month.year !== thisYear}
          currency={currency}
          rates={rates}
        />
      ))}
    </div>
  )
}

const monthHeading = new Intl.DateTimeFormat(undefined, {
  month: "long",
  timeZone: "UTC",
})
const monthYearHeading = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

const MonthSection = memo(function MonthSection({
  month,
  showYear,
  currency,
  rates,
}: {
  month: Month
  showYear: boolean
  currency: string
  rates: Record<string, number> | undefined
}) {
  const summary = useMemo(
    () => summarize({ receipts: month.receipts, currency, rates }),
    [month, currency, rates],
  )
  const subtotal =
    !summary || summary._tag === "Separate"
      ? `${month.receipts.length} receipts`
      : `${summary._tag === "Converted" && summary.approximate ? "≈ " : ""}${summary.currency} ${formatAmount(summary.total, summary.currency)}`

  return (
    <section aria-labelledby={`month-${month.key}`}>
      <header className="flex items-baseline justify-between gap-4 px-1 pb-2">
        <h2
          id={`month-${month.key}`}
          className="text-[15px] font-semibold tracking-tight"
        >
          {DateTime.formatIntl(
            month.date,
            showYear ? monthYearHeading : monthHeading,
          )}
        </h2>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {subtotal}
        </span>
      </header>
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {month.receipts.map((receipt) => (
          <li key={receipt.idString}>
            <ReceiptRow receipt={receipt} />
          </li>
        ))}
      </ul>
    </section>
  )
})

const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
})

const ReceiptRow = memo(function ReceiptRow({ receipt }: { receipt: Receipt }) {
  const day = DateTime.formatIntl(receipt.date, dayFormat)

  return (
    <Link
      to="/receipt/$id"
      params={{ id: receipt.idString }}
      className="flex items-center gap-3.5 px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
    >
      <Monogram name={receipt.monogramName} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium tracking-tight">
          {receipt.title}
        </div>
        {receipt.processing ? (
          <div className="mt-0.5 text-[13px]">
            <ProcessingPill />
          </div>
        ) : (
          // long merchant names truncate before the date does
          <div className="mt-0.5 flex text-[13px] text-muted-foreground">
            {receipt.merchant && (
              <span className="truncate">{receipt.merchant}</span>
            )}
            <span className="shrink-0 whitespace-pre">
              {receipt.merchant ? ` · ${day}` : day}
            </span>
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-[15px] font-medium tabular-nums">
          {receipt.hasAmount
            ? formatAmount(receipt.amount, receipt.currency)
            : "—"}
        </div>
        <div className="mt-0.5 font-mono text-[10.5px] tracking-[0.08em] text-muted-foreground">
          {receipt.currency}
        </div>
      </div>
    </Link>
  )
})

export function ProcessingPill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-tape-edge bg-tape px-2 py-0.5 text-[11px] text-muted-foreground">
      <span className="size-1.5 rounded-full bg-amber-500 motion-safe:animate-pulse" />
      Reading receipt…
    </span>
  )
}
