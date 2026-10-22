import { Image, ImageId } from "@/Domain/Image"
import { uuidString } from "@/lib/utils"
import { EventGroup, EventRow } from "effect/eventlog"

export const ImageRow = EventRow.make("Image", {
  key: "id",
  schema: Image.select,
})

export const ImageEvents = EventGroup.empty
  .add(ImageRow)
  // Legacy events, kept only so existing journals still replay. Nothing
  // writes them any more.
  .add({
    tag: "ImageCreate",
    primaryKey: (image) => uuidString(image.id!),
    payload: Image.insert,
  })
  .add({
    tag: "ImageDelete",
    primaryKey: (id) => uuidString(id),
    payload: ImageId,
  })
