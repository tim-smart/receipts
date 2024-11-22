import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { Button } from "@/components/ui/Button"
import { TypoH3 } from "@/components/ui/TypoH3"
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { CurrencySelect } from "@/components/ui/CurrencySelect"
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { Receipt } from "@/Domain/Receipt"
import { Combobox } from "@/components/ui/ComboBox"
import { ArrowUpRight, Plus, Settings, Settings2 } from "lucide-react"
import { Scaffold } from "@/components/ui/Scaffold"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatCurrency } from "@/Domain/Currency"
import { ReceiptForm } from "@/Receipts/Form"
import { BigDecimal, DateTime, Effect, Option, Redacted } from "effect"
import {
  useRx,
  useRxSet,
  useRxSetPromise,
  useRxSuspenseSuccess,
  useRxValue,
} from "@effect-rx/rx-react"
import { baseCurrencyRx, latestRates, ratesWithRx } from "@/ExchangeRates/rx"
import { Switch } from "@/components/ui/switch"
import {
  createGroupRx,
  currentGroupRx,
  receiptGroupsRx,
  removeGroupRx,
  updateGroupRx,
} from "@/ReceiptGroups/rx"
import { uuidString } from "@/lib/utils"
import { setSettingRx, settingRx } from "@/Settings/rx"
import {
  currentGroupId,
  openaiApiKey,
  openaiModel,
  openExchangeApiKey,
} from "@/Domain/Setting"
import { ReceiptGroup, ReceiptGroupId } from "@/Domain/ReceiptGroup"
import { currentReceiptsRx, exportReceiptsRx } from "@/Receipts/rx"
import { clientRx } from "@/EventLog"
import * as Uuid from "uuid"
import { Model } from "@effect/sql"
import { sessionDestroyRx } from "@/Session"

export const Route = createFileRoute("/")({
  component: ReceiptsScreen,
  validateSearch(search: Record<string, unknown>): ReceiptsSearchParams {
    return {
      action: search.action === "add" ? "add" : undefined,
    }
  },
})

interface ReceiptsSearchParams {
  readonly action?: "add"
}

function ReceiptsScreen() {
  return (
    <Scaffold heading="Receipts">
      <div className="flex flex-col gap-5">
        <div className="w-full max-w-sm flex gap-2">
          <GroupSelect />
          <GroupSettings />
          <GroupDrawer />
        </div>

        <TotalsToggle />
        <ReceiptGrid />
        <AddReceiptButton />
      </div>
    </Scaffold>
  )
}

function GroupSelect() {
  const groups = useRxSuspenseSuccess(receiptGroupsRx).value
  const groupId = useRxValue(settingRx(currentGroupId))
  const setGroupId = useRxSet(setSettingRx(currentGroupId))
  const groupIdString = useMemo(
    () =>
      Option.match(groupId, {
        onNone: () => "",
        onSome: uuidString,
      }),
    [groupId],
  )
  const options = useMemo(
    () =>
      groups.map((folder) => ({
        value: uuidString(folder.id),
        label: folder.name,
      })) ?? [],
    [groups],
  )

  return (
    <Combobox
      options={options}
      value={groupIdString}
      onChange={(groupId) => {
        const uuid = ReceiptGroupId.make(Uuid.parse(groupId))
        setGroupId(uuid)
      }}
      placeholder="Select a folder"
      className="w-full"
    />
  )
}

function AddReceiptButton() {
  return (
    <div className="fixed bottom-0 left-0 w-full px-5 pb-safe flex flex-col items-center">
      <div className="flex gap-2 w-full max-w-sm">
        <ReceiptDrawer />
        <SettingsDrawer />
      </div>
      <div className="h-5" />
    </div>
  )
}

function ReceiptDrawer() {
  const { action } = Route.useSearch()
  const [open, setOpen] = useState(action === "add")
  const router = useRouter()

  useEffect(() => {
    if (action === "add") {
      router.navigate({ to: "/" })
    }
  }, [action])

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button className="flex-1">Add receipt</Button>
      </DrawerTrigger>

      <DrawerContent>
        <ReceiptForm
          onSubmit={() => {
            setOpen(false)
          }}
        />
      </DrawerContent>
    </Drawer>
  )
}

