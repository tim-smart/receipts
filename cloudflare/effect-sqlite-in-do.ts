import type { SqlStorage } from "@cloudflare/workers-types"
import * as Reactivity from "@effect/experimental/Reactivity"
import * as Client from "@effect/sql/SqlClient"
import type { Connection } from "@effect/sql/SqlConnection"
import { SqlError } from "@effect/sql/SqlError"
import * as Statement from "@effect/sql/Statement"
import * as Config from "effect/Config"
import type { ConfigError } from "effect/ConfigError"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { identity } from "effect/Function"
import * as Layer from "effect/Layer"
import type * as Scope from "effect/Scope"
import * as Stream from "effect/Stream"
import * as Chunk from "effect/Chunk"

/**
 * @category type ids
 * @since 1.0.0
 */
export const TypeId: unique symbol = Symbol.for("sql-do/Client")

/**
 * @category type ids
 * @since 1.0.0
 */
export type TypeId = typeof TypeId

/**
 * @category models
 * @since 1.0.0
 */
export interface DOClient extends Client.SqlClient {
  readonly [TypeId]: TypeId
  readonly config: DOClientConfig

  /** Not supported in d1 */
  readonly updateValues: never
}

/**
 * @category tags
 * @since 1.0.0
 */
export const DOClient = Context.GenericTag<DOClient>("sql-do/Client")

/**
 * @category models
 * @since 1.0.0
 */
export interface DOClientConfig {
  readonly db: SqlStorage
  readonly spanAttributes?: Record<string, unknown> | undefined

  readonly transformResultNames?: ((str: string) => string) | undefined
  readonly transformQueryNames?: ((str: string) => string) | undefined
}

/**
 * @category constructor
 * @since 1.0.0
 */
export const make = (
  options: DOClientConfig,
): Effect.Effect<DOClient, never, Scope.Scope | Reactivity.Reactivity> =>
  Effect.gen(function* () {
    const compiler = Statement.makeCompilerSqlite(options.transformQueryNames)
    const transformRows = options.transformResultNames
      ? Statement.defaultTransforms(options.transformResultNames).array
      : undefined

    const makeConnection = Effect.gen(function* () {
      const db = options.db

      function* runIterator(
        sql: string,
        params: ReadonlyArray<Statement.Primitive> = [],
      ) {
        const cursor = db.exec(sql, ...params)
        const columns = cursor.columnNames
        for (const result of cursor.raw()) {
          const obj: any = {}
          for (let i = 0; i < columns.length; i++) {
            const value = result[i]
            obj[columns[i]] =
              value instanceof ArrayBuffer ? new Uint8Array(value) : value
          }
          yield obj
        }
      }

      const runStatement = (
        sql: string,
        params: ReadonlyArray<Statement.Primitive> = [],
      ): Effect.Effect<ReadonlyArray<any>, SqlError, never> =>
        Effect.try({
          try: () => Array.from(runIterator(sql, params)),
          catch: (cause) =>
            new SqlError({ cause, message: `Failed to execute statement` }),
        })

      const runValues = (
        sql: string,
        params: ReadonlyArray<Statement.Primitive> = [],
      ): Effect.Effect<ReadonlyArray<any>, SqlError, never> =>
        Effect.try({
          try: () =>
            Array.from(db.exec(sql, ...params).raw(), (row) => {
              for (let i = 0; i < row.length; i++) {
                const value = row[i]
                row[i] =
                  value instanceof ArrayBuffer ? new Uint8Array(value) : value
              }
              return row
            }),
          catch: (cause) =>
            new SqlError({ cause, message: `Failed to execute statement` }),
        })

      return identity<Connection>({
        execute(sql, params, transformRows) {
          return transformRows
            ? Effect.map(runStatement(sql, params), transformRows)
            : runStatement(sql, params)
        },
        executeRaw(sql, params) {
          return runStatement(sql, params)
        },
        executeValues(sql, params) {
          return runValues(sql, params)
        },
        executeUnprepared(sql, params, transformRows) {
          return transformRows
            ? Effect.map(runStatement(sql, params), transformRows)
            : runStatement(sql, params)
        },
        executeStream(sql, params, transformRows) {
          return Stream.suspend(() => {
            const iterator = runIterator(sql, params)
            return Stream.fromIteratorSucceed(iterator, 16)
          }).pipe(
            transformRows
              ? Stream.mapChunks((chunk) =>
                  Chunk.unsafeFromArray(
                    transformRows(Chunk.toReadonlyArray(chunk)),
                  ),
                )
              : identity,
          )
        },
      })
    })

    const connection = yield* makeConnection
    const acquirer = Effect.succeed(connection)
    const transactionAcquirer = Effect.dieMessage(
      "transactions are not supported in D1",
    )

    return Object.assign(
      (yield* Client.make({
        acquirer,
        compiler,
        transactionAcquirer,
        spanAttributes: [
          ...(options.spanAttributes
            ? Object.entries(options.spanAttributes)
            : []),
        ],
        transformRows,
      })) as DOClient,
      {
        [TypeId]: TypeId as TypeId,
        config: options,
      },
    )
  })

/**
 * @category layers
 * @since 1.0.0
 */
export const layerConfig = (
  config: Config.Config.Wrap<DOClientConfig>,
): Layer.Layer<DOClient | Client.SqlClient, ConfigError> =>
  Layer.scopedContext(
    Config.unwrap(config).pipe(
      Effect.flatMap(make),
      Effect.map((client) =>
        Context.make(DOClient, client).pipe(
          Context.add(Client.SqlClient, client),
        ),
      ),
    ),
  ).pipe(Layer.provide(Reactivity.layer))

/**
 * @category layers
 * @since 1.0.0
 */
export const layer = (
  config: DOClientConfig,
): Layer.Layer<DOClient | Client.SqlClient, ConfigError> =>
  Layer.scopedContext(
    Effect.map(make(config), (client) =>
      Context.make(DOClient, client).pipe(
        Context.add(Client.SqlClient, client),
      ),
    ),
  ).pipe(Layer.provide(Reactivity.layer))