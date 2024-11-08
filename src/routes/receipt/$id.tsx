import { createFileRoute, Link } from "@tanstack/react-router"
import { Scaffold } from "@/components/ui/Scaffold"
import { useCoState } from "@/lib/Jazz"
import { Receipt } from "@/Domain/Receipt"
import { ChevronLeft } from "lucide-react"
import { ImageList } from "@/Domain/Image"
import { JazzImage } from "@/components/ui/JazzImage"
import { formatCurrency } from "@/Domain/Currency"
import { Button } from "@/components/ui/Button"

export const Route = createFileRoute("/receipt/$id")({
  component: ReceiptScreen,
})

function ReceiptScreen() {
  const { id } = Route.useParams()
  const receipt = useCoState(Receipt, id as any)
  if (!receipt) return null
  return (
    <Scaffold
      heading={receipt.description}
      subHeading={receipt.merchant}
      leading={
        <Link to="/" className="flex">
          <ChevronLeft />
          Back
        </Link>
      }
    >
      <div className="flex flex-col gap-7">
        {receipt.amount && (
          <Amount currency={receipt.currency}>{receipt.amount}</Amount>
        )}
        {receipt.images && receipt.images.length > 0 && (
          <section>
            <Images>{receipt.images}</Images>
          </section>
        )}
      </div>

      <Mutations />
    </Scaffold>
  )
}

export function Amount({
  children,
  currency,
}: {
  children: string
  currency: string
}) {
  return (
    <h3 className="scroll-m-20 text-zinc-400 text-3xl font-extrabold tracking-tight lg:text-5xl text-center">
      {formatCurrency({ amount: children, currency })}
    </h3>
  )
}

function Images({ children }: { children: ImageList }) {
  return (
    <div className="flex flex-row gap-2 justify-center">
      {children.filter(Boolean).map((image) => (
        <div key={image!.id} className="flex-1 h-32">
          <JazzImage src={image!} className="rounded h-full" asLink />
        </div>
      ))}
    </div>
  )
}

function Mutations() {
  return (
    <div className="fixed bottom-0 left-0 w-full px-5 pb-safe flex flex-col items-center gap-2">
      <Button className="max-w-sm w-full">Edit</Button>
      <Button className="max-w-sm w-full" variant="destructive">
        Delete
      </Button>
      <div className="h-3" />
    </div>
  )
}
