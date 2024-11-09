import { AiWorkerConfig, aiWorkerRx } from "@/AiWorker/rx"
import { useAccount } from "@/lib/Jazz"
import { Rx, useRxMount } from "@effect-rx/rx-react"
import { Redacted } from "effect"

const rxVoid = Rx.make(void 0)

export function AiWorkerMount() {
  const account = useAccount().me

  useRxMount(
    account.root &&
      account.root.aiJobs &&
      account.root.openaiApiKey &&
      account.root.openaiModel
      ? aiWorkerRx(
          new AiWorkerConfig({
            openaiApiKey: Redacted.make(account.root.openaiApiKey),
            openaiModel: account.root.openaiModel,
            account,
          }),
        )
      : rxVoid,
  )

  return null
}
