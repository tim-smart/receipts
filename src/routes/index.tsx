import { createFileRoute } from "@tanstack/react-router"
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
  ComponentProps,
  SubmitEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox"
import { Camera, Download, Plus, Settings, Settings2 } from "lucide-react"
import { Dock, DockButton } from "@/components/ui/Dock"
import { ReceiptForm } from "@/Receipts/Form"
import { ReceiptList } from "@/Receipts/List"
import { TotalsTape, useViewCurrency } from "@/Receipts/Totals"
import { Exit, Option, pipe, Redacted, String } from "effect"
import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react"
import { availableRates, RatesState } from "@/ExchangeRates/atoms"
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
import { ReceiptGroup, ReceiptGroupId } from "@/Domain/ReceiptGroup"
import { Receipt } from "@/Domain/Receipt"
import { ReceiptGroupRow } from "@/ReceiptGroups/Events"
import { patchChanged } from "@/lib/utils"
import { currentReceiptsAtom, exportReceiptsAtom } from "@/Receipts/atoms"
import { remoteAddressAtom, writeEventAtom } from "@/EventLog"
import { sessionDestroyAtom } from "@/Session"
import { AsyncResult } from "effect/reactivity"
import { exportBackupAtom, importBackupAtom } from "@/Backup/atoms"
import { toast } from "sonner"

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

interface DrawerState {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

function ReceiptsScreen() {
  const { action } = Route.useSearch()
  const [adding, setAdding] = useState(action === "add")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [folderSettingsOpen, setFolderSettingsOpen] = useState(false)

  const group = useAtomValue(
    currentGroupAtom,
    AsyncResult.getOrElse(() => null),
  )
  const receipts = useAtomValue(
    currentReceiptsAtom,
    AsyncResult.getOrElse(() => []),
  )

  const addButton = (
    <DockButton disabled={!group} onClick={() => setAdding(true)}>
      <Camera className="size-4.5" />
      Add receipt
    </DockButton>
  )

  return (
    <>
      <div className="mx-auto w-full max-w-2xl lg:grid lg:max-w-none lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[24rem_minmax(0,1fr)] xl:gap-16">
        <div className="lg:sticky lg:top-0 lg:-mx-2 lg:max-h-svh lg:self-start lg:overflow-y-auto lg:px-2 lg:pb-10">
          <header className="flex items-start justify-between gap-4 pt-14 lg:pt-16">
            <div className="min-w-0">
              <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
                Receipts
              </h1>
              <FolderMenu
                onNewFolder={() => setNewFolderOpen(true)}
                onFolderSettings={() => setFolderSettingsOpen(true)}
              />
            </div>
            <Button
              variant="outline"
              size="icon-lg"
              className="mt-0.5 rounded-full"
              aria-label="Settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 />
            </Button>
          </header>

          {group && receipts.length > 0 && (
            <FolderTotals
              group={group}
              receipts={receipts}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          )}

          <div className="mt-7 hidden lg:block">{addButton}</div>
        </div>

        <main className="pt-9 lg:pt-16">
          {group && receipts.length > 0 ? (
            <FolderReceipts group={group} receipts={receipts} />
          ) : (
            group && <EmptyFolder group={group} />
          )}
        </main>
      </div>

      <div className="h-32 lg:h-16" />
      <Dock className="lg:hidden">{addButton}</Dock>

      <ReceiptDrawer open={adding} onOpenChange={setAdding} />
      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
      <GroupDrawer open={newFolderOpen} onOpenChange={setNewFolderOpen} />
      <GroupSettings
        open={folderSettingsOpen}
        onOpenChange={setFolderSettingsOpen}
      />
    </>
  )
}

function FolderTotals({
  group,
  receipts,
  onOpenSettings,
}: {
  group: ReceiptGroup
  receipts: ReadonlyArray<Receipt>
  onOpenSettings: () => void
}) {
  const { rates, currency, setCurrency } = useViewCurrency(group)

  return (
    <TotalsTape
      className="mt-6"
      receipts={receipts}
      folderCurrency={group.defaultCurrency}
      rates={rates}
      currency={currency}
      onCurrencyChange={setCurrency}
      onOpenSettings={onOpenSettings}
      action={
        <ExportDrawer groupId={group.id} currency={currency} rates={rates} />
      }
    />
  )
}

function FolderReceipts({
  group,
  receipts,
}: {
  group: ReceiptGroup
  receipts: ReadonlyArray<Receipt>
}) {
  const { rates, currency } = useViewCurrency(group)

  return (
    <ReceiptList
      receipts={receipts}
      currency={currency}
      rates={availableRates(rates)?.rates}
    />
  )
}

function EmptyFolder({ group }: { group: ReceiptGroup }) {
  return (
    <div className="rounded-2xl border border-dashed px-6 py-12 text-center">
      <p className="font-medium">No receipts in {group.name} yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Use Add receipt to take a photo or enter one by hand.
      </p>
    </div>
  )
}

function FolderMenu({
  onNewFolder,
  onFolderSettings,
}: {
  onNewFolder: () => void
  onFolderSettings: () => void
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const groupsResult = useAtomValue(receiptGroupsAtom)
  const groups = AsyncResult.getOrElse(groupsResult, () => [])
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
    () => groups.find((group) => group.idString === groupIdString) ?? null,
    [groups, groupIdString],
  )
  const menuAction = (action: () => void) => () => {
    setOpen(false)
    // the drawer returns focus here when it closes, as the menu is gone
    triggerRef.current?.focus()
    action()
  }

  return (
    <Combobox<ReceiptGroup>
      open={open}
      onOpenChange={setOpen}
      items={groups}
      value={currentGroup}
      itemToStringValue={(item) => item.name}
      onValueChange={(group) => {
        if (!group) return
        setGroupId(group.id)
      }}
    >
      <ComboboxTrigger
        ref={triggerRef}
        // comboboxes take their name from a label, not their content
        aria-label={
          currentGroup ? `Folder: ${currentGroup.name}` : "Choose a folder"
        }
        className="-ml-1 mt-2 inline-flex max-w-full items-center gap-1 rounded-md px-1 py-0.5 text-[15px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:text-foreground"
      >
        <span className="truncate">
          {currentGroup
            ? currentGroup.name
            : AsyncResult.isSuccess(groupsResult) && "Choose a folder"}
        </span>
      </ComboboxTrigger>
      <ComboboxContent className="w-64">
        <ComboboxInput showTrigger={false} placeholder="Find a folder" />
        <ComboboxEmpty>No folders</ComboboxEmpty>
        <ComboboxList>
          {(group: ReceiptGroup) => (
            <ComboboxItem key={group.idString} value={group}>
              {group?.name}
            </ComboboxItem>
          )}
        </ComboboxList>
        <div className="grid border-t p-1">
          <MenuButton onClick={menuAction(onNewFolder)}>
            <Plus />
            New folder
          </MenuButton>
          <MenuButton onClick={menuAction(onFolderSettings)}>
            <Settings />
            Folder settings
          </MenuButton>
        </div>
      </ComboboxContent>
    </Combobox>
  )
}

function MenuButton(props: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className="flex items-center gap-2 rounded-sm px-1.5 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent [&_svg]:size-4 [&_svg]:text-muted-foreground"
      {...props}
    />
  )
}

