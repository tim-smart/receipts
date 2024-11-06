import { useRxSuspenseSuccess, useRxValue } from "@effect-rx/rx-react"
import { accountRx, authStateRx } from "./Jazz/rx.ts"
import { PasskeyAuthBasicUI } from "jazz-react"

function App() {
  const state = useRxSuspenseSuccess(authStateRx).value
  const account = useRxValue(accountRx)
  console.log(account)

  return (
    <>
      <PasskeyAuthBasicUI state={state} />
    </>
  )
}

export default App
