/// <reference types="@cloudflare/workers-types" />

import * as EventLogServer from "@effect/experimental/EventLogServer"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as Socket from "@effect/platform/Socket"
import { SqlClient } from "@effect/sql/SqlClient"
import { layerStorageSubtle } from "@effect/sql/SqlEventLogServer"
import { DurableObject } from "cloudflare:workers"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as ManagedRuntime from "effect/ManagedRuntime"
import * as DOSqlite from "./effect-sqlite-in-do"
import * as Logger from "effect/Logger"
import * as LogLevel from "effect/LogLevel"

export class MyDurableObject extends DurableObject {
  readonly runtime: ManagedRuntime.ManagedRuntime<EventLogServer.Storage, never>

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)

    const layer = layerStorageSubtle().pipe(
      Layer.provide(DOSqlite.layer({ db: ctx.storage.sql })),
      Layer.provideMerge(Logger.minimumLogLevel(LogLevel.All)),
      Layer.orDie,
    )

    this.runtime = ManagedRuntime.make(layer)
  }

  async fetch(): Promise<Response> {
    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)

    Effect.gen(function* () {
      const handler = yield* EventLogServer.makeHandler
      server.accept()
      const socket = yield* Socket.fromWebSocket(
        Effect.acquireRelease(Effect.succeed(server), (ws) =>
          Effect.sync(() => ws.close()),
        ),
      )
      yield* handler(socket)
    }).pipe(Effect.scoped, this.runtime.runFork)

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
