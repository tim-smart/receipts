/// <reference types="@cloudflare/workers-types" />
/// <reference types="./worker-configuration.d.ts" />

import { RemoteId } from "@effect/experimental/EventJournal"
import * as EventLogRemote from "@effect/experimental/EventLogRemote"
import * as EventLogServer from "@effect/experimental/EventLogServer"
import { layerStorageSubtle } from "@effect/sql/SqlEventLogServer"
import { DurableObject } from "cloudflare:workers"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Logger from "effect/Logger"
import * as LogLevel from "effect/LogLevel"
import * as ManagedRuntime from "effect/ManagedRuntime"
import * as DOSqlite from "./effect-sqlite-in-do"
import { EncryptedRemoteEntry } from "@effect/experimental/EventLogEncryption"

export class MyDurableObject extends DurableObject {
  readonly runtime: ManagedRuntime.ManagedRuntime<EventLogServer.Storage, never>

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)

    // https://developers.cloudflare.com/durable-objects/api/state/#gethibernatablewebsocketeventtimeout
    this.ctx.setHibernatableWebSocketEventTimeout(5000)

    const layer = layerStorageSubtle({ insertBatchSize: 25 }).pipe(
      Layer.provide(DOSqlite.layer({ db: ctx.storage.sql })),
      Layer.provideMerge(Logger.minimumLogLevel(LogLevel.All)),
      Layer.orDie,
    )

    this.runtime = ManagedRuntime.make(layer)
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    return this.handleRequest(
      ws,
      EventLogRemote.decodeRequest(
        message instanceof ArrayBuffer
          ? new Uint8Array(message)
          : new TextEncoder().encode(message),
      ),
    )
  }

  private chunks = new Map<
    number,
    {
      readonly parts: Array<Uint8Array>
      count: number
      bytes: number
    }
  >()
  private async handleRequest(
    ws: WebSocket,
    request: typeof EventLogRemote.ProtocolRequest.Type,
  ) {
    switch (request._tag) {
      case "WriteEntries": {
        return Effect.gen(this, function* () {
          const storage = yield* EventLogServer.Storage
          const entries = request.encryptedEntries.map(
            ({ encryptedEntry, entryId }) =>
              new EventLogServer.PersistedEntry({
                entryId,
                iv: request.iv,
                encryptedEntry,
              }),
          )
          const encryptedEntries = yield* storage.write(
            request.publicKey,
            entries,
          )
          ws.send(
            EventLogRemote.encodeResponse(
              new EventLogRemote.Ack({
                id: request.id,
                sequenceNumbers: encryptedEntries.map((_) => _.sequence),
              }),
            ),
          )
          const changes = this.encodeChanges(
            request.publicKey,
            encryptedEntries,
          )
          for (const peer of this.ctx.getWebSockets()) {
            if (peer === ws) continue
            for (const change of changes) {
              peer.send(change)
            }
          }
        }).pipe(this.runtime.runPromise)
      }
      case "ChunkedMessage": {
        const data = EventLogRemote.ChunkedMessage.join(this.chunks, request)
        if (!data) return
        return this.handleRequest(ws, EventLogRemote.decodeRequest(data))
      }
      case "RequestChanges": {
        return Effect.gen(this, function* () {
          const storage = yield* EventLogServer.Storage
          const entries = yield* storage.entries(
            request.publicKey,
            request.startSequence,
          )
          if (entries.length === 0) return
          const changes = this.encodeChanges(request.publicKey, entries)
          for (const change of changes) {
            ws.send(change)
          }
        }).pipe(this.runtime.runPromise)
      }
    }
  }

  private encodeChanges(
    publicKey: string,
    entries: ReadonlyArray<EncryptedRemoteEntry>,
  ) {
    let changes = [
      EventLogRemote.encodeResponse(
        new EventLogRemote.Changes({
          publicKey,
          entries,
        }),
      ),
    ]
    if (changes[0].byteLength > 512_000) {
      changes = EventLogRemote.ChunkedMessage.split(
        Math.floor(Math.random() * 1_000_000_000),
        changes[0],
      ).map((_) => EventLogRemote.encodeResponse(_))
    }
    return changes
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
