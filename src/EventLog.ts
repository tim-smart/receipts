import { Atom } from "@effect-atom/atom-react"
import { EventJournal, EventLog, EventLogRemote } from "@effect/experimental"
import { Identity } from "@effect/experimental/EventLog"
import { Context, Effect, Layer, Option, Schema } from "effect"
import { ReceiptAppEvents } from "./Events"
import { ReceiptGroupsLayer } from "./ReceiptGroups"
import { ReceiptsLayer } from "./Receipts"
import { SettingsLayer } from "./Settings"
import { ImagesLive } from "./Images"
import { identityAtom } from "./Auth"
import { kvsRuntime } from "./lib/utils"

const EventLogLayer = EventLog.layer(ReceiptAppEvents).pipe(
  Layer.provide([ReceiptGroupsLayer, ReceiptsLayer, SettingsLayer, ImagesLive]),
  Layer.provide(EventJournal.layerIndexedDb()),
)

const makeClient = EventLog.makeClient(ReceiptAppEvents)

export class EventLogClient extends Context.Tag("EventLog/EventLogClient")<
  EventLogClient,
  Effect.Effect.Success<typeof makeClient>
>() {
  static Default = Layer.effect(EventLogClient, makeClient)
}

// atom

export const eventLogAtom = Atom.runtime((get) =>
  EventLogClient.Default.pipe(
    Layer.provideMerge(
      Effect.gen(function* () {
        const identity = yield* get.some(identityAtom)
        return EventLogLayer.pipe(
          Layer.provideMerge(Layer.succeed(Identity, identity)),
        )
      }).pipe(Layer.unwrapEffect),
    ),
  ),
)

export const clientAtom = eventLogAtom.atom(() => EventLogClient)

export const remoteAddressAtom = Atom.kvs({
  runtime: kvsRuntime,
  key: "receipts_remote_address",
  schema: Schema.OptionFromNullishOr(Schema.String, undefined),
  defaultValue: Option.none,
})

export const remoteAtom = Atom.runtime((get) =>
  Effect.gen(function* () {
    const identity = yield* get.some(identityAtom)
    const remoteAddress = yield* get.some(remoteAddressAtom)
    const url = new URL(remoteAddress)
    url.searchParams.set("publicKey", identity.publicKey)
    return EventLogRemote.layerWebSocketBrowser(url.toString()).pipe(
      Layer.provide(get(eventLogAtom.layer)),
    )
  }).pipe(Layer.unwrapEffect),
)
