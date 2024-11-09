import { usePasskeyAuth } from "./Jazz/PasskeyAuth.tsx"
import { Provider, useAcceptInvite, useAccount } from "./lib/Jazz.ts"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"
import { AiWorkerMount } from "./Receipts/AiWorkerMount.tsx"
import { PasskeyAuthUI } from "./Jazz/PasskeyUI.tsx"
import { useEffect } from "react"
import { useRegisterSW } from "virtual:pwa-register/react"
import { Folder } from "./Domain/Folder.ts"
import { loadCoValue } from "jazz-tools"
import { Toaster } from "./components/ui/sonner.tsx"

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
        <FolderInvites />
      </Provider>

      <PasskeyAuthUI state={state} />
      <SystemTheme />
      <Toaster />
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

function FolderInvites() {
  const account = useAccount().me

  useAcceptInvite({
    invitedObjectSchema: Folder,
    onAccept: async (folderId) => {
      const folder = await loadCoValue(Folder, folderId, account, [])
      if (!folder) return
      const acc = await account.ensureLoaded({
        root: { folders: [], currentFolder: [] },
      })
      if (acc!.root.folders.find((_) => _?.id === folderId)) return
      acc!.root.folders.push(folder)
      acc!.root.currentFolder = folder
    },
  })

  return null
}

export default App
