// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { BigDecimal, DateTime } from "effect"
import { Receipt, ReceiptId } from "@/Domain/Receipt"
import { ReceiptGroupId } from "@/Domain/ReceiptGroup"
import { uuidBytes } from "@/lib/utils"
import { TotalsTape } from "./Totals"

afterEach(cleanup)

const at = (iso: string) => DateTime.makeUnsafe(iso)

const hotel = new Receipt({
  id: ReceiptId.make(uuidBytes("4fa05162-7384-4e95-8fa6-b0c7d8e9f03a")),
  date: at("2026-10-11T00:00:00.000Z"),
  description: "Hotel",
  merchant: "Ovolo",
  amount: BigDecimal.fromStringUnsafe("100"),
  currency: "USD",
  processed: true,
  groupId: ReceiptGroupId.make(
    uuidBytes("5ab16273-8495-4fa6-90b7-c1d8e9f0a14b"),
  ),
  createdAt: at("2026-10-11T00:00:00.000Z"),
  updatedAt: at("2026-10-11T00:00:00.000Z"),
})

it("labels the total with its own currency when the folder currency has no rate", () => {
  render(
    <TotalsTape
      receipts={[hotel]}
      folderCurrency="FRF"
      currency="FRF"
      rates={{
        _tag: "Available",
        rates: {
          rates: { USD: 1, EUR: 0.92 },
          timestamp: Date.parse("2026-10-23T00:00:00.000Z"),
          stale: false,
        },
      }}
      onCurrencyChange={() => {}}
      onOpenSettings={() => {}}
    />,
  )

  expect(screen.getByText("$100.00")).toBeTruthy()
  expect(screen.getByRole("combobox", { name: /currently USD$/ })).toBeTruthy()
  expect(screen.getByText("No exchange rate for FRF")).toBeTruthy()
})
