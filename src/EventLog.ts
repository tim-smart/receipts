import { Effect, Layer, Option, Schema, Context } from "effect"
import { Atom } from "effect/unstable/reactivity"
import {
  Event,
  EventGroup,
  EventJournal,
  EventLog,
  EventLogRemote,
} from "effect/unstable/eventlog"
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
).pipe(
  Layer.provide(
    EventJournal.layerIndexedDb({
      database: "receipts_events",
    }),
  ),
)

const makeClient = EventLog.makeClient(ReceiptAppEvents)

export class EventLogClient extends Context.Service<
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

export type EventPayload =
  (typeof ReceiptAppEvents.groups)[number] extends EventGroup.EventGroup<
    infer _Event
  >
    ? _Event extends Event.Event<
        infer _Tag,
        infer _Payload,
        infer _Success,
        infer _Error
      >
      ? {
          readonly event: _Tag
          readonly payload: _Payload["Type"]
        }
      : never
    : never

export const writeEventAtom = eventLogAtom
  .fn<EventPayload>()(
    (payload) =>
      EventLog.EventLog.use((_) =>
        _.write({
          schema: ReceiptAppEvents,
          ...payload,
        } as any),
      ).pipe(Effect.tapCause(Effect.logWarning)),
    { concurrent: true },
  )
  .pipe(Atom.keepAlive)

export const remoteAddressAtom = Atom.kvs({
  runtime: kvsRuntime,
  key: "receipts_remote_address",
  schema: Schema.OptionFromNullishOr(Schema.String, undefined),
  defaultValue: Option.none,
})

export const remoteAtom = Atom.runtime((get) =>
  Effect.gen(function* () {
    const remoteAddress = yield* get.some(remoteAddressAtom)
    const url = new URL(remoteAddress)
    return EventLogRemote.layerEncrypted.pipe(
      Layer.provide(EventLog.layerRegistry),
      Layer.provide(
        RpcClient.layerProtocolSocket({ retryTransientErrors: true }),
      ),
      Layer.provide(RpcSerialization.layerMsgPack),
      Layer.provide(BrowserSocket.layerWebSocket(url.toString())),
    )
  }).pipe(Layer.unwrap),
)
