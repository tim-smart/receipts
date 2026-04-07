import { Button } from "@/components/ui/button"
import { TypoH3 } from "@/components/ui/TypoH3"
import { DrawerFooter, DrawerHeader } from "@/components/ui/drawer"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { CurrencySelect } from "@/components/ui/CurrencySelect"
import { BigDecimal, DateTime, Option } from "effect"
import { Receipt, ReceiptId } from "@/Domain/Receipt"
import {
  SubmitEvent,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react"
import { Image } from "@/Domain/Image"
import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { currentGroupAtom } from "@/ReceiptGroups/atoms"
import * as Uuid from "uuid"
import { openaiApiKey } from "@/Domain/Setting"
import { settingAtom } from "@/Settings/atoms"
import { writeEventAtom } from "@/EventLog"
import { Model } from "effect/unstable/schema"
import { AsyncResult } from "effect/unstable/reactivity"
import { createImageAtom } from "@/Images/atoms"

const clicked = new WeakMap<any, boolean>()

export function ReceiptForm({
  initialValue,
  onSubmit,
  portalContainer,
}: {
  initialValue?: Receipt
  onSubmit: () => void
  portalContainer?: React.RefObject<HTMLElement | null> | undefined
}) {
  const group = useAtomValue(currentGroupAtom).pipe(
    AsyncResult.value,
    Option.getOrNull,
  )!
  const openaiKey = useAtomValue(settingAtom(openaiApiKey)).pipe(
    AsyncResult.value,
    Option.flatten,
  )
  const createImage = useAtomSet(createImageAtom, { mode: "promise" })
  const writeEvent = useAtomSet(writeEventAtom, { mode: "promise" })

  const onSubmit_ = useCallback(
    async (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault()
      const data = new FormData(event.target as HTMLFormElement)
      const images: Array<Image> = []
      const receiptId =
        initialValue?.id ?? ReceiptId.make(Uuid.v4({}, new Uint8Array(16)))
      const promises: Array<Promise<void>> = []
      for (const item of data.getAll("images")) {
        if (!(item instanceof File) || item.name === "") continue
        promises.push(
          (async () => {
            images.push(await createImage({ file: item, receiptId }))
          })(),
        )
      }
      await Promise.all(promises)

      if (initialValue) {
        await writeEvent({
          event: "ReceiptUpdate",
          payload: Receipt.update.make({
            ...initialValue,
            date: (data.get("date") as string)
              ? DateTime.makeUnsafe(data.get("date") as string)
              : initialValue.date,
            amount: BigDecimal.fromString(data.get("amount") as string).pipe(
              Option.getOrElse(() => initialValue.amount),
            ),
            merchant: data.get("merchant") as string,
            description: data.get("description") as string,
            currency: data.get("currency") as string,
            updatedAt: undefined,
          }),
        })
      } else {
        const amount = BigDecimal.fromString(data.get("amount") as string).pipe(
          Option.getOrElse(() => BigDecimal.fromNumberUnsafe(0)),
        )
        await writeEvent({
          event: "ReceiptCreate",
          payload: Receipt.insert.make({
            id: Model.Override(receiptId),
            groupId: group.id,
            date: (data.get("date") as string)
              ? DateTime.makeUnsafe(data.get("date") as string)
              : DateTime.nowUnsafe(),
            merchant: data.get("merchant") as string,
            description: data.get("description") as string,
            amount,
            currency: data.get("currency") as string,
            processed:
              images.length === 0 ||
              !BigDecimal.isZero(amount) ||
              Option.isNone(openaiKey),
          }),
        })
      }
      onSubmit()
    },
    [group],
  )

  const defaultDate = useMemo(
    () => (initialValue?.date ? initialValue.date : DateTime.nowUnsafe()),
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
              initialValue={initialValue?.currency ?? group!.defaultCurrency}
              portalContainer={portalContainer}
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
