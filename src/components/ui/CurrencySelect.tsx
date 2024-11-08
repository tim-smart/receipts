import { useState } from "react"
import { Combobox } from "./ComboBox"
import * as Currency from "@/Domain/Currency"

export function CurrencySelect({
  initialValue,
  name,
}: {
  readonly initialValue: string
  readonly name?: string
}) {
  const [value, setValue] = useState(initialValue)
  return (
    <Combobox
      name={name}
      options={Currency.options}
      value={value}
      onChange={setValue}
      placeholder=""
      className="px-2"
    />
  )
}