function GroupDrawer() {
  const [open, setOpen] = useState(false)
  const createGroup = useRxSet(createGroupRx)
  const setCurrentGroup = useRxSet(setSettingRx(currentGroupId))

  const onSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.target as HTMLFormElement)
    const groupId = ReceiptGroupId.make(Uuid.v4({}, new Uint8Array(16)))
    createGroup(
      ReceiptGroup.insert.make({
        id: Model.Override(groupId),
        name: data.get("name") as string,
        defaultCurrency: data.get("defaultCurrency") as string,
      }),
    )
    setCurrentGroup(groupId)
    setOpen(false)
  }, [])

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button className="px-3">
          <Plus />
        </Button>
      </DrawerTrigger>

      <DrawerContent>
        <form className="mx-auto w-full max-w-sm" onSubmit={onSubmit}>
          <DrawerHeader>
            <TypoH3>Add group</TypoH3>
          </DrawerHeader>
          <div className="grid gap-4 py-5 px-3">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input id="name" name="name" className="col-span-3" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="defaultCurrency" className="text-right">
                Default currency
              </Label>
              <CurrencySelect initialValue="USD" name="defaultCurrency" />
            </div>
          </div>
          <DrawerFooter>
            <Button>Create</Button>
          </DrawerFooter>
          <div className="h-5"></div>
        </form>
      </DrawerContent>
    </Drawer>
  )
}

function GroupSettings() {
  const currentGroup = useRxSuspenseSuccess(currentGroupRx).value
  const updateGroup = useRxSet(updateGroupRx)
  const removeGroup = useRxSet(removeGroupRx)
  const [open, setOpen] = useState(false)

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const data = new FormData(event.target as HTMLFormElement)
      updateGroup(
        ReceiptGroup.update.make({
          ...currentGroup,
          name: data.get("name") as string,
          defaultCurrency: data.get("defaultCurrency") as string,
          updatedAt: undefined,
        }),
      )
      setOpen(false)
    },
    [currentGroup],
  )

  const onRemove = useCallback(
    (event: any) => {
      event.preventDefault()
      removeGroup(currentGroup.id)
      setOpen(false)
    },
    [currentGroup],
  )

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button className="px-3" variant="outline">
          <Settings />
        </Button>
      </DrawerTrigger>

      <DrawerContent>
        <form className="mx-auto w-full max-w-sm" onSubmit={onSubmit}>
          <DrawerHeader>
            <TypoH3>Group settings</TypoH3>
          </DrawerHeader>
          <div className="grid gap-4 py-5 px-3">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                name="name"
                className="col-span-3"
                defaultValue={currentGroup.name}
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="defaultCurrency" className="text-right">
                Default currency
              </Label>
              <CurrencySelect
                initialValue={currentGroup.defaultCurrency}
                name="defaultCurrency"
              />
            </div>
          </div>
          <DrawerFooter>
            <Button variant="destructive" onClick={onRemove} type="button">
              Delete
            </Button>
            <Button type="submit">Save</Button>
          </DrawerFooter>
          <div className="h-5"></div>
        </form>
      </DrawerContent>
    </Drawer>
  )
}

function ReceiptGrid() {
  const receipts = useRxSuspenseSuccess(currentReceiptsRx).value

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {receipts.map((receipt) => (
        <Link key={receipt.idString} to={`/receipt/${receipt.idString}`}>
          <ReceiptCard>{receipt}</ReceiptCard>
        </Link>
      ))}
    </div>
  )
}

function ReceiptCard({ children }: { children: Receipt }) {
  return (
    <Card>
      <CardHeader className="p-4">
        <CardTitle className="whitespace-nowrap overflow-ellipsis overflow-hidden">
          {children.description}
        </CardTitle>
        <CardDescription>
          <div className="flex flex-col">
            {children.merchant && (
              <span className="overflow-ellipsis w-full whitespace-nowrap overflow-hidden">
                {children.merchant}
              </span>
            )}
            {children.amount && <span>{formatCurrency(children)}</span>}
            {children.date && (
              <span>
                {children.date.pipe(DateTime.format({ dateStyle: "short" }))}
              </span>
            )}
            {children.processed === false && <span>Processing...</span>}
          </div>
        </CardDescription>
      </CardHeader>
    </Card>
  )
}

