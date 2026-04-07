import { createFileRoute, Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
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
import {
  ChangeEvent,
  SubmitEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Receipt } from "@/Domain/Receipt"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox"
import {
  ArrowUpRight,
  ChevronsUpDown,
  Plus,
  Settings,
  Settings2,
} from "lucide-react"
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
import { BigDecimal, DateTime, Option, pipe, Redacted, String } from "effect"
import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react"
import {
  baseCurrencyAtom,
  latestRates,
  ratesWithAtom,
} from "@/ExchangeRates/atoms"
import { Switch } from "@/components/ui/switch"
import { currentGroupAtom, receiptGroupsAtom } from "@/ReceiptGroups/atoms"
import { uuidString } from "@/lib/utils"
import { setSettingAtom, settingAtom } from "@/Settings/atoms"
import {
  currentGroupId,
  openaiApiKey,
  openaiModel,
  openExchangeApiKey,
} from "@/Domain/Setting"
import { ReceiptGroup } from "@/Domain/ReceiptGroup"
import { currentReceiptsAtom, exportReceiptsAtom } from "@/Receipts/atoms"
import { remoteAddressAtom, writeEventAtom } from "@/EventLog"
import { sessionDestroyAtom } from "@/Session"
import { AsyncResult } from "effect/unstable/reactivity"

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
  const groups = useAtomValue(
    receiptGroupsAtom,
    AsyncResult.getOrElse(() => []),
  )
  const groupId = useAtomValue(
    settingAtom(currentGroupId),
    AsyncResult.value,
  ).pipe(Option.flatten)
  const setGroupId = useAtomSet(setSettingAtom(currentGroupId))
  const groupIdString = useMemo(
    () =>
      Option.match(groupId, {
        onNone: () => "",
        onSome: uuidString,
      }),
    [groupId],
  )
  const currentGroup = useMemo(
    () =>
      groups.find((group) => uuidString(group.id) === groupIdString) ?? null,
    [groups, groupIdString],
  )

  return (
    <Combobox<ReceiptGroup>
      items={groups}
      value={currentGroup}
      itemToStringValue={(item) => item.name}
      onValueChange={(group) => {
        if (!group) return
        setGroupId(group.id)
      }}
    >
      <ComboboxTrigger
        render={
          <Button
            variant="outline"
            className="w-64 justify-between font-normal"
          >
            <ComboboxValue>
              {(group: ReceiptGroup) => group?.name}
            </ComboboxValue>
            <ChevronsUpDown />
          </Button>
        }
      />
      <ComboboxContent>
        <ComboboxInput showTrigger={false} placeholder="Select a folder" />
        <ComboboxEmpty>No folders</ComboboxEmpty>
        <ComboboxList>
          {(group: ReceiptGroup) => (
            <ComboboxItem key={uuidString(group.id)} value={group}>
              {group?.name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
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
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (action === "add") {
      history.replaceState(null, "", "/")
    }
  }, [action])

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button className="flex-1">Add receipt</Button>
      </DrawerTrigger>

      <DrawerContent ref={contentRef}>
        <ReceiptForm
          onSubmit={() => {
            setOpen(false)
          }}
          portalContainer={contentRef}
        />
      </DrawerContent>
    </Drawer>
  )
}

function GroupDrawer() {
  const [open, setOpen] = useState(false)
  const writeEvent = useAtomSet(writeEventAtom)
  const setCurrentGroup = useAtomSet(setSettingAtom(currentGroupId))
  const contentRef = useRef<HTMLDivElement>(null)

  const onSubmit = useCallback((event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.target as HTMLFormElement)
    const group = ReceiptGroup.insert.make({
      name: data.get("name") as string,
      defaultCurrency: data.get("defaultCurrency") as string,
    })
    writeEvent({
      event: "GroupCreate",
      payload: group,
    })
    setCurrentGroup(group.id)
    setOpen(false)
  }, [])

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button className="px-3">
          <Plus />
        </Button>
      </DrawerTrigger>

      <DrawerContent ref={contentRef}>
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
              <Label htmlFor="defaultCurrency">Default currency</Label>
              <CurrencySelect
                initialValue="USD"
                name="defaultCurrency"
                portalContainer={contentRef}
              />
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
  const currentGroup = useAtomValue(
    currentGroupAtom,
    AsyncResult.getOrElse(() => null),
  )
  const writeEvent = useAtomSet(writeEventAtom)
  const [open, setOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const onSubmit = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault()
      const data = new FormData(event.target as HTMLFormElement)
      writeEvent({
        event: "GroupUpdate",
        payload: ReceiptGroup.update.make({
          ...currentGroup!,
          name: data.get("name") as string,
          defaultCurrency: data.get("defaultCurrency") as string,
          updatedAt: undefined,
        }),
      })
      setOpen(false)
    },
    [currentGroup],
  )

  const onRemove = useCallback(
    (event: any) => {
      event.preventDefault()
      writeEvent({
        event: "GroupDelete",
        payload: currentGroup!.id,
      })
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

      <DrawerContent ref={contentRef}>
        <form className="mx-auto w-full max-w-sm" onSubmit={onSubmit}>
          <DrawerHeader>
            <TypoH3>Group settings</TypoH3>
          </DrawerHeader>
          <div className="grid gap-4 py-5 px-3">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                className="col-span-3"
                defaultValue={currentGroup?.name}
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="defaultCurrency">Default currency</Label>
              <CurrencySelect
                initialValue={currentGroup?.defaultCurrency}
                name="defaultCurrency"
                portalContainer={contentRef}
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
  const receipts = useAtomValue(
    currentReceiptsAtom,
    AsyncResult.getOrElse(() => []),
  )

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {receipts.map((receipt) => (
        <Link
          key={receipt.idString}
          to="/receipt/$id"
          params={{ id: receipt.idString }}
        >
          <ReceiptCard>{receipt}</ReceiptCard>
        </Link>
      ))}
    </div>
  )
}

