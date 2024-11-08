import { createFileRoute } from "@tanstack/react-router"
import { Scaffold } from "@/components/ui/Scaffold"
import { useCoState } from "@/lib/Jazz"
import { Receipt } from "@/Domain/Receipt"

export const Route = createFileRoute("/receipt/$id")({
  component: ReceiptScreen,
})

function ReceiptScreen() {
  const { id } = Route.useParams()
  const receipt = useCoState(Receipt, id as any)
  if (!receipt) return null
  return (
    <Scaffold heading={receipt.description}>
      Receipt: {receipt.description}
    </Scaffold>
  )
}
