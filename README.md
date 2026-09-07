# TetherChat

Messenger for teams and friends. Production is the Classic client on https://tetherchat.ru. Graphite on port 1489 is the single experimental web surface. Aurora on 1488 is frozen — do not add a third live mockup.

## Product contract

- Attachments are private. Avatars, icons and wallpapers stay on `/files/`. Message files are served only as signed `GET /api/files/:id`.
- Sending survives a drop: an offline outbox retries when the socket reconnects, failed bubbles can be tapped, and drafts sync across tabs and devices.
- Channel threads stay in the channel. Quote-reply remains in the timeline; “open thread” is a side conversation, not a new channel.
- Group DMs of 3–12 people can show “seen by N”. Server channels do not get Telegram ticks.
- Search is global (text, files, links), not only the current channel. Cmd+K includes message hits.
- The Android app is a first-class client: share-to-TetherChat, swipe-to-reply, launcher badge as an unread count. The Tauri desktop shell has a tray, a global hotkey (`Ctrl/Cmd+Shift+T`) and native notifications.