function ReceiptDrawer({ open, onOpenChange }: DrawerState) {
  const { action } = Route.useSearch()
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (action === "add") {
      history.replaceState(null, "", "/")
    }
  }, [action])

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent ref={contentRef}>
        <ReceiptForm
          onSubmit={() => {
            onOpenChange(false)
          }}
          portalContainer={contentRef}
        />
      </DrawerContent>
    </Drawer>
  )
}

function GroupDrawer({ open, onOpenChange }: DrawerState) {
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
    writeEvent(ReceiptGroupRow.set(group))
    setCurrentGroup(group.id)
    onOpenChange(false)
  }, [])

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent ref={contentRef}>
        <form className="mx-auto w-full max-w-sm" onSubmit={onSubmit}>
          <DrawerHeader>
            <TypoH3>New folder</TypoH3>
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

function GroupSettings({ open, onOpenChange }: DrawerState) {
  const currentGroup = useAtomValue(
    currentGroupAtom,
    AsyncResult.getOrElse(() => null),
  )
  const writeEvent = useAtomSet(writeEventAtom)
  const contentRef = useRef<HTMLDivElement>(null)

  const onSubmit = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault()
      const data = new FormData(event.target as HTMLFormElement)
      const patch = patchChanged(ReceiptGroupRow, currentGroup!, {
        name: data.get("name") as string,
        defaultCurrency: data.get("defaultCurrency") as string,
      })
      if (patch) writeEvent(patch)
      onOpenChange(false)
    },
    [currentGroup],
  )

  const onRemove = useCallback(
    (event: any) => {
      event.preventDefault()
      writeEvent(ReceiptGroupRow.remove(currentGroup!.id))
      onOpenChange(false)
    },
    [currentGroup],
  )

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent ref={contentRef}>
        <form className="mx-auto w-full max-w-sm" onSubmit={onSubmit}>
          <DrawerHeader>
            <TypoH3>Folder settings</TypoH3>
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
              Delete folder
            </Button>
            <Button type="submit">Save</Button>
          </DrawerFooter>
          <div className="h-5"></div>
        </form>
      </DrawerContent>
    </Drawer>
  )
}

