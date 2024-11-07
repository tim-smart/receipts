import { createJazzReactApp, PasskeyAuthBasicUI } from "jazz-react"
import { ReceiptsAccount } from "./Domain/Account.ts"
import { usePasskeyAuth } from "./Jazz/PasskeyAuth.tsx"

export const {
  Provider,
  useAccount,
  useCoState,
  useAcceptInvite,
  useAccountOrGuest,
} = createJazzReactApp({
  AccountSchema: ReceiptsAccount,
})

function App() {
  const [auth, state] = usePasskeyAuth({ appName: "Receipts" })

  return (
    <>
      <Provider
        auth={auth}
        peer="wss://cloud.jazz.tools/?key=hello@timsmart.co"
      >
        <Welcome />
      </Provider>
      {state.state !== "signedIn" && <PasskeyAuthBasicUI state={state} />}
    </>
  )
}

function Welcome() {
  const account = useAccount()

  return (
    <>
      <h1>Welcome {account.me.root?.id}</h1>
      <button onClick={account.logOut}>Log Out</button>
    </>
  )
}

export default App
