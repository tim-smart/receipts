import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { Scaffold } from "@/components/ui/Scaffold"
import { useCoState } from "@/lib/Jazz"
import { Receipt } from "@/Domain/Receipt"
import { ChevronLeft } from "lucide-react"
import { ImageList } from "@/Domain/Image"
import { JazzImage } from "@/components/ui/JazzImage"
import { formatCurrency } from "@/Domain/Currency"
import { Button } from "@/components/ui/Button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { DateTime } from "effect"
import { ReceiptForm } from "@/Receipts/Form"
import { createContext, useContext, useState } from "react"
import { FolderContext } from "@/Folders/context"

export const Route = createFileRoute("/receipt/$id")({
  component: ReceiptScreen,
})

function ReceiptScreen() {
  const { id } = Route.useParams()
  const receipt = useCoState(Receipt, id as any)
  const router = useRouter()
  if (!receipt) return null
  return (
    <FolderContext.Provider value={receipt.folder!}>
      <ReceiptContext.Provider value={receipt}>
        <Scaffold
          heading={receipt.description}
          subHeading={receipt.merchant}
          leading={
            <Link to="/" className="flex ml-[-6px]">
              <ChevronLeft />
              Back
            </Link>
          }
        >
          <div className="flex flex-col gap-7">
            <div>
              {receipt.amount && (
                <Amount currency={receipt.currency}>{receipt.amount}</Amount>
              )}
              {receipt.date && (
                <h3 className="tracking-tight text-zinc-700 dark:text-zinc-300 font-extrabold text-center">
                  {DateTime.unsafeFromDate(receipt.date).pipe(
                    DateTime.format({ dateStyle: "short" }),
                  )}
                </h3>
              )}
            </div>
            {receipt.images && receipt.images.length > 0 && (
              <section>
                <Images>{receipt.images}</Images>
              </section>
            )}
          </div>

          <Mutations
            onDelete={() => {
              const index = receipt.folder!.items!.findIndex(
                (_) => _?.id === receipt.id,
              )
              receipt.folder!.items!.splice(index, 1)
              receipt.deleted = true
              router.navigate({ to: "/" })
            }}
          />
        </Scaffold>
      </ReceiptContext.Provider>
    </FolderContext.Provider>
  )
}

const ReceiptContext = createContext<Receipt>(null as any)
const useReceipt = () => useContext(ReceiptContext)

export function Amount({
  children,
  currency,
}: {
  children: string
  currency: string
}) {
  return (
    <h3 className="scroll-m-20 text-zinc-600 dark:text-zinc-400 text-3xl font-extrabold tracking-tight lg:text-5xl text-center">
      {formatCurrency({ amount: children, currency })}
    </h3>
  )
}

function Images({ children }: { children: ImageList }) {
  return (
    <div className="grid grid-cols-3 gap-2 justify-center">
      {children.filter(Boolean).map((image) => (
        <div key={image!.id}>
          <JazzImage src={image!} className="rounded-lg w-full" asLink />
        </div>
      ))}
    </div>
  )
}

function Mutations({ onDelete }: { onDelete: () => void }) {
  return (
    <div className="fixed bottom-0 left-0 w-full px-5 pb-safe flex flex-col items-center gap-2">
      <EditDrawer />
      <RemoveDrawer onDelete={onDelete} />
      <div className="h-3" />
    </div>
  )
}

function RemoveDrawer({ onDelete }: { onDelete: () => void }) {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button className="max-w-sm w-full" variant="destructive">
          Delete
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="w-full max-w-sm mx-auto">
          <DrawerHeader>
            <DrawerTitle>Are you sure?</DrawerTitle>
          </DrawerHeader>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button>Cancel</Button>
            </DrawerClose>
            <Button variant="destructive" onClick={onDelete}>
              Delete receipt
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function EditDrawer() {
  const receipt = useReceipt()
  const [open, setOpen] = useState(false)

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" className="max-w-sm w-full">
          Edit
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <ReceiptForm
          initialValue={receipt}
          onSubmit={() => {
            setOpen(false)
          }}
        />
      </DrawerContent>
    </Drawer>
  )
}