function SettingsDrawer({ open, onOpenChange }: DrawerState) {
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
    // @effect-diagnostics-next-line asyncFunction:off
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
      onOpenChange(false)
    },
    [writeEvent],
  )

  return (
    <Drawer
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open)
        if (!open) changed.clear()
      }}
    >
      <DrawerContent>
        <form
          className="mx-auto flex min-h-0 w-full max-w-sm flex-col"
          onSubmit={onSubmit}
        >
          <DrawerHeader>
            <TypoH3>Settings</TypoH3>
          </DrawerHeader>
          {/* scrolls between the pinned header and footer on short screens */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid gap-4 py-5 px-3">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="remoteAddress" className="text-right">
                  Remote address
                </Label>
                <Input
                  id="remoteAddress"
                  name="remoteAddress"
                  className="col-span-3"
                  defaultValue={Option.getOrElse(
                    currentRemoteAddress,
                    () => "",
                  )}
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
            <BackupSection />
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

function BackupSection() {
  const exportBackup = useAtomSet(exportBackupAtom, { mode: "promiseExit" })
  const importBackup = useAtomSet(importBackupAtom, { mode: "promiseExit" })
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  // @effect-diagnostics-next-line asyncFunction:off
  const onExport = useCallback(async () => {
    setBusy(true)
    const exit = await exportBackup()
    setBusy(false)
    if (Exit.isFailure(exit)) toast.error("Export failed")
  }, [exportBackup])

  // @effect-diagnostics-next-line asyncFunction:off
  const onImport = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ""
      if (!file) return
      setBusy(true)
      const exit = await importBackup(file)
      setBusy(false)
      if (Exit.isSuccess(exit)) {
        const { groups, receipts, images, skipped, recovered } = exit.value
        toast.success(
          `Imported ${groups} groups, ${receipts} receipts, ${images} images` +
            (skipped > 0 ? ` (${skipped} already existed)` : ""),
          recovered && {
            description: `${recovered.receipts} receipts and ${recovered.images} images moved to "Recovered receipts"`,
          },
        )
      } else {
        const message = Exit.findErrorOption(exit).pipe(
          Option.map((error) => error.message),
          Option.getOrElse(() => "Unknown error"),
        )
        toast.error(`Import failed: ${message}`)
      }
    },
    [importBackup],
  )

  return (
    <div className="grid gap-3 px-3 pb-5">
      <TypoH3>Backup</TypoH3>
      <p className="text-sm text-muted-foreground">
        Includes groups, receipts and images. Settings and API keys are{" "}
        <strong>not</strong> included. Import only adds missing records.
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={busy}
          onClick={onExport}
        >
          Export backup
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          Import backup
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={onImport}
      />
    </div>
  )
}

function ExportDrawer({
  groupId,
  currency: viewCurrency,
  rates,
}: {
  groupId: typeof ReceiptGroupId.Type
  currency: string
  rates: RatesState | undefined
}) {
  const [open, setOpen] = useState(false)
  const [convert, setConvert] = useState(false)
  const [currency, setCurrency] = useState(viewCurrency)
  const contentRef = useRef<HTMLDivElement>(null)

  const exportReceipts = useAtomSet(exportReceiptsAtom, { mode: "promise" })
  const available = availableRates(rates)

  // @effect-diagnostics-next-line asyncFunction:off
  const onExport = useCallback(async () => {
    const rates = convert ? available?.rates : undefined
    if (convert && !rates?.[currency]) {
      toast.error(`There's no exchange rate for ${currency}`)
      return
    }
    await exportReceipts({ groupId, rates, currency })
    setOpen(false)
  }, [convert, currency, available, exportReceipts, groupId])

  return (
    <Drawer
      open={open}
      onOpenChange={(open) => {
        // follow the currency the totals are shown in
        if (open) {
          setConvert(available !== undefined)
          setCurrency(viewCurrency)
        }
        setOpen(open)
      }}
    >
      <DrawerTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="-mr-1.5 text-muted-foreground"
          aria-label="Export receipts"
        >
          <Download />
        </Button>
      </DrawerTrigger>
      <DrawerContent ref={contentRef}>
        <div className="w-full max-w-sm mx-auto">
          <DrawerHeader>
            <TypoH3>Export</TypoH3>
          </DrawerHeader>
          <div className="grid gap-4 py-5 px-3">
            {available && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="convertCurrency" className="text-right">
                  Convert currency
                </Label>
                <Switch
                  id="convertCurrency"
                  checked={convert}
                  onCheckedChange={setConvert}
                />
              </div>
            )}
            {convert && available && (
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
            <Button type="submit" onClick={onExport}>
              Export
            </Button>
          </DrawerFooter>
          <div className="h-5"></div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
