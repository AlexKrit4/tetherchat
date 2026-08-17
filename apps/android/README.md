# TetherChat Android

Native Android wrapper for [TetherChat](https://tetherchat.ru) — a full-screen WebView shell that loads the web messenger with identical design and functionality (auth, servers, channels, DMs, messages, reactions, pins, search, uploads, invites, settings, WebSockets).

## Requirements

- Android Studio Ladybug (2024.2.1) or newer
- JDK 17
- Android SDK with API 35

## Open in Android Studio

1. Open Android Studio.
2. Choose **File → Open**.
3. Select the `apps/android` directory (this folder).
4. Wait for Gradle sync to finish.

## Build APK

From Android Studio:

1. **Build → Build Bundle(s) / APK(s) → Build APK(s)**

From the command line:

```bash
cd apps/android
./gradlew assembleDebug
```

The debug APK is written to:

```
app/build/outputs/apk/debug/app-debug.apk
```

Скопируйте его в веб, чтобы кнопка «Скачать APK» в настройках профиля работала:

```
cp app/build/outputs/apk/debug/app-debug.apk ../../apps/web/public/app/tetherchat.apk
```

После деплоя файл отдаётся как https://tetherchat.ru/app/tetherchat.apk.

Release build (unsigned, for local testing):

```bash
./gradlew assembleRelease
```

## Change the loaded URL

The default URL is `https://tetherchat.ru`, defined in `app/build.gradle.kts`:

```kotlin
buildConfigField("String", "WEB_URL", "\"https://tetherchat.ru\"")
```

Change the value, sync Gradle, and rebuild. `MainActivity` loads `BuildConfig.WEB_URL` on startup.

For deep links, `AndroidManifest.xml` already handles `https://tetherchat.ru` and `https://www.tetherchat.ru`.

## Project overview

| Setting | Value |
|---------|-------|
| Package | `ru.tetherchat.app` |
| minSdk | 26 |
| targetSdk / compileSdk | 35 |
| AGP | 8.7.3 |
| Gradle | 8.11 |
| Kotlin | 2.0.21 |

## Features

- Dark Discord-like theme (`#1e1f22` background, `#5865f2` brand)
- JavaScript, DOM storage, cookies (including third-party)
- File uploads via system picker (`REQUEST_FILE` / `onShowFileChooser`)
- Download listener with `DownloadManager`
- Geolocation disabled
- Media autoplay without user gesture
- In-app navigation for `tetherchat.ru` / `www.tetherchat.ru` (including `/invite/*`)
- External links open in Chrome Custom Tabs
- Back button navigates WebView history
- Splash screen until first page load completes
- Custom User-Agent suffix: `TetherChatAndroid`
- `CookieManager.flush()` on pause
- Adaptive launcher icon (linked rings)
- Russian default locale, English via `values-en`
- No `google-services.json` required

## Gradle wrapper

`gradle-wrapper.jar` is included. If it is missing, download it:

```bash
curl -fsSL -o gradle/wrapper/gradle-wrapper.jar \
  https://raw.githubusercontent.com/gradle/gradle/v8.11.0/gradle/wrapper/gradle-wrapper.jar
```

Then run `./gradlew wrapper --gradle-version 8.11` to regenerate scripts if needed.
