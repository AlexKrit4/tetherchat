# TetherChat Desktop

Native desktop client for **Windows** (`.exe` installer) and **Linux** (`.AppImage` and `.deb`).

This is **not** a browser tab pointed at tetherchat.ru. The app ships the same UI assets as the web client **locally** inside a native shell (Rust + Tauri) and talks to the TetherChat API over HTTPS/WebSocket — the same model as the Android app.

## Stack

| Layer | Technology |
|-------|------------|
| Shell | [Tauri 2](https://tauri.app/) (Rust) |
| UI | Existing React app from `apps/web` (desktop layout) |
| Backend | `https://tetherchat.ru` API + Socket.IO |

## Requirements

- Node.js 20+
- Rust (stable) + Cargo
- Linux build deps: `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `patchelf`
- Windows build: Visual Studio Build Tools + WebView2 (Tauri installer can bootstrap WebView2)

## Development

From the repository root:

```bash
npm ci
npm run dev -w @tetherchat/api   # in one terminal
cd apps/desktop && npm run dev    # launches Vite + Tauri window
```

The dev window loads `http://localhost:5173` with `VITE_DESKTOP=1` and API at `http://localhost:4000`.

## Production build

```bash
npm ci
cd apps/desktop
npm run build
```

Artifacts:

| OS | Output |
|----|--------|
| Windows | `src-tauri/target/release/bundle/nsis/TetherChat_*_x64-setup.exe` |
| Linux | `src-tauri/target/release/bundle/appimage/TetherChat_*_amd64.AppImage` |
| Linux | `src-tauri/target/release/bundle/deb/tetherchat_*_amd64.deb` |

Production builds point at `https://tetherchat.ru` for REST and WebSocket.

## Auth

Desktop stores the refresh token in `localStorage` (same as multi-account on web) and refreshes via `X-Refresh-Token` — no httpOnly cookies. The API allows Tauri origins in CORS (`tauri://localhost`, `https://tauri.localhost`).

## Release checklist

1. Bump `version` in `src-tauri/tauri.conf.json` and `Cargo.toml`
2. `npm run build` in `apps/desktop`
3. Upload installers to releases / `apps/web/public/app/`
