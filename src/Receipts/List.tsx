import { Link } from "@tanstack/react-router"
import { useAtomValue } from "@effect/atom-react"
import { BigDecimal, DateTime } from "effect"
import { AsyncResult } from "effect/reactivity"
import { RefObject, useEffect, useMemo, useRef, useState } from "react"
import { Receipt } from "@/Domain/Receipt"
import { formatAmount } from "@/Domain/Currency"
import { isApproximate, summarize } from "@/Domain/Totals"
import { Monogram } from "@/components/ui/Monogram"
import { receiptAtom } from "./atoms"

interface Month {
  readonly key: string
  readonly date: DateTime.Utc
  readonly receipts: Array<Receipt>
}

const groupByMonth = (receipts: ReadonlyArray<Receipt>): Array<Month> => {
  const months: Array<Month> = []
  for (const receipt of receipts) {
    const parts = DateTime.toPartsUtc(receipt.date)
    const key = `${parts.year}-${parts.month}`
    const last = months[months.length - 1]
    if (last?.key === key) {
      last.receipts.push(receipt)
    } else {
      months.push({ key, date: receipt.date, receipts: [receipt] })
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
          showYear={DateTime.toPartsUtc(month.date).year !== thisYear}
          currency={currency}
          rates={rates}
        />
      ))}
    </div>
  )
}

function MonthSection({
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
  const summary = summarize({ receipts: month.receipts, currency, rates })
  const subtotal =
    summary?._tag === "Separate" || !summary
      ? `${month.receipts.length} receipts`
      : `${isApproximate(summary) ? "≈ " : ""}${summary.currency} ${formatAmount(summary.total, summary.currency)}`

  return (
    <section aria-labelledby={`month-${month.key}`}>
      <header className="flex items-baseline justify-between gap-4 px-1 pb-2">
        <h2
          id={`month-${month.key}`}
          className="text-[15px] font-semibold tracking-tight"
        >
          {month.date.pipe(
            DateTime.format({
              month: "long",
              year: showYear ? "numeric" : undefined,
            }),
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
}

function ReceiptRow({ receipt }: { receipt: Receipt }) {
  const processing = receipt.processed === false
  const title =
    receipt.description ||
    receipt.merchant ||
    (processing ? "New receipt" : "Receipt")
  const details = [
    receipt.merchant,
    receipt.date.pipe(
      DateTime.format({ weekday: "short", day: "numeric", month: "short" }),
    ),
  ]
    .filter(Boolean)
    .join(" · ")
  const hasAmount = !(processing && BigDecimal.isZero(receipt.amount))

  return (
    <Link
      to="/receipt/$id"
      params={{ id: receipt.idString }}
      className="flex items-center gap-3.5 px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
    >
      <ReceiptThumbnail receipt={receipt} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium tracking-tight">
          {title}
        </div>
        <div className="mt-0.5 truncate text-[13px] text-muted-foreground">
          {processing ? <ProcessingPill /> : details}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-[15px] font-medium tabular-nums">
          {hasAmount ? formatAmount(receipt.amount, receipt.currency) : "—"}
        </div>
        <div className="mt-0.5 font-mono text-[10.5px] tracking-[0.08em] text-muted-foreground">
          {receipt.currency}
        </div>
      </div>
    </Link>
  )
}

export function ProcessingPill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-tape-edge bg-tape px-2 py-0.5 text-[11px] text-muted-foreground">
      <span className="size-1.5 rounded-full bg-amber-500 motion-safe:animate-pulse" />
      Reading receipt…
    </span>
  )
}

/**
 * The receipt's first photo, or the merchant's monogram when it has none.
 * Images are only read from the database once the row scrolls into view.
 */
function ReceiptThumbnail({ receipt }: { receipt: Receipt }) {
  const ref = useRef<HTMLDivElement>(null)
  const visible = useInView(ref)
  return (
    <div ref={ref} className="size-10.5 shrink-0">
      {visible ? (
        <LoadedThumbnail receipt={receipt} />
      ) : (
        <div className="size-full rounded-[11px] bg-muted" />
      )}
    </div>
  )
}

function LoadedThumbnail({ receipt }: { receipt: Receipt }) {
  const result = useAtomValue(receiptAtom(receipt.idString))
  if (result._tag === "Initial") {
    return <div className="size-full rounded-[11px] bg-muted" />
  }
  const image = AsyncResult.isSuccess(result)
    ? result.value.images[0]
    : undefined
  if (!image) {
    return <Monogram name={receipt.merchant || receipt.description} />
  }
  return (
    <img
      src={image.objectUrl}
      alt=""
      className="size-full rounded-[11px] border object-cover object-top"
    />
  )
}

const useInView = (ref: RefObject<HTMLElement | null>) => {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element || inView) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setInView(true)
      },
      { rootMargin: "200px" },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, inView])
  return inView
}
