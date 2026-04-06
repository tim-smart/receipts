import { Effect, Layer, Option, Schema, ServiceMap } from "effect"
import { Atom } from "effect/unstable/reactivity"
import { EventLog, EventLogRemote } from "effect/unstable/eventlog"
import { ReceiptAppEvents } from "./Events"
import { ReceiptGroupsLayer } from "./ReceiptGroups"
import { ReceiptsLayer } from "./Receipts"
import { SettingsLayer } from "./Settings"
import { ImagesLive } from "./Images"
import { identityAtom } from "./Auth"
import { kvsRuntime } from "./lib/utils"
import { Identity } from "effect/unstable/eventlog/EventLog"
import { RpcClient, RpcSerialization } from "effect/unstable/rpc"
import { BrowserSocket } from "@effect/platform-browser"

const EventLogLayer = EventLog.layer(
  ReceiptAppEvents,
  Layer.mergeAll(ReceiptGroupsLayer, ReceiptsLayer, SettingsLayer, ImagesLive),
).pipe()

const makeClient = EventLog.makeClient(ReceiptAppEvents)

export class EventLogClient extends ServiceMap.Service<
  EventLogClient,
  Effect.Success<typeof makeClient>
>()("EventLog/EventLogClient") {
  static readonly layer = Layer.effect(EventLogClient, makeClient)
}

// atom

export const eventLogAtom = Atom.runtime((get) =>
  EventLogClient.layer.pipe(
    Layer.provideMerge(
      Effect.gen(function* () {
        const identity = yield* get.some(identityAtom)
        return EventLogLayer.pipe(
          Layer.provideMerge(Layer.succeed(Identity, identity)),
        )
      }).pipe(Layer.unwrap),
    ),
  ),
)

export const clientAtom = eventLogAtom.atom(EventLogClient.asEffect())

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
    return EventLogRemote.layerEncrypted.pipe(
      Layer.provide(
        RpcClient.layerProtocolSocket({ retryTransientErrors: true }),
      ),
      Layer.provide(RpcSerialization.layerMsgPack),
      Layer.provide(BrowserSocket.layerWebSocket(url.toString())),
    )
  }).pipe(Layer.unwrap),
)