function SettingsDrawer() {
  const [open, setOpen] = useState(false)
  const client = useRxSuspenseSuccess(clientRx).value
  const currentOpenaiApiKey = useRxValue(settingRx(openaiApiKey)).pipe(
    Option.map(Redacted.value),
    Option.getOrElse(() => ""),
  )
  const currentOpenaiModel = useRxValue(settingRx(openaiModel)).pipe(
    Option.getOrElse(() => ""),
  )
  const currentOpenExchangeKey = useRxValue(settingRx(openExchangeApiKey)).pipe(
    Option.map(Redacted.value),
    Option.getOrElse(() => ""),
  )
  const logout = useRxSet(sessionDestroyRx)

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const data = new FormData(event.target as HTMLFormElement)
      Effect.runPromise(
        client("SettingChange", {
          name: openaiApiKey.name,
          json: openaiApiKey.encodeSync(
            Redacted.make(data.get("openaiApiKey") as string),
          ),
        }),
      )
      Effect.runPromise(
        client("SettingChange", {
          name: openaiModel.name,
          json: openaiModel.encodeSync(data.get("openaiModel") as string),
        }),
      )
      await Effect.runPromise(
        client("SettingChange", {
          name: openExchangeApiKey.name,
          json: openExchangeApiKey.encodeSync(
            Redacted.make(data.get("openExchangeApiKey") as string),
          ),
        }),
      )
      setOpen(false)
    },
    [client],
  )

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" className="px-3">
          <Settings2 />
        </Button>
      </DrawerTrigger>

      <DrawerContent>
        <form className="mx-auto w-full max-w-sm" onSubmit={onSubmit}>
          <DrawerHeader>
            <TypoH3>Settings</TypoH3>
          </DrawerHeader>
          <div className="grid gap-4 py-5 px-3">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="openaiApiKey" className="text-right">
                OpenAI API key
              </Label>
              <Input
                id="openaiApiKey"
                name="openaiApiKey"
                className="col-span-3"
                defaultValue={currentOpenaiApiKey}
                type="password"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="openaiModel" className="text-right">
                OpenAI Model
              </Label>
              <Input
                id="openaiModel"
                name="openaiModel"
                className="col-span-3"
                defaultValue={currentOpenaiModel}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="openExchangeApiKey" className="text-right">
                Open Exchange Rates API key
              </Label>
              <Input
                id="openExchangeApiKey"
                name="openExchangeApiKey"
                className="col-span-3"
                defaultValue={currentOpenExchangeKey}
                type="password"
              />
            </div>
          </div>
          <DrawerFooter>
            <Button
              variant="destructive"
              onClick={(e) => {
                e.preventDefault()
                logout()
              }}
              type="button"
            >
              Sign out
            </Button>
            <Button type="submit">Save</Button>
          </DrawerFooter>
          <div className="h-5"></div>
        </form>
      </DrawerContent>
    </Drawer>
  )
}

function TotalsToggle() {
  const [open, setOpen] = useState(false)
  return (
    <Card className="flex-1">
      <CardHeader className="pr-2 pl-5 py-2 cursor-pointer">
        <div className="flex items-center">
          <CardDescription
            className="flex-1"
            onClick={() => setOpen((_) => !_)}
          >
            {open ? "Hide" : "Show"} totals
          </CardDescription>
          <ExportDrawer />
        </div>
      </CardHeader>
      {open && (
        <CardContent className="px-5 pt-0 pb-3 text-sm">
          <Totals />
        </CardContent>
      )}
    </Card>
  )
}

