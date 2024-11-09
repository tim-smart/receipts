import { Button } from "@/components/ui/Button"
import { TypoH3 } from "@/components/ui/TypoH3"
import { DrawerFooter, DrawerHeader } from "@/components/ui/drawer"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { CurrencySelect } from "@/components/ui/CurrencySelect"
import { DateTime } from "effect"
import { Receipt } from "@/Domain/Receipt"
import { useFolder } from "@/Folders/context"
import { FormEvent, useCallback, useLayoutEffect, useRef } from "react"
import { createImage } from "jazz-browser-media-images"
import { ImageList } from "@/Domain/Image"
import { useAccount } from "@/lib/Jazz"
import { AiJob, AiJobList } from "@/Domain/AiJob"
import { globalValue } from "effect/GlobalValue"

const clicked = globalValue(
  "ReceiptForm/clicked",
  () => new WeakMap<any, boolean>(),
)

export function ReceiptForm({
  initialValue,
  onSubmit,
}: {
  initialValue?: Receipt
  onSubmit: () => void
}) {
  const account = useAccount().me
  const folder = useFolder()

  const onSubmit_ = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.target as HTMLFormElement)
    const owner = folder._owner
    const images = await Promise.all(
      data
        .getAll("images")
        .filter((file) => file instanceof File && file.name !== "")
        .map((file) => createImage(file as File, { owner })),
    )
    if (initialValue) {
      initialValue.date = (data.get("date") as string)
        ? new Date(data.get("date") as string)
        : initialValue.date
      initialValue.merchant = data.get("merchant") as string
      initialValue.description = data.get("description") as string
      initialValue.amount = data.get("amount") as string
      initialValue.currency = data.get("currency") as string
      if (images.length > 0) {
        initialValue.images!.push(...images)
      }
    } else {
      const receipt = Receipt.create(
        {
          date: (data.get("date") as string)
            ? new Date(data.get("date") as string)
            : undefined,
          merchant: data.get("merchant") as string,
          description: data.get("description") as string,
          amount: data.get("amount") as string,
          currency: data.get("currency") as string,
          images: ImageList.create(images, { owner }),
          folder,
          deleted: false,
        },
        { owner },
      )
      folder.items!.push(receipt)
      if (receipt.images!.length > 0 && receipt.amount.trim() === "") {
        account.root!.aiJobs ??= AiJobList.create([], { owner: account })
        account.root!.aiJobs.push(
          AiJob.create(
            {
              receipt,
              processed: false,
            },
            { owner: account },
          ),
        )
      }
    }
    onSubmit()
  }, [])

  const defaultDate = initialValue?.date
    ? DateTime.unsafeFromDate(initialValue.date)
    : DateTime.unsafeNow()

  const fileRef = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => {
    if (!clicked.get(fileRef.current)) {
      clicked.set(fileRef.current, true)
      fileRef.current?.click()
    }
  }, [fileRef])

  return (
    <form className="mx-auto w-full max-w-sm" onSubmit={onSubmit_}>
      <DrawerHeader>
        <TypoH3>Add receipt</TypoH3>
      </DrawerHeader>
      <div className="grid gap-4 py-5 px-3">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="date" className="text-right">
            Date
          </Label>
          <Input
            id="date"
            name="date"
            className="col-span-3"
            type="date"
            defaultValue={DateTime.formatIsoDate(defaultDate)}
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="merchant" className="text-right">
            Merchant
          </Label>
          <Input
            id="merchant"
            name="merchant"
            className="col-span-3"
            defaultValue={initialValue?.merchant}
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="description" className="text-right">
            Description
          </Label>
          <Input
            id="description"
            name="description"
            className="col-span-3"
            defaultValue={initialValue?.description}
          />
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="amount" className="text-right">
            Amount
          </Label>
          <div className="flex flex-row gap-1 col-span-3">
            <Input
              id="amount"
              name="amount"
              type="number"
              step={0.01}
              className=""
              defaultValue={initialValue?.amount}
            />
            <CurrencySelect
              name="currency"
              initialValue={
                initialValue?.currency ?? folder.defaultCurrency ?? "USD"
              }
            />
          </div>
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="images" className="text-right">
            Images
          </Label>
          <Input
            ref={fileRef}
            id="images"
            name="images"
            type="file"
            accept="image/*;capture=camera"
            multiple
            className="col-span-3"
          />
        </div>
      </div>
      <DrawerFooter>
        <Button>{initialValue ? "Update" : "Create"}</Button>
      </DrawerFooter>
      <div className="h-5"></div>
    </form>
  )
}
