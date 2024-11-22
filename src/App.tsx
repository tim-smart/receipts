import { RouterProvider, createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"
import { useEffect, useState } from "react"
import { useRegisterSW } from "virtual:pwa-register/react"
import { Toaster } from "./components/ui/sonner.tsx"
import { useRxMount, useRxSet, useRxValue } from "@effect-rx/rx-react"
import { createAccountRx, identityRx, loginRx } from "./Auth.ts"
import { Option } from "effect"
import { Input } from "./components/ui/input.tsx"
import { Button } from "./components/ui/Button.tsx"
import { aiWorkerRx } from "./AiWorker/rx.ts"

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
  useRxMount(aiWorkerRx)

  return (
    <>
      <Auth />
      <SystemTheme />
      <Toaster />
    </>
  )
}

function Auth() {
  const state = useRxValue(identityRx)

  return Option.match(state, {
    onNone: () => <Login />,
    onSome: () => <RouterProvider router={router} />,
  })
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

export const Login = () => {
  const [username, setUsername] = useState("")
  const login = useRxSet(loginRx)
  const create = useRxSet(createAccountRx)

  return (
    <div className="h-screen w-full flex justify-center items-center">
      <div className="max-w-sm flex flex-col gap-4">
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            create(username)
          }}
        >
          <Input
            placeholder="Display name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="webauthn"
          />
          <Button type="submit">Sign up</Button>
        </form>

        <Button onClick={() => login()}>Log in with existing account</Button>
      </div>
    </div>
  )
}

export default App