function Totals() {
  const receipts = useRxSuspenseSuccess(currentReceiptsRx).value
  const apiKey = useRxValue(settingRx(openExchangeApiKey)).pipe(
    Option.map(Redacted.value),
    Option.getOrElse(() => ""),
  )

  const [convertTo, setConvertTo] = useRx(baseCurrencyRx)
  const [rates, getRates] = useRx(latestRates)

  const totals = useMemo(() => {
    const currencies: Record<string, BigDecimal.BigDecimal> = {}
    for (const receipt of receipts) {
      const prev = currencies[receipt.currency] ?? BigDecimal.fromNumber(0)
      currencies[receipt.currency] = BigDecimal.sum(prev, receipt.amount)
    }
    return currencies
  }, [receipts])

  const converted = useMemo(() => {
    if (rates._tag !== "Success") return Option.none()
    let converted: BigDecimal.BigDecimal = BigDecimal.fromNumber(0)
    for (const [currency, total] of Object.entries(totals)) {
      const rate = 1 / rates.value[currency]
      converted = BigDecimal.multiply(total, BigDecimal.fromNumber(rate)).pipe(
        BigDecimal.sum(converted),
      )
    }
    return Option.some(converted)
  }, [totals, rates])

  return (
    <div className="flex flex-col gap-2">
      <div>
        {Object.entries(totals)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([currency, total]) => (
            <div key={currency}>
              {currency}: ${BigDecimal.format(total)}
              {rates._tag === "Success" && rates.value[currency] && (
                <span>
                  {" "}
                  ({convert(total, rates.value[currency], convertTo)})
                </span>
              )}
            </div>
          ))}
      </div>
      {apiKey && (
        <div>
          Convert to:{" "}
          <CurrencySelect
            initialValue={convertTo}
            onChange={(base) => {
              setConvertTo(base)
              getRates(apiKey)
            }}
          />
        </div>
      )}
      {Option.match(converted, {
        onNone: () => null,
        onSome: (converted) => (
          <div>
            Total in {convertTo}: $
            {BigDecimal.scale(converted, 2).pipe(BigDecimal.format)}
          </div>
        ),
      })}
    </div>
  )
}

const formatRate = (rate: number) => Math.round(rate * 10000) / 10000

const convert = (
  amount: BigDecimal.BigDecimal,
  rate: number,
  currency: string,
) => {
  const rateNumber = 1 / rate
  const converted = convertString(amount, rateNumber)
  return `x${formatRate(rateNumber)} = $${converted} ${currency}`
}

const convertString = (amount: BigDecimal.BigDecimal, rate: number) => {
  const rateNumber = 1 / rate
  return BigDecimal.multiply(amount, BigDecimal.fromNumber(rateNumber)).pipe(
    BigDecimal.scale(2),
    BigDecimal.format,
  )
}

function ExportDrawer() {
  const [open, setOpen] = useState(false)
  const [convert, setConvert] = useState(false)
  const [currency, setCurrency] = useState("USD")

  const groupId = useRxValue(settingRx(currentGroupId))
  const exportReceipts = useRxSetPromise(exportReceiptsRx)
  const apiKey = useRxValue(settingRx(openExchangeApiKey)).pipe(
    Option.map(Redacted.value),
    Option.getOrElse(() => ""),
  )
  const [rates, getRates] = useRx(ratesWithRx(apiKey))

  useEffect(() => {
    if (convert && currency) getRates(currency)
  }, [getRates, convert, currency])
  const loadingRates = convert && rates._tag !== "Success"

  const onExport = useCallback(async () => {
    if (groupId._tag === "None") return
    await exportReceipts({
      groupId: groupId.value,
      rates: rates._tag === "Success" ? rates.value : undefined,
      currency,
    })
    setOpen(false)
  }, [convert, currency, rates, exportReceipts, groupId])

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button type="button" className="px-3">
          <ArrowUpRight />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="w-full max-w-sm mx-auto">
          <DrawerHeader>
            <TypoH3>Export</TypoH3>
          </DrawerHeader>
          <div className="grid gap-4 py-5 px-3">
            {apiKey && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="convertCurrency" className="text-right">
                  Convert currency
                </Label>
                <Switch checked={convert} onCheckedChange={setConvert} />
              </div>
            )}
            {convert && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="currency" className="text-right">
                  Currency
                </Label>
                <CurrencySelect
                  name="currency"
                  onChange={setCurrency}
                  initialValue={currency}
                />
              </div>
            )}
          </div>
          <DrawerFooter>
            <Button type="submit" onClick={onExport} disabled={loadingRates}>
              {loadingRates ? "Loading rates..." : "Export"}
            </Button>
          </DrawerFooter>
          <div className="h-5"></div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
