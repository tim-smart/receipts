import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { ChevronLeft, Pencil } from "lucide-react"
import { formatCurrency } from "@/Domain/Currency"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { DateTime, Option } from "effect"
import { Dock, DockButton } from "@/components/ui/Dock"
import { Monogram } from "@/components/ui/Monogram"
import {
  TillTape,
  TillTapeAmount,
  TillTapeHead,
  TillTapeLine,
  TillTapeLines,
} from "@/components/ui/TillTape"
import { ProcessingPill } from "@/Receipts/List"
import { receiptGroupsAtom } from "@/ReceiptGroups/atoms"
import { uuidString } from "@/lib/utils"
import { ReceiptForm } from "@/Receipts/Form"
import { useRef, useState } from "react"
import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { receiptAtom } from "@/Receipts/atoms"
import { ImageWithObjectUrl } from "@/Domain/Image"
import { writeEventsAtom } from "@/EventLog"
import { AsyncResult } from "effect/reactivity"
import { Receipt } from "@/Domain/Receipt"
import { ReceiptRow } from "@/Receipts/Events"
import { ImageRow } from "@/Images/Events"

export const Route = createFileRoute("/receipt/$id")({
  component: ReceiptScreen,
})

function ReceiptScreen() {
  const { id } = Route.useParams()
  const result = useAtomValue(receiptAtom(id)).pipe(
    AsyncResult.value,
    Option.getOrNull,
  )
  const writeEvents = useAtomSet(writeEventsAtom)
  const router = useRouter()

  if (!result) return null
  const { receipt, images } = result

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link
        to="/"
        className="mt-5 -ml-1.5 inline-flex items-center gap-0.5 rounded-md pr-1.5 text-[15px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ChevronLeft className="size-5" />
        Receipts
      </Link>

      <header className="mt-7 flex items-center gap-3.5">
        <Monogram
          name={receipt.monogramName}
          className="size-12 rounded-xl text-lg"
        />
        <div className="min-w-0">
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight break-words sm:text-3xl">
            {receipt.title}
          </h1>
          {receipt.merchant && receipt.description && (
            <p className="mt-0.5 text-[15px] text-muted-foreground">
              {receipt.merchant}
            </p>
          )}
        </div>
      </header>

      <Summary receipt={receipt} />

      {images.length > 0 && (
        <section aria-label="Photos" className="mt-8">
          <Images>{images}</Images>
        </section>
      )}

      <div className="h-44" />
      <Mutations
        receipt={receipt}
        onDelete={() => {
          writeEvents([
            ReceiptRow.remove(receipt.id),
            ...images.map((image) => ImageRow.remove(image.id)),
          ])
          router.navigate({ to: "/" })
        }}
      />
    </div>
  )
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})
const addedFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
})

function Summary({ receipt }: { receipt: Receipt }) {
  const groupId = uuidString(receipt.groupId)
  const group = useAtomValue(
    receiptGroupsAtom,
    AsyncResult.getOrElse(() => []),
  ).find((group) => group.idString === groupId)

  return (
    <TillTape className="mt-6">
      <TillTapeHead>
        <span>{DateTime.formatIntl(receipt.date, dateFormat)}</span>
        <span>{receipt.currency}</span>
      </TillTapeHead>
      {receipt.hasAmount && (
        <TillTapeAmount className="mt-2">
          {formatCurrency(receipt)}
        </TillTapeAmount>
      )}
      {receipt.processing && (
        <div className="mt-3">
          <ProcessingPill />
        </div>
      )}
      <TillTapeLines>
        {group && <TillTapeLine label="Folder" value={group.name} />}
        <TillTapeLine
          label="Added"
          value={DateTime.formatIntl(receipt.createdAt, addedFormat)}
        />
      </TillTapeLines>
    </TillTape>
  )
}

function Images({ children }: { children: ReadonlyArray<ImageWithObjectUrl> }) {
  return (
    <div
      className={
        children.length > 1 ? "grid gap-4 sm:grid-cols-2" : "grid gap-4"
      }
    >
      {children.map((image, index) => (
        <a
          key={image.idString}
          href={image.objectUrl}
          target="_blank"
          aria-label={`Open photo ${index + 1} of ${children.length}`}
          className="block overflow-hidden rounded-2xl border bg-tape outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <img
            src={image.objectUrl}
            alt=""
            className="max-h-[70svh] w-full object-contain [dynamic-range-limit:standard]"
          />
        </a>
      ))}
    </div>
  )
}

function Mutations({
  receipt,
  onDelete,
}: {
  receipt: Receipt
  onDelete: () => void
}) {
  return (
    <Dock>
      <EditDrawer receipt={receipt} />
      <RemoveDrawer onDelete={onDelete} />
    </Dock>
  )
}

function RemoveDrawer({ onDelete }: { onDelete: () => void }) {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-sm font-medium text-destructive outline-none hover:underline hover:underline-offset-4 focus-visible:ring-3 focus-visible:ring-destructive/30"
        >
          Delete receipt
        </button>
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

function EditDrawer({ receipt }: { receipt: Receipt }) {
  const container = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <DockButton>
          <Pencil className="size-4" />
          Edit receipt
        </DockButton>
      </DrawerTrigger>
      <DrawerContent ref={container}>
        <ReceiptForm
          initialValue={receipt}
          onSubmit={() => {
            setOpen(false)
          }}
          portalContainer={container}
        />
      </DrawerContent>
    </Drawer>
  )
}
