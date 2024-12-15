import { Button } from "@/components/ui/Button"
import { TypoH3 } from "@/components/ui/TypoH3"
import { DrawerFooter, DrawerHeader } from "@/components/ui/drawer"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { CurrencySelect } from "@/components/ui/CurrencySelect"
import { BigDecimal, DateTime, Option } from "effect"
import { Receipt, ReceiptId } from "@/Domain/Receipt"
import { FormEvent, useCallback, useLayoutEffect, useMemo, useRef } from "react"
import { globalValue } from "effect/GlobalValue"
import { Image } from "@/Domain/Image"
import {
  useRxSetPromise,
  useRxSuspenseSuccess,
  useRxValue,
} from "@effect-rx/rx-react"
import { createReceiptRx, updateReceiptRx } from "./rx"
import { currentGroupRx } from "@/ReceiptGroups/rx"
import * as Uuid from "uuid"
import { createImageRx } from "@/Images/rx"
import { Model } from "@effect/sql"
import { openaiApiKey } from "@/Domain/Setting"
import { settingRx } from "@/Settings/rx"

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
  const group = useRxSuspenseSuccess(currentGroupRx).value
  const openaiKey = useRxValue(settingRx(openaiApiKey))
  const createReceipt = useRxSetPromise(createReceiptRx)
  const updateReceipt = useRxSetPromise(updateReceiptRx)
  const createImage = useRxSetPromise(createImageRx)

  const onSubmit_ = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const data = new FormData(event.target as HTMLFormElement)
      const images: Array<typeof Image.insert.Type> = []
      const receiptId =
        initialValue?.id ?? ReceiptId.make(Uuid.v4({}, new Uint8Array(16)))
      const promises: Array<Promise<void>> = []
      for (const item of data.getAll("images")) {
        if (!(item instanceof File) || item.name === "") continue
        promises.push(
          (async () => {
            const buffer = await item.arrayBuffer()
            const image = Image.insert.make({
              receiptId,
              data: new Uint8Array(buffer),
              contentType: item.type,
            })
            images.push(image)
            await createImage(image)
          })(),
        )
      }
      await Promise.all(promises)

      if (initialValue) {
        await updateReceipt(
          Receipt.update.make({
            ...initialValue,
            date: (data.get("date") as string)
              ? DateTime.unsafeMake(data.get("date") as string)
              : initialValue.date,
            amount: BigDecimal.fromString(data.get("amount") as string).pipe(
              Option.getOrElse(() => initialValue.amount),
            ),
            merchant: data.get("merchant") as string,
            description: data.get("description") as string,
            currency: data.get("currency") as string,
            updatedAt: undefined,
          }),
        )
      } else {
        const amount = BigDecimal.fromString(data.get("amount") as string).pipe(
          Option.getOrElse(() => BigDecimal.unsafeFromNumber(0)),
        )
        await createReceipt(
          Receipt.insert.make({
            id: Model.Override(receiptId),
            groupId: group.id,
            date: (data.get("date") as string)
              ? DateTime.unsafeMake(data.get("date") as string)
              : DateTime.unsafeNow(),
            merchant: data.get("merchant") as string,
            description: data.get("description") as string,
            amount,
            currency: data.get("currency") as string,
            processed:
              images.length === 0 ||
              !BigDecimal.isZero(amount) ||
              Option.isNone(openaiKey),
          }),
        )
      }
      onSubmit()
    },
    [group],
  )

  const defaultDate = useMemo(
    () => (initialValue?.date ? initialValue.date : DateTime.unsafeNow()),
    [initialValue],
  )

  const fileRef = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => {
    if (!initialValue && !clicked.get(fileRef.current)) {
      clicked.set(fileRef.current, true)
      fileRef.current?.click()
    }
    fileRef.current?.removeAttribute("capture")
  }, [fileRef])

  return (
    <form className="mx-auto w-full max-w-sm" onSubmit={onSubmit_}>
      <DrawerHeader>
        <TypoH3>{initialValue ? "Edit" : "Add"} receipt</TypoH3>
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
              defaultValue={
                initialValue?.amount
                  ? BigDecimal.format(initialValue.amount)
                  : ""
              }
            />
            <CurrencySelect
              name="currency"
              initialValue={initialValue?.currency ?? group.defaultCurrency}
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
            accept="image/*"
            capture="environment"
            multiple
            className="col-span-3"
          />
        </div>
      </div>
      <DrawerFooter>
        <Button>{initialValue ? "Save" : "Create"}</Button>
      </DrawerFooter>
      <div className="h-5"></div>
    </form>
  )
}
