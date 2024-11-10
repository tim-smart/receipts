import {
  BigDecimal,
  Context,
  DateTime,
  Effect,
  FiberMap,
  Layer,
  Mailbox,
  Schedule,
  Stream,
} from "effect"
import { ReceiptsAccount } from "./Domain/Account"
import { subscribeToCoValue } from "jazz-tools/src/internal.js"
import { AiJob, AiJobList } from "./Domain/AiJob"
import { AiHelpers } from "./Ai"
import { coStream } from "./lib/Jazz"

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
      job.receipt!.processed = true
      const index = jobs?.indexOf(job)
      if (index !== undefined && index >= 0) {
        jobs!.splice(index, 1)
      }
    })

  const processJob = (job: AiJob) =>
    Effect.gen(function* () {
      yield* Effect.log("processing")

      const resolution = yield* coStream(job.receipt!.images![0]!).pipe(
        Stream.map((image) => image.highestResAvailable()),
        Stream.debounce(1000),
        Stream.runHead,
        Effect.flatten,
        Effect.flatMap(Effect.fromNullable),
        Effect.withSpan("highestResAvailable"),
      )

      const blob = yield* Effect.fromNullable(resolution.stream.toBlob()).pipe(
        Effect.withSpan("toBlob"),
      )
      const metadata = yield* ai.extractReceipt(blob)

      job.receipt!.amount = BigDecimal.format(metadata.amount)
      if (metadata.currency) {
        job.receipt!.currency = metadata.currency.toUpperCase()
      }
      if (job.receipt!.merchant.trim() === "") {
        job.receipt!.merchant = metadata.merchant
      }
      if (job.receipt!.description.trim() === "") {
        job.receipt!.description = metadata.description
      }
      if (metadata.date) {
        job.receipt!.date = DateTime.toDate(metadata.date)
      }
    }).pipe(
      Effect.retry({ times: 2, schedule: Schedule.spaced(1000) }),
      Effect.tap(Effect.log("processed")),
      Effect.catchAllCause(Effect.log),
      Effect.tap(removeJob(job)),
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
