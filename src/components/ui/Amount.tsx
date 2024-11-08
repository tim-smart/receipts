import { BigDecimal } from "effect"

export function Amount({
  children,
  currency,
}: {
  children: string
  currency: string
}) {
  const amount = BigDecimal.unsafeFromString(children).pipe(
    BigDecimal.unsafeToNumber,
  )

  return (
    <h3 className="scroll-m-20 text-zinc-400 text-3xl font-extrabold tracking-tight lg:text-5xl text-center">
      ${amount.toFixed(2)} {currency ?? ""}
    </h3>
  )
}
