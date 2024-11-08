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
import { FormEvent, useCallback, useMemo, useState } from "react"
import { Receipt, ReceiptList } from "@/Domain/Receipt"
import { useAccount, useCoState } from "@/lib/Jazz"
import { Folder } from "@/Domain/Folder"
import { ReceiptsAccountRoot } from "@/Domain/Account"
import { Combobox } from "@/components/ui/ComboBox"
import { Group } from "jazz-tools"
import { Plus, Settings, Settings2 } from "lucide-react"
import { Scaffold } from "@/components/ui/Scaffold"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatCurrency } from "@/Domain/Currency"
import { FolderProvider, useFolder } from "@/Folders/context"
import { ReceiptForm } from "@/Receipts/components/Form"

export const Route = createFileRoute("/")({
  component: ReceiptsScreen,
})

function ReceiptsScreen() {
  return (
    <Scaffold heading="Receipts">
      <div className="flex flex-col gap-7">
        <div className="w-full max-w-sm flex gap-2">
          <GroupSelect />
          <GroupSettings />
          <GroupDrawer />
        </div>

        <FolderProvider>
          <ReceiptGrid />
          <AddReceiptButton />
        </FolderProvider>
      </div>
    </Scaffold>
  )
}

function GroupSelect() {
  const account = useAccount()
  const root = useCoState(ReceiptsAccountRoot, account.me.root?.id)
  const folders = root?.folders
  const options = useMemo(
    () =>
      folders
        ?.filter((f) => f && f.deleted !== true)
        .map((folder) => ({
          value: folder!.id,
          label: folder!.name,
        })),
    [folders],
  )
  if (!options) return null

  return (
    <Combobox
      options={options}
      value={root!.currentFolder?.id as string}
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
  const [open, setOpen] = useState(false)

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
        deleted: false,
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
          </div>
          <div className="grid gap-4 py-5 px-3">
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
  const account = useAccount()
  const folder = useCoState(Folder, account.me.root?.currentFolder?.id)!
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
      folder.deleted = true
      account.me.root!.currentFolder = account.me.root!.folders![0]
      setOpen(false)
    },
    [folder],
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
            <Button variant="destructive" onClick={onRemove}>
              Delete
            </Button>
            <Button>Save</Button>
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
        .filter((r) => r && r.deleted !== true)
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
        <CardTitle>{children.description}</CardTitle>
        <CardDescription>
          <div className="flex flex-col">
            {children.merchant && <span>{children.merchant}</span>}
            <span>{formatCurrency(children)}</span>
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
              <Label htmlFor="name" className="text-right">
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
              <Label htmlFor="name" className="text-right">
                OpenAI Model
              </Label>
              <Input
                id="openaiModel"
                name="openaiModel"
                className="col-span-3"
                defaultValue={root.openaiModel}
              />
            </div>
          </div>
          <DrawerFooter>
            <Button>Save</Button>
          </DrawerFooter>
          <div className="h-5"></div>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
