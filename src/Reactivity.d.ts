import "effect/reactivity/Reactivity"

// Service methods allow runtime keys; use `satisfies Reactivity.KeysInput` there.
declare module "effect/reactivity/Reactivity" {
  interface Keys {
    // EventRow primary keys are encoded strings, not the domain UUID bytes.
    readonly receipts: string
    readonly receipt_groups: string
    readonly images: string
    readonly settings: string
  }
}
