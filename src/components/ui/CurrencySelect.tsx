import { useState } from "react"
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
  const [value, setValue] = useState(initialValue)
  return (
    <Combobox
      name={name}
      items={Currency.codes}
      value={value}
      onValueChange={(value) => {
        if (!value) return
        setValue(value)
        onChange?.(value)
      }}
    >
      <ComboboxInput placeholder="Currency" className="w-32" />
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
