import { Rx } from "@effect-rx/rx-react"
import { EventJournal, EventLog, EventLogRemote } from "@effect/experimental"
import { Identity } from "@effect/experimental/EventLog"
import { Context, Effect, Layer } from "effect"
import { ReceiptAppEvents } from "./Events"
import { ReceiptGroupsLive } from "./ReceiptGroups"
import { ReceiptsLive } from "./Receipts"
import { SettingsLive } from "./Settings"
import { ImagesLive } from "./Images"
import { identityRx } from "./Auth"

const EventLogLayer = EventLog.layer(ReceiptAppEvents).pipe(
  Layer.provide(ReceiptGroupsLive),
  Layer.provide(ReceiptsLive),
  Layer.provide(SettingsLive),
  Layer.provide(ImagesLive),
  Layer.provide(EventJournal.layerIndexedDb()),
)

const EventRemoteLive = EventLogRemote.layerWebSocketBrowser(
  "wss://eventlog.office.timsmart.co",
).pipe(Layer.provide(EventLogLayer))

export const EventLogLive = Layer.merge(EventLogLayer, EventRemoteLive)

const makeClient = EventLog.makeClient(ReceiptAppEvents)

export class EventLogClient extends Context.Tag("EventLog/EventLogClient")<
  EventLogClient,
  Effect.Effect.Success<typeof makeClient>
>() {
  static Default = Layer.effect(EventLogClient, makeClient)
}

// rx

export const eventLogRx = Rx.runtime((get) =>
  Effect.gen(function* () {
    const identity = yield* get.some(identityRx)
    return EventLogLive.pipe(
      Layer.provideMerge(Layer.succeed(Identity, identity)),
    )
  }).pipe(Layer.unwrapEffect),
)

export const clientRx = eventLogRx.rx(makeClient)
export type EventClient = Rx.Rx.InferSuccess<typeof clientRx>
