import {
  BigDecimal,
  Context,
  DateTime,
  Effect,
  FiberMap,
  Layer,
  Mailbox,
} from "effect"
import { ReceiptsAccount } from "./Domain/Account"
import { subscribeToCoValue } from "jazz-tools/src/internal.js"
import { AiJob, AiJobList } from "./Domain/AiJob"
import { AiHelpers } from "./Ai"

export class JazzAccount extends Context.Tag("JazzAccount")<
  JazzAccount,
  ReceiptsAccount
>() {}

export const AiWorkerLive = Effect.gen(function* () {
  const ai = yield* AiHelpers
  const account = yield* JazzAccount
  const mailbox = yield* Mailbox.make<AiJob>()
  const fibers = yield* FiberMap.make<AiJob>()

  yield* Effect.log("starting worker")

  let jobs = account.root!.aiJobs

  const handleList = (list: AiJobList) => {
    jobs = list
    const toRemove: Array<AiJob> = []
    for (const job of list) {
      if (!job) continue
      if (job.processed) {
        toRemove.push(job)
      } else if (!FiberMap.unsafeHas(fibers, job)) {
        mailbox.unsafeOffer(job)
      }
    }
    for (const job of toRemove) {
      list.splice(list.indexOf(job), 1)
    }
  }

  yield* Effect.acquireRelease(
    Effect.sync(() =>
      subscribeToCoValue(
        AiJobList,
        account.root!.aiJobs!.id,
        account,
        [],
        handleList,
      ),
    ),
    (cancel) => Effect.sync(cancel),
  )

  const removeJob = (job: AiJob) =>
    Effect.sync(() => {
      job.processed = true
      const index = jobs?.indexOf(job)
      if (index !== undefined && index >= 0) {
        jobs!.splice(index, 1)
      }
    })

  const processJob = (job: AiJob) =>
    Effect.gen(function* () {
      yield* Effect.log("processing")

      const loadedJob = yield* Effect.promise(() =>
        job.ensureLoaded({ receipt: { images: [] } }),
      )
      let imageStream = yield* Effect.fromNullable(
        loadedJob?.receipt.images[0]?.highestResAvailable()?.stream,
      )
      imageStream = yield* Effect.fromNullable(
        yield* Effect.promise(() => imageStream!.ensureLoaded([])),
      )
      const blob = yield* Effect.fromNullable(imageStream.toBlob())
      const metadata = yield* ai.extractReceipt(blob)

      job.receipt!.amount = BigDecimal.format(metadata.amount)
      job.receipt!.merchant = metadata.merchant
      job.receipt!.description = metadata.description
      if (metadata.date) {
        job.receipt!.date = DateTime.toDate(metadata.date)
      }
    }).pipe(
      Effect.tap(Effect.log("processed")),
      Effect.ensuring(removeJob(job)),
      Effect.catchAllCause(Effect.log),
      Effect.annotateLogs("job", job.id),
    )

  yield* mailbox.take.pipe(
    Effect.flatMap((job) =>
      FiberMap.run(fibers, job, processJob(job), {
        onlyIfMissing: true,
      }),
    ),
    Effect.forever,
    Effect.forkScoped,
  )
}).pipe(Layer.scopedDiscard, Layer.provide(AiHelpers.Default))
