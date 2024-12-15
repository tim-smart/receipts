import { Rx } from "@effect-rx/rx-react"
import {
  EventJournal,
  EventLog,
  EventLogEncryption,
  EventLogRemote,
} from "@effect/experimental"
import { Identity } from "@effect/experimental/EventLog"
import { Context, Effect, Layer } from "effect"
import { ReceiptAppEvents } from "./Events"
import { ReceiptGroupsLive, ReceiptGroupsReactivityLive } from "./ReceiptGroups"
import {
  ReceiptsCompactionLive,
  ReceiptsLive,
  ReceiptsReactivityLive,
} from "./Receipts"
import {
  SettingsCompactionLive,
  SettingsLive,
  SettingsReactivityLive,
} from "./Settings"
import { ImagesLive } from "./Images"
import { identityRx } from "./Auth"
import { Socket } from "@effect/platform"
import { localStorageRx } from "./lib/utils"

const EventLogLayer = EventLog.layer(ReceiptAppEvents).pipe(
  Layer.provide([ReceiptGroupsLive, ReceiptsLive, SettingsLive, ImagesLive]),
  Layer.provide(EventJournal.layerIndexedDb()),
)

const CompactionLive = Layer.mergeAll(
  ReceiptGroupsReactivityLive,
  ReceiptsCompactionLive,
  ReceiptsReactivityLive,
  SettingsCompactionLive,
  SettingsReactivityLive,
).pipe(Layer.provide(EventLogLayer))

export const EventLogLive = Layer.mergeAll(EventLogLayer, CompactionLive).pipe(
  Layer.provide([
    EventLogEncryption.layerSubtle,
    Socket.layerWebSocketConstructorGlobal,
  ]),
)

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

export const remoteAddressRx = localStorageRx("receipts_remote_address")

export const remoteRx = Rx.runtime((get) =>
  Effect.gen(function* () {
    const identity = yield* get.some(identityRx)
    const remoteAddress = yield* get.some(remoteAddressRx)
    const url = new URL(remoteAddress)
    url.searchParams.set("publicKey", identity.publicKey)
    return EventLogRemote.layerWebSocketBrowser(url.toString(), {
      disablePing: true,
    }).pipe(Layer.provide(get(eventLogRx.layer)))
  }).pipe(Layer.unwrapEffect),
)
