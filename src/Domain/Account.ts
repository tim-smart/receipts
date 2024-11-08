import { Account, CoMap, Group, Profile, co } from "jazz-tools"
import { Folder, FolderList } from "./Folder"
import { ReceiptList } from "./Receipt"
import { AiJobList } from "./AiJob"

export class ReceiptsAccountRoot extends CoMap {
  folders = co.ref(FolderList)
  aiJobs = co.ref(AiJobList)

  currentFolder = co.ref(Folder)
  openaiApiKey = co.optional.string
  openaiModel = co.optional.string
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
          defaultCurrency: "USD",
          deleted: false,
        },
        { owner: group },
      )

      this.root = ReceiptsAccountRoot.create(
        {
          folders: FolderList.create([firstFolder], {
            owner: this,
          }),
          aiJobs: AiJobList.create([], { owner: this }),
          currentFolder: firstFolder,
          openaiModel: "gpt-4o",
        },
        { owner: this },
      )
    }
  }
}
