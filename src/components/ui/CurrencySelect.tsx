import { useState } from "react"
import { Combobox } from "./ComboBox"
import * as Currency from "@/Domain/Currency"

export function CurrencySelect({
  initialValue,
  name,
  onChange,
}: {
  readonly initialValue?: string
  readonly onChange?: (value: string) => void
  readonly name?: string
}) {
  const [value, setValue] = useState(initialValue ?? "")
  const handleChange = (value: string) => {
    setValue(value)
    onChange?.(value)
  }
  return (
    <Combobox
      name={name}
      options={Currency.options}
      value={value}
      onChange={handleChange}
      placeholder="Select currency"
      className="px-2"
    />
  )
}
