import { Image, ImageId } from "@/Domain/Image"
import { uuidString } from "@/lib/utils"
import { EventGroup } from "@effect/experimental"

export class ImageEvents extends EventGroup.empty
  .add({
    tag: "ImageCreate",
    primaryKey: (image) => uuidString(image.id!),
    payload: Image.insert,
    success: Image,
  })
  .add({
    tag: "ImageDelete",
    primaryKey: (id) => uuidString(id),
    payload: ImageId,
  }) {}
