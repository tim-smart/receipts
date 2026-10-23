# Receipt scanner + tracker

A simple local-first receipt scanner and tracker.

![Screenshot](./screenshots/desktop.png)

## Features

- Use OpenAI's GPT-4o to extract information from receipt images.
- Store receipt information in a local SQLite database.
- Supports syncing with a remote server, to share receipts across devices.
- Supports offline mode, with automatic sync when the server is available.
- Install as a PWA on your phone or desktop.

## Installation

1. The client is hosted on Vercel at https://receipts.timsmart.co
2. You can run a remote sync server using Docker: https://hub.docker.com/r/timsmart/effect-eventlog-sqlite

   - `docker run -d -p 3000:3000 -v /path/to/data:/data timsmart/effect-eventlog-sqlite`

3. Set the remote server URL in the client settings.

## Upgrading to row sync

Receipts, groups and images now sync as `EventRow` events (`Receipt`, `ReceiptGroup`, `Image`). Older releases wrote separate create / update / delete events, and this release ignores them. After upgrading, a device still shows the data it already has, but that data no longer reaches other devices: a new device, or one that signs out and back in, starts empty. Older releases also ignore the new events.

To move everything over, reset once and re-import a backup:

1. Update every device that syncs with the same account to this release. Close and reopen the app if it doesn't update on its own.
2. On the device with the complete data, open Settings and choose **Export backup**.
3. Choose **Delete all data…**. Export a backup there or confirm that you have one, then choose **Delete everything**.
4. Choose **Import backup** and pick the file from step 2.
5. Open the other devices while they're online. They delete their data and receive the imported data without any action. A device that was still on an older release does this when it updates.

Deleting syncs to every device. The history on the sync server isn't erased, but each device ignores everything older than the deletion, so deleted data can't come back. That includes edits other devices made before the deletion but synced after it, so avoid editing elsewhere during steps 2 to 4.

Settings are kept. The deletion recreates the default "My Receipts" group, and an import keeps groups that already exist, so if you renamed that group, rename it again.

Backups are unaffected by the upgrade. The backup file format hasn't changed, so a backup exported by an older release imports here.
