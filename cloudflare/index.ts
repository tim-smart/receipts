/// <reference types="@cloudflare/workers-types" />
/// <reference types="./worker-configuration.d.ts" />

import { EventLogDurableObject } from "@effect/experimental/EventLogServer/Cloudflare"
import { layerStorageSubtle } from "@effect/sql/SqlEventLogServer"
import * as Layer from "effect/Layer"
import * as Logger from "effect/Logger"
import * as LogLevel from "effect/LogLevel"
import { SqliteClient } from "@effect/sql-sqlite-do"

export class MyDurableObject extends EventLogDurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super({
      ctx,
      env,
      storageLayer: layerStorageSubtle({ insertBatchSize: 25 }).pipe(
        Layer.provide(SqliteClient.layer({ db: ctx.storage.sql })),
        Layer.provideMerge(Logger.minimumLogLevel(LogLevel.All)),
        Layer.orDie,
      ),
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
