# Sentinel
A custom UI for SirHurt V5 built with Tauri v2, React, and Rust.

## Features
- Downloads and manages SirHurt V5 core files directly from sirhurt.net
- Injects into Roblox and confirms via debug log watching
- Tab-based script editor with Monaco — open and edit multiple scripts at once
- Script hub pulling from rscripts.net
- Autoexec support — scripts run automatically after each injection
- Roblox console output forwarded to the built-in terminal via Lua relay
- Discord RPC support
- All settings and session data saved to `%AppData%\_Sentinel`

## Stack
- **Tauri v2** — app shell, file system, window management
- **React + Vite** — frontend
- **Monaco Editor** — script editor
- **Rust** — all backend logic (injection, downloads, Discord IPC)
- **Tailwind CSS v4** — styling

## Building from source
You need [Rust](https://rustup.rs), [Node.js](https://nodejs.org), and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm tauri build
```

For development:
```bash
pnpm tauri dev
```

## Notes
- Windows only
- Requires SirHurt V5 — won't work with other executors
- Add `%AppData%\_Sentinel` to Windows Defender exclusions or the DLL will get flagged
- The auto-updater checks `github.com/xDodox/Sentinel/releases/latest`
