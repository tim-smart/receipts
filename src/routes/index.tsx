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
import {
  createContext,
  FormEvent,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"
import { Receipt, ReceiptList } from "@/Domain/Receipt"
import { useAccount, useCoState } from "@/lib/Jazz"
import { ImageList } from "@/Domain/Image"
import { createImage } from "jazz-browser-media-images"
import { Folder } from "@/Domain/Folder"
import { ReceiptsAccountRoot } from "@/Domain/Account"
import { Combobox } from "@/components/ui/ComboBox"
import { Group } from "jazz-tools"
import { Plus } from "lucide-react"
import { Scaffold } from "@/components/ui/Scaffold"

export const Route = createFileRoute("/")({
  component: ReceiptsScreen,
})

function ReceiptsScreen() {
  return (
    <Scaffold heading="Receipts">
      <div className="w-full max-w-sm flex gap-2">
        <GroupSelect />
        <GroupDrawer />
      </div>

      <FolderProvider>
        <ReceiptGrid />
        <AddReceiptButton />
      </FolderProvider>
    </Scaffold>
  )
}

const FolderContext = createContext<Folder>(undefined as any)
export const useFolder = () => useContext(FolderContext)

function GroupSelect() {
  const account = useAccount()
  const root = useCoState(ReceiptsAccountRoot, account.me.root?.id)
  const folders = root?.folders
  const options = useMemo(
    () =>
      folders?.filter(Boolean).map((folder) => ({
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

function FolderProvider({ children }: { children: ReactNode }) {
  const account = useAccount()
  const folder = useCoState(Folder, account.me.root?.currentFolder?.id)
  if (!folder) return null
  return (
    <FolderContext.Provider value={folder!}>{children}</FolderContext.Provider>
  )
}

function AddReceiptButton() {
  return (
    <div className="fixed bottom-0 left-0 w-full px-5 pb-safe flex flex-col items-center">
      <ReceiptDrawer />
      <div className="h-5" />
    </div>
  )
}

function ReceiptDrawer() {
  const folder = useFolder()
  const [open, setOpen] = useState(false)

  const onSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.target as HTMLFormElement)
    const owner = folder._owner
    const images = await Promise.all(
      data.getAll("images").map((file) => createImage(file as File, { owner })),
    )
    folder.items!.push(
      Receipt.create(
        {
          description: data.get("description") as string,
          amount: data.get("amount") as string,
          currency: data.get("currency") as string,
          images: ImageList.create(images, { owner }),
          folder,
          deleted: false,
        },
        { owner },
      ),
    )
    setOpen(false)
  }, [])

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button className="w-full max-w-sm">Add receipt</Button>
      </DrawerTrigger>

      <DrawerContent>
        <form className="mx-auto w-full max-w-sm" onSubmit={onSubmit}>
          <DrawerHeader>
            <TypoH3>Add receipt</TypoH3>
          </DrawerHeader>
          <div className="grid gap-4 py-5 px-3">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Input
                id="description"
                name="description"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                Amount
              </Label>
              <div className="flex flex-row gap-1 col-span-3">
                <Input id="amount" name="amount" type="number" className="" />
                <CurrencySelect name="currency" initialValue="USD" />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="images" className="text-right">
                Images
              </Label>
              <Input
                id="images"
                name="images"
                type="file"
                accept="image/*"
                multiple
                className="col-span-3"
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
        <Button className="px-3" variant="outline">
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
          <DrawerFooter>
            <Button>Create</Button>
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
    <ul>
      {receipts!.filter(Boolean).map((receipt) => (
        <li key={receipt!.id}>
          <Link to={`/receipt/${receipt!.id}`}>{receipt!.id}</Link>
        </li>
      ))}
    </ul>
  )
}
