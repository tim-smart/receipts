import { createFileRoute, Link } from "@tanstack/react-router"
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
import { FormEvent, useCallback, useMemo, useRef, useState } from "react"
import { Receipt, ReceiptList, ReceiptOrder } from "@/Domain/Receipt"
import { useAccount } from "@/lib/Jazz"
import { Folder } from "@/Domain/Folder"
import { Combobox } from "@/components/ui/ComboBox"
import { Group } from "jazz-tools"
import { Plus, Settings, Settings2 } from "lucide-react"
import { Scaffold } from "@/components/ui/Scaffold"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatCurrency } from "@/Domain/Currency"
import { FolderProvider, useFolder } from "@/Folders/context"
import { ReceiptForm } from "@/Receipts/Form"
import { BigDecimal, DateTime, Option, Predicate } from "effect"
import { useRx } from "@effect-rx/rx-react"
import { baseCurrencyRx, latestRates } from "@/ExchangeRates/rx"
import { createInviteLink } from "jazz-browser"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"

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

        <FolderProvider>
          <TotalsToggle />
          <ReceiptGrid />
          <AddReceiptButton />
        </FolderProvider>
      </div>
    </Scaffold>
  )
}

function GroupSelect() {
  const root = useAccount().me?.root
  const folders = root?.folders
  const options = useMemo(
    () =>
      folders?.filter(Predicate.isNotNullable).map((folder) => ({
        value: folder!.id,
        label: folder!.name,
      })) ?? [],
    [folders],
  )

  return (
    <Combobox
      options={options}
      value={root?.currentFolder?.id ?? ""}
      onChange={(folderId) => {
        root!.currentFolder = folders?.find((_) => _?.id === folderId)!
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
  const { me } = useAccount()
  const [open, setOpen] = useState(false)

  const onSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.target as HTMLFormElement)
    const owner = Group.create({ owner: me })
    const folder = Folder.create(
      {
        name: data.get("name") as string,
        items: ReceiptList.create([], { owner }),
        defaultCurrency: data.get("defaultCurrency") as string,
      },
      { owner },
    )
    me.root!.folders?.push(folder)
    me.root!.currentFolder = folder
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
  const account = useAccount().me
  const root = account.root!
  const folder = root?.currentFolder!
  const [open, setOpen] = useState(false)

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const data = new FormData(event.target as HTMLFormElement)
      folder.name = data.get("name") as string
      folder.defaultCurrency = data.get("defaultCurrency") as string
      setOpen(false)
    },
    [folder],
  )

  const onRemove = useCallback(
    (event: any) => {
      event.preventDefault()
      const index = root.folders!.findIndex((f) => f?.id === folder.id)
      if (index === -1) return
      root.folders?.splice(index, 1)
      root.currentFolder = root.folders![0]
      setOpen(false)
    },
    [folder],
  )

  const readOnlyRef = useRef<HTMLButtonElement>(null)
  const onShare = useCallback(
    (e: any) => {
      e.preventDefault()
      const readOnly = readOnlyRef.current!.value === "on"
      const link = createInviteLink(folder, readOnly ? "reader" : "writer")
      navigator.clipboard.writeText(link)
      toast("Copied link to the clipboard!")
    },
    [folder, readOnlyRef],
  )

  if (!folder) return null

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
                defaultValue={folder.name}
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="defaultCurrency" className="text-right">
                Default currency
              </Label>
              <CurrencySelect
                initialValue={folder.defaultCurrency}
                name="defaultCurrency"
              />
            </div>
          </div>
          <DrawerFooter>
            <Button variant="destructive" onClick={onRemove} type="button">
              Delete
            </Button>
            <div className="flex gap-2 items-center">
              <Button
                type="button"
                variant="outline"
                onClick={onShare}
                className="flex-1"
              >
                Share
              </Button>
              <div className="flex items-center gap-1">
                <Switch ref={readOnlyRef} id="shareReadOnly" defaultChecked />
                <Label htmlFor="shareReadOnly">Read-only</Label>
              </div>
            </div>
            <Button type="submit">Save</Button>
          </DrawerFooter>
          <div className="h-5"></div>
        </form>
      </DrawerContent>
    </Drawer>
  )
}

function ReceiptGrid() {
  const folder = useFolder()
  const receipts = folder.items
  if (!receipts) return null

  return (
    <div className="grid grid-cols-2 gap-2">
      {receipts!
        .filter((r): r is Receipt => !!r && r.deleted !== true)
        .sort(ReceiptOrder)
        .map((receipt) => (
          <Link key={receipt!.id} to={`/receipt/${receipt!.id}`}>
            <ReceiptCard>{receipt!}</ReceiptCard>
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
                {DateTime.unsafeFromDate(children.date).pipe(
                  DateTime.format({ dateStyle: "short" }),
                )}
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
  const account = useAccount()
  const root = account.me.root!
  const [open, setOpen] = useState(false)

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const data = new FormData(event.target as HTMLFormElement)
      root.openaiApiKey = data.get("openaiApiKey") as string
      root.openaiModel = data.get("openaiModel") as string
      root.openExchangeApiKey = data.get("openExchangeApiKey") as string
      setOpen(false)
    },
    [root],
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
                defaultValue={root.openaiApiKey}
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
                defaultValue={root.openaiModel}
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
                defaultValue={root.openExchangeApiKey}
                type="password"
              />
            </div>
          </div>
          <DrawerFooter>
            <Button
              variant="destructive"
              onClick={(e) => {
                e.preventDefault()
                account.logOut()
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
    <Card>
      <CardHeader
        className="px-5 py-3 cursor-pointer"
        onClick={() => setOpen((_) => !_)}
      >
        <CardDescription>{open ? "Hide" : "Show"} totals</CardDescription>
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
  const account = useAccount()
  const folder = useFolder()
  const receipts = folder?.items

  const openExchangeApiKey = account.me.root?.openExchangeApiKey

  const [convertTo, setConvertTo] = useRx(baseCurrencyRx)
  const [rates, getRates] = useRx(latestRates)

  const totals = useMemo(() => {
    if (!receipts) return null
    const currencies: Record<string, BigDecimal.BigDecimal> = {}
    for (const receipt of receipts) {
      if (!receipt || receipt.deleted || !Number(receipt.amount)) continue
      const prev = currencies[receipt.currency] ?? BigDecimal.fromNumber(0)
      currencies[receipt.currency] = BigDecimal.sum(
        prev,
        BigDecimal.unsafeFromString(receipt.amount),
      )
    }
    return currencies
  }, [receipts])

  if (!totals) return null

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
    <>
      {Object.entries(totals)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([currency, total]) => (
          <div key={currency}>
            {currency}: ${BigDecimal.format(total)}
            {rates._tag === "Success" && rates.value[currency] && (
              <span> ({convert(total, rates.value[currency], convertTo)})</span>
            )}
          </div>
        ))}
      {openExchangeApiKey && (
        <div>
          Convert to:{" "}
          <CurrencySelect
            initialValue={convertTo}
            onChange={(base) => {
              setConvertTo(base)
              getRates(openExchangeApiKey)
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
    </>
  )
}

const formatRate = (rate: number) => Math.round(rate * 10000) / 10000

const convert = (
  amount: BigDecimal.BigDecimal,
  rate: number,
  currency: string,
) => {
  const rateNumber = 1 / rate
  const converted = BigDecimal.multiply(
    amount,
    BigDecimal.fromNumber(rateNumber),
  ).pipe(BigDecimal.scale(2))
  return `x${formatRate(rateNumber)} = $${BigDecimal.format(converted)} ${currency}`
}
