import { Folder } from "@/Domain/Folder"
import { useAccount } from "@/lib/Jazz"
import { createContext, ReactNode, useContext } from "react"

export const FolderContext = createContext<Folder>(undefined as any)

export const useFolder = () => useContext(FolderContext)

export function FolderProvider({ children }: { children: ReactNode }) {
  const account = useAccount().me
  const folder = account.root?.currentFolder
  if (!folder) return null
  return (
    <FolderContext.Provider value={folder!}>{children}</FolderContext.Provider>
  )
}
