import { Image } from "@/Domain/Image"
import { EventGroup, EventRow } from "effect/eventlog"

export const ImageRow = EventRow.make("Image", {
  key: "id",
  schema: Image.select,
})

export const ImageEvents = EventGroup.empty.add(ImageRow)
