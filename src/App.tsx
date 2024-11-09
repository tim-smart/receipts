import { usePasskeyAuth } from "./Jazz/PasskeyAuth.tsx"
import { Provider } from "./lib/Jazz.ts"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"
import { AiWorkerMount } from "./Receipts/AiWorkerMount.tsx"
import { PasskeyAuthUI } from "./Jazz/PasskeyUI.tsx"
import { useEffect } from "react"
import { useRegisterSW } from "virtual:pwa-register/react"

const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

function App() {
  useRegisterSW({
    immediate: true,
  })

  const [auth, state] = usePasskeyAuth({ appName: "Receipts" })

  return (
    <>
      <Provider
        auth={auth}
        peer="wss://cloud.jazz.tools/?key=hello@timsmart.co"
      >
        <RouterProvider router={router} />
        <AiWorkerMount />
      </Provider>
      <PasskeyAuthUI state={state} />
      <SystemTheme />
    </>
  )
}

function isDarkMode() {
  return (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  )
}

function SystemTheme() {
  useEffect(() => {
    const listener = () => {
      if (isDarkMode()) {
        document.documentElement.classList.add("dark")
        document
          .querySelector('meta[name="theme-color"]')
          ?.setAttribute("content", "#0a0a0a")
      } else {
        document.documentElement.classList.remove("dark")
        document
          .querySelector('meta[name="theme-color"]')
          ?.setAttribute("content", "#ffffff")
      }
    }
    const matcher = window.matchMedia("(prefers-color-scheme: dark)")
    matcher.addEventListener("change", listener)
    listener()
    return () => matcher.removeEventListener("change", listener)
  }, [])
  return null
}

export default App