function ReceiptCard({ children: receipt }: { children: Receipt }) {
  return (
    <Card className="p-0">
      <CardHeader className="p-4">
        <CardTitle className="whitespace-nowrap overflow-ellipsis overflow-hidden">
          {receipt.description}
        </CardTitle>
        <CardDescription>
          <div className="flex flex-col">
            {receipt.merchant && (
              <span className="overflow-ellipsis w-full whitespace-nowrap overflow-hidden">
                {receipt.merchant}
              </span>
            )}
            {receipt.amount && <span>{formatCurrency(receipt)}</span>}
            {receipt.date && (
              <span>
                {receipt.date.pipe(DateTime.format({ dateStyle: "short" }))}
              </span>
            )}
            {receipt.processed === false && <span>Processing...</span>}
          </div>
        </CardDescription>
      </CardHeader>
    </Card>
  )
}

function SettingsDrawer() {
  const [open, setOpen] = useState(false)
  const writeEvent = useAtomSet(writeEventAtom, { mode: "promise" })
  const currentOpenaiApiKey = useAtomValue(
    settingAtom(openaiApiKey),
    AsyncResult.value,
  ).pipe(
    Option.flatten,
    Option.map(Redacted.value),
    Option.getOrElse(() => ""),
  )
  const currentOpenaiModel = useAtomValue(
    settingAtom(openaiModel),
    AsyncResult.value,
  ).pipe(
    Option.flatten,
    Option.getOrElse(() => ""),
  )
  const currentOpenExchangeKey = useAtomValue(
    settingAtom(openExchangeApiKey),
    AsyncResult.value,
  ).pipe(
    Option.flatten,
    Option.map(Redacted.value),
    Option.getOrElse(() => ""),
  )
  const [currentRemoteAddress, setRemoteAddress] = useAtom(remoteAddressAtom)
  const logout = useAtomSet(sessionDestroyAtom)

  const changed = useMemo(() => new Set<string>(), [])
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    changed.add(e.target.name)
  }

  const onSubmit = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault()
      const data = new FormData(event.target as HTMLFormElement)
      if (changed.has("openaiApiKey")) {
        writeEvent({
          event: "SettingChange",
          payload: {
            name: openaiApiKey.name,
            json: openaiApiKey.encodeSync(
              Redacted.make(data.get("openaiApiKey") as string),
            ),
          },
        })
      }
      if (changed.has("openaiModel")) {
        writeEvent({
          event: "SettingChange",
          payload: {
            name: openaiModel.name,
            json: openaiModel.encodeSync(data.get("openaiModel") as string),
          },
        })
      }
      if (changed.has("openExchangeApiKey")) {
        await writeEvent({
          event: "SettingChange",
          payload: {
            name: openExchangeApiKey.name,
            json: openExchangeApiKey.encodeSync(
              Redacted.make(data.get("openExchangeApiKey") as string),
            ),
          },
        })
      }
      if (changed.has("remoteAddress")) {
        setRemoteAddress(
          pipe(
            data.get("remoteAddress") as string,
            String.trim,
            Option.liftPredicate(String.isNonEmpty),
          ),
        )
      }
      changed.clear()
      setOpen(false)
    },
    [writeEvent],
  )

  return (
    <Drawer
      open={open}
      onOpenChange={(open) => {
        setOpen(open)
        if (!open) changed.clear()
      }}
    >
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
              <Label htmlFor="remoteAddress" className="text-right">
                Remote address
              </Label>
              <Input
                id="remoteAddress"
                name="remoteAddress"
                className="col-span-3"
                defaultValue={Option.getOrElse(currentRemoteAddress, () => "")}
                placeholder="wss://example.com"
                type="text"
                onChange={onChange}
              />
            </div>
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
                onChange={onChange}
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
                onChange={onChange}
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
                onChange={onChange}
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
    <Card className="flex-1 p-0 gap-0">
      <CardHeader className="pr-2 pl-5 py-2 cursor-pointer gap-0">
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
  const receipts = useAtomValue(
    currentReceiptsAtom,
    AsyncResult.getOrElse(() => []),
  )
  const apiKey = useAtomValue(
    settingAtom(openExchangeApiKey),
    AsyncResult.value,
  ).pipe(
    Option.flatten,
    Option.map(Redacted.value),
    Option.getOrElse(() => ""),
  )

  const [convertTo, setConvertTo] = useAtom(baseCurrencyAtom)
  const [rates, getRates] = useAtom(latestRates)

  const totals = useMemo(() => {
    const currencies: Record<string, BigDecimal.BigDecimal> = {}
    for (const receipt of receipts) {
      const prev =
        currencies[receipt.currency] ?? BigDecimal.fromNumberUnsafe(0)
      currencies[receipt.currency] = BigDecimal.sum(prev, receipt.amount)
    }
    return currencies
  }, [receipts])

  const converted = useMemo(() => {
    if (rates._tag !== "Success") return Option.none()
    let converted: BigDecimal.BigDecimal = BigDecimal.fromNumberUnsafe(0)
    for (const [currency, total] of Object.entries(totals)) {
      const rate = 1 / rates.value[currency]
      converted = BigDecimal.multiply(
        total,
        BigDecimal.fromNumberUnsafe(rate),
      ).pipe(BigDecimal.sum(converted))
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
        <div className="flex items-center gap-2">
          <div>Convert to:</div>
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

const convertString = (amount: BigDecimal.BigDecimal, rate: number) =>
  BigDecimal.multiply(amount, BigDecimal.fromNumberUnsafe(rate)).pipe(
    BigDecimal.scale(2),
    BigDecimal.format,
  )

function ExportDrawer() {
  const [open, setOpen] = useState(false)
  const [convert, setConvert] = useState(false)
  const [currency, setCurrency] = useState("USD")
  const contentRef = useRef<HTMLDivElement>(null)

  const groupId = useAtomValue(
    settingAtom(currentGroupId),
    AsyncResult.value,
  ).pipe(Option.flatten)
  const exportReceipts = useAtomSet(exportReceiptsAtom, { mode: "promise" })
  const apiKey = useAtomValue(
    settingAtom(openExchangeApiKey),
    AsyncResult.value,
  ).pipe(
    Option.flatten,
    Option.map(Redacted.value),
    Option.getOrElse(() => ""),
  )
  const [rates, getRates] = useAtom(ratesWithAtom(apiKey))

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
      <DrawerContent ref={contentRef}>
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
                  portalContainer={contentRef}
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
