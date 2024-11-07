import { ReceiptsAccount } from "@/Domain/Account"
import { createJazzReactApp } from "jazz-react"

export const {
  Provider,
  useAccount,
  useCoState,
  useAcceptInvite,
  useAccountOrGuest,
} = createJazzReactApp({
  AccountSchema: ReceiptsAccount,
})
