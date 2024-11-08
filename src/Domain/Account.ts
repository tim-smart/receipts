import { Account, CoMap, Group, Profile, co } from "jazz-tools"
import { Folder, FolderList } from "./Folder"
import { ReceiptList } from "./Receipt"

export class ReceiptsAccountRoot extends CoMap {
  folders = co.ref(FolderList)
  currentFolder = co.ref(Folder)
}

export class ReceiptsAccount extends Account {
  profile = co.ref(Profile)
  root = co.ref(ReceiptsAccountRoot)

  migrate(this: ReceiptsAccount, creationProps?: { name: string }) {
    super.migrate(creationProps)
    if (!this._refs.root) {
      const group = Group.create({ owner: this })
      const firstFolder = Folder.create(
        {
          name: "My Receipts",
          items: ReceiptList.create([], { owner: group }),
        },
        { owner: group },
      )

      this.root = ReceiptsAccountRoot.create(
        {
          folders: FolderList.create([firstFolder], {
            owner: this,
          }),
          currentFolder: firstFolder,
        },
        { owner: this },
      )
    }
  }
}
