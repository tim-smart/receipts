import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "./combobox"
import * as Currency from "@/Domain/Currency"

export function CurrencySelect({
  initialValue,
  name,
  onChange,
  portalContainer,
}: {
  readonly initialValue?: string
  readonly onChange?: (value: string) => void
  readonly name?: string
  readonly portalContainer?: React.RefObject<HTMLElement | null> | undefined
}) {
  return (
    <Combobox
      name={name}
      items={Currency.codes}
      defaultValue={initialValue}
      onValueChange={(value) => {
        console.log(value)
        if (!value) return
        onChange?.(value)
      }}
    >
      <ComboboxInput placeholder="Select a currency" className="w-full" />
      <ComboboxContent portalContainer={portalContainer}>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
