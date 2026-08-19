# TetherChat Android

Native Jetpack Compose messenger for [tetherchat.ru](https://tetherchat.ru). It talks to the same Fastify API over HTTPS and Socket.IO — there is no WebView.

## Requirements

- Android Studio Ladybug (2024.2.1) or newer
- JDK 17
- Android SDK with API 35

## Build APK

```bash
cd apps/android
./gradlew assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk ../../apps/web/public/app/tetherchat.apk
```

After deploy the file is served as https://tetherchat.ru/app/tetherchat.apk.

## What it includes

- Login, register, forgot/reset password, email verification, invite links
- Server rail with unread badges, channels, categories, DMs and group chats
- Server settings: overview, roles, members, bans, invites
- Chat: replies, edit/delete, reactions, pins, search, typing, markdown, attachments
- Profile, account, appearance (Enter to send), blacklist
- Message notifications when the app is in the background (no persistent “waiting” shade notification)
- Session stored on device (`refreshToken` from the auth JSON)

| Setting | Value |
|---------|-------|
| Package | `ru.tetherchat.app` |
| minSdk | 26 |
| version | 1.2.0 |
| API | `https://tetherchat.ru` (`BuildConfig.API_URL`) |
