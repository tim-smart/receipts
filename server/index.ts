/// <reference types="@cloudflare/workers-types" />

import * as EventLogServer from "@effect/experimental/EventLogServer"
import * as Reactivity from "@effect/experimental/Reactivity"
import * as HttpServerRequest from "@effect/platform/HttpServerRequest"
import * as Socket from "@effect/platform/Socket"
import { SqlClient } from "@effect/sql/SqlClient"
import { layerStorageSubtle } from "@effect/sql/SqlEventLogServer"
import { DurableObject } from "cloudflare:workers"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as ManagedRuntime from "effect/ManagedRuntime"
import * as DOSqlite from "./effect-sqlite-in-do"

export class MyDurableObject extends DurableObject {
  readonly runtime: ManagedRuntime.ManagedRuntime<
    SqlClient | EventLogServer.Storage | DOSqlite.DOClient,
    never
  >

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)

    const layer = Layer.empty.pipe(
      Layer.provideMerge(layerStorageSubtle()),
      Layer.provideMerge(DOSqlite.layer({ db: ctx.storage.sql })),
      Layer.provide(Reactivity.layer),
      Layer.orDie,
    )

    this.runtime = ManagedRuntime.make(layer)
  }

  async fetch(request: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)

    server.accept()

    const handle = EventLogServer.makeHttpHandler.pipe(this.runtime.runSync)
    const fakeUpgrade = Socket.fromWebSocket(Effect.succeed(server))

    handle.pipe(
      Effect.provideService(
        HttpServerRequest.HttpServerRequest,
        HttpServerRequest.HttpServerRequest.of({
          upgrade: fakeUpgrade,
        } as unknown as HttpServerRequest.HttpServerRequest),
      ),
      Effect.scoped,
      this.runtime.runFork,
    )

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    let pathname = new URL(request.url).pathname

    if (request.method === "GET" && pathname === "/") {
      return new Response("ok")
    }

    if (request.method === "GET" && pathname === "/sync") {
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

      /**
       * Hardcoded username for now
       */
      const username = "foo"
      let id: DurableObjectId = env.MY_DURABLE_OBJECT.idFromName(username)
      let stub = env.MY_DURABLE_OBJECT.get(id)

      return stub.fetch(request)
    }

    return new Response("not found", { status: 404 })
  },
} satisfies ExportedHandler<Env>
