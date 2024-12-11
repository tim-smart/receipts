/// <reference types="@cloudflare/workers-types" />
/// <reference types="./worker-configuration.d.ts" />

import { RemoteId } from "@effect/experimental/EventJournal"
import * as EventLogRemote from "@effect/experimental/EventLogRemote"
import * as EventLogServer from "@effect/experimental/EventLogServer"
import * as Socket from "@effect/platform/Socket"
import { layerStorageSubtle } from "@effect/sql/SqlEventLogServer"
import { DurableObject } from "cloudflare:workers"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as Layer from "effect/Layer"
import * as Logger from "effect/Logger"
import * as LogLevel from "effect/LogLevel"
import * as ManagedRuntime from "effect/ManagedRuntime"
import * as Stream from "effect/Stream"
import * as DOSqlite from "./effect-sqlite-in-do"

export class MyDurableObject extends DurableObject {
  readonly messagesWriter: WritableStreamDefaultWriter

  readonly runtime: ManagedRuntime.ManagedRuntime<EventLogServer.Storage, never>

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)

    // https://developers.cloudflare.com/durable-objects/api/state/#gethibernatablewebsocketeventtimeout
    this.ctx.setHibernatableWebSocketEventTimeout(500)

    const messagesStream = new TransformStream<
      Uint8Array | ArrayBuffer,
      Uint8Array
    >({
      transform(chunk, controller) {
        controller.enqueue(
          chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : chunk,
        )
      },
    })
    const messagesWriter = messagesStream.writable.getWriter()
    const broadcastStream = new TransformStream<Uint8Array, Uint8Array>()

    this.messagesWriter = messagesWriter

    const layer = layerStorageSubtle({ insertBatchSize: 25 }).pipe(
      Layer.provide(DOSqlite.layer({ db: ctx.storage.sql })),
      Layer.provideMerge(Logger.minimumLogLevel(LogLevel.All)),
      Layer.orDie,
    )

    this.runtime = ManagedRuntime.make(layer)

    const broadcast = (message: Uint8Array) =>
      Effect.sync(() =>
        this.ctx.getWebSockets().forEach((ws) => ws.send(message)),
      )

    Effect.gen(function* () {
      const handler = yield* EventLogServer.makeHandler

      const socket = yield* Socket.fromTransformStream(
        Effect.succeed({
          readable: messagesStream.readable,
          writable: broadcastStream.writable,
        }),
      )

      yield* pipe(
        Stream.fromReadableStream({
          evaluate: () => broadcastStream.readable,
          onError: (error) => console.error("broadcast readable error", error),
        }),
        Stream.tap((msg) => broadcast(msg)),
        Stream.runDrain,
        Effect.fork,
      )

      yield* handler(socket)
    }).pipe(Effect.scoped, this.runtime.runFork)
  }

  webSocketMessage(
    _ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    return this.messagesWriter.write(message)
  }

  webSocketError(_ws: WebSocket, error: Error): void {
    console.error("websocket error", error)
  }

  webSocketClose(_ws: WebSocket, code: number, reason: string): void {
    console.log("websocket close", code, reason)
  }

  async fetch(): Promise<Response> {
    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)

    this.ctx.acceptWebSocket(server)

    EventLogServer.Storage.pipe(
      Effect.flatMap((_) => _.getId),
      Effect.tap((remoteId) => {
        // If this method is exported from httpHandle, it may be better?
        server.send(
          EventLogRemote.encodeResponse(
            new EventLogRemote.Hello({
              remoteId: RemoteId.make(remoteId),
            }),
          ),
        )
      }),
      this.runtime.runFork,
    )

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === "GET" && url.pathname === "/") {
      return new Response("ok")
    }

    if (request.method === "GET" && url.pathname === "/sync") {
      const upgradeHeader = request.headers.get("Upgrade")
      if (!upgradeHeader || upgradeHeader !== "websocket") {
        return new Response(null, {
          status: 426,
          statusText: "Durable Object expected Upgrade: websocket",
          headers: {
            "Content-Type": "text/plain",
          },
        })
      }

      const publicKey = url.searchParams.get("publicKey")
      if (!publicKey) {
        return Response.json(
          { error: "publicKey is required" },
          { status: 400 },
        )
      }

      const id = env.MY_DURABLE_OBJECT.idFromName(publicKey)
      const stub = env.MY_DURABLE_OBJECT.get(id)

      return stub.fetch(request)
    }

    return new Response("not found", { status: 404 })
  },
} satisfies ExportedHandler<Env>
