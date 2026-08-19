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

- Login / register against `/api/auth`
- Server rail, channels, DMs, message list and composer
- Realtime messages and presence over Socket.IO
- System notifications via a silent foreground service while the app is in the background
- Session stored on device (`refreshToken` from the auth JSON)

| Setting | Value |
|---------|-------|
| Package | `ru.tetherchat.app` |
| minSdk | 26 |
| version | 1.1.0 |
| API | `https://tetherchat.ru` (`BuildConfig.API_URL`) |
