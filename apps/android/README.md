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
- Message notifications when the app is only in the background (Socket.IO) and when it is fully closed (FCM)
- Session stored on device (`refreshToken` from the auth JSON)

Closed-app delivery needs a Firebase Android app for package `ru.tetherchat.app`
and the `FCM_*` variables on the API. The APK fetches public client ids from
`GET /api/push/android-config` at runtime, so rotating those ids does not require
rebuilding the APK. Add the debug SHA-1 below to the Firebase Android app.

| Setting | Value |
|---------|-------|
| Package | `ru.tetherchat.app` |
| minSdk | 26 |
| version | 1.2.1 |
| API | `https://tetherchat.ru` (`BuildConfig.API_URL`) |
| Debug SHA-1 | `D0:42:F0:3A:D3:5D:43:F4:8C:7C:3A:02:33:86:88:E9:BA:44:F4:98` |
