import { PasskeyAuthBasicUI } from "jazz-react"
import { usePasskeyAuth } from "./Jazz/PasskeyAuth.tsx"
import { Provider } from "./lib/Jazz.ts"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"

const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

function App() {
  const [auth, state] = usePasskeyAuth({ appName: "Receipts" })

  return (
    <>
      <Provider
        auth={auth}
        peer="wss://cloud.jazz.tools/?key=hello@timsmart.co"
      >
        <RouterProvider router={router} />
      </Provider>
      {state.state !== "signedIn" && <PasskeyAuthBasicUI state={state} />}
    </>
  )
}

export default App
