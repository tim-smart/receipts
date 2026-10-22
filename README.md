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

## Upgrading synced devices

Receipts, groups and images sync as `EventRow` events (`Receipt`, `ReceiptGroup`, `Image`). Older releases wrote separate create / update / delete events instead. The current release still replays those older events, so existing journals and remote data load as before. Older releases can't read the new events, though: they skip them without an error.

When you upgrade, update every device that syncs with the same remote. A device left on an older release won't see receipts, groups or images created or edited on upgraded devices.

Backups are unaffected. The backup file format hasn't changed, so backups import into either version.
