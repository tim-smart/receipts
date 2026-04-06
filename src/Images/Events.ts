import { Image, ImageId } from "@/Domain/Image"
import { uuidString } from "@/lib/utils"
import { EventGroup } from "effect/unstable/eventlog"

export const ImageEvents = EventGroup.empty
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
