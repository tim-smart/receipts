import { CoList, ImageDefinition, co } from "jazz-tools"

export class ImageList extends CoList.Of(co.ref(ImageDefinition)) {}
