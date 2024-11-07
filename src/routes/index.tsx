import { createFileRoute } from "@tanstack/react-router"
import { Button } from "@/components/ui/Button"
import { TypoH1 } from "@/components/ui/TypoH1"
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

export const Route = createFileRoute("/")({
  component: ReceiptsScreen,
})

function ReceiptsScreen() {
  return (
    <div className="flex flex-col">
      <header className="pt-32">
        <TypoH1>Receipts</TypoH1>
      </header>

      <div className="h-5" />

      <nav>
        <ReceiptDrawer />
      </nav>
    </div>
  )
}

function ReceiptDrawer() {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button>Add receipt</Button>
      </DrawerTrigger>

      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <TypoH3>Add receipt</TypoH3>
          </DrawerHeader>
          <form className="grid gap-4 py-5">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Input id="description" className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                Amount
              </Label>
              <Input id="amount" type="number" className="col-span-3" />
            </div>
          </form>
          <DrawerFooter>
            <Button>Create</Button>
          </DrawerFooter>
          <div className="h-5"></div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
