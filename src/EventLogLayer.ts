import { Layer } from "effect"
import { EventJournal, EventLog } from "effect/eventlog"
import { ReceiptAppEvents } from "./Events"
import { ImagesLive } from "./Images"
import { ReceiptGroupsLayer } from "./ReceiptGroups"
import { ReceiptsLayer } from "./Receipts"
import { DataReset, ResetLayer } from "./Reset"
import { SettingsLayer } from "./Settings"

// The app's EventLog and handlers over `journal`.
export const layerEventLog = <E, R>(
  journal: Layer.Layer<EventJournal.EventJournal, E, R>,
) =>
  EventLog.layer(
    ReceiptAppEvents,
    Layer.mergeAll(
      ReceiptGroupsLayer,
      ReceiptsLayer,
      SettingsLayer,
      ImagesLive,
      ResetLayer,
    ),
  ).pipe(Layer.provide(DataReset.layer), Layer.provideMerge(journal))
