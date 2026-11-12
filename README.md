# StrataLauncher

A cross-platform (Windows, macOS, Linux) custom Minecraft: Java Edition
launcher. StrataLauncher pairs a **headless C++ core daemon**
(`strata-core serve`) with an **Electron + Vite + React (TypeScript)**
desktop client. The two communicate over an authenticated JSON-RPC 2.0
bridge on a loopback WebSocket.

> This is a hobby project and not meant to replace anything! May contain
> security issues and flaws! Not affiliated with Mojang Studios, Microsoft,
> or any other official platform partner.

The legacy Qt Quick frontend is retained as a frozen fallback under
`cpp/legacy-qml/` (target `stratalauncher`); it is no longer developed.

## Features

- Offline and Microsoft (device-code) accounts; credentials live in the
  core's credential store (QtKeychain) and never reach the renderer.
- Mojang version manifest with offline cache fallback; create/launch/stop
  instances with per-instance `options.txt`, Java flags, runtime selection.
- Loader installs: Fabric, Quilt, Forge, NeoForge.
- Java runtime management: Mojang, Temurin, Zulu — install, inventory,
  per-instance or system selection, reviewed deletion.
- Modrinth content management for instances and Paper/Fabric servers,
  including dependency resolution.
- Dev server manager: Vanilla/Paper/Fabric servers, EULA flow,
  `server.properties` editing, live console, resource monitoring.
- Import instances from the Official Minecraft Launcher, PrismLauncher,
  SKLauncher, CurseForge app, and Modrinth app (`.mrpack`).
- Exports `instance.cfg` + `mmc-pack.json` per instance so MultiMC-derived
  launchers can import StrataLauncher instances.
- Dark/light themes, bundled fonts (DM Sans, Outfit, JetBrains Mono,
  Material Symbols), animated startup/install overlays, command palette
  (Ctrl+K) with unified search, toasts, and a frame-time debug overlay.

## Repository layout

- `cpp/core/` — headless core library (Qt Core/Network/WebSockets only).
- `cpp/app/` — `strata-core` executable (`serve` daemon mode).
- `cpp/tests/` — Qt Test suites (run under ASan/UBSan in the debug preset).
- `cpp/legacy-qml/` — frozen Qt Quick fallback UI.
- `electron/` — Electron main/preload/renderer (Vite + React + TypeScript).
- `scripts/` — packaging helpers (`package-electron.sh`,
  `deploy-core-bundle.*`).
- `docs/PARITY.md` — Java → C++/React behavior parity map.
- `docs/PARITY.md`, `PHASES.md`, `AGENTS.md` — project rules and history.

## Build from source

Prerequisites: CMake ≥ 3.25, Ninja, a C++20 compiler, Qt ≥ 6.8
(Core/Network/WebSockets/DBus development packages), libarchive, zlib,
QtKeychain (see `scripts/build-qtkeychain.sh`), Node.js ≥ 22, npm.

### Core

```sh
cmake --preset debug
cmake --build --preset debug
ctest --preset debug --output-on-failure   # ASan + UBSan clean
```

### Desktop client (dev)

```sh
cd electron
npm install
npm run dev        # electron-vite dev server + Electron window
```

The dev app locates `strata-core` under `build/qt-{debug,release}/` or via
the `STRATA_CORE_PATH` environment variable.

### Tests

```sh
cd electron
npm test           # Vitest
npm run typecheck  # tsc --noEmit
npm run build      # production renderer build
```

## Packaging

```sh
./scripts/package-electron.sh           # host platform
./scripts/package-electron.sh --win     # cross-compile not supported; run on Windows
```

The script builds `strata-core` (release), assembles a self-contained
bundle (`dist/strata-core-bundle/` — binary + shared-library closure + Qt
TLS/networkinformation plugins; `scripts/deploy-core-bundle.{sh,ps1}` and
`deploy-core-bundle-mac.sh` for Linux/Windows/macOS), builds the renderer,
and runs electron-builder (`electron/electron-builder.yml`). Artifacts land
in `dist/electron/`:

- Linux: AppImage + tar.gz
- macOS: dmg + zip
- Windows: NSIS installer + zip

The packaged app resolves the core at
`resources/strata-core/strata-core[.exe]` and performs the same
`STRATA_READY {"port":N,"token":"..."}` handshake as dev mode. CI coverage
lives in `.github/workflows/electron.yml` (dispatch with
`platform=windows|linux|macos|all`).

## Data and configuration

- Data directory: `~/.local/share/StrataLauncher` (Linux),
  `%APPDATA%/StrataLauncher` (Windows), `~/Library/Application Support` (macOS);
  overridable in Settings → General → Data or via
  `strata-core serve --data-dir <path>`.
- `instance.json`, settings, `options.txt`, and `servers.dat` formats are
  compatible with the Java/QML launcher. Stored account tokens do **not**
  migrate — sign in again.
- The IPC token is generated per session, travels only inside the Electron
  main process, and never reaches renderer page JS.

## License

GPL-3.0-only — see `LICENSE`. Third-party notices (Qt LGPL, QtKeychain,
libarchive, zlib, OpenSSL, Electron/Chromium, and the npm dependency tree)
are in `THIRD_PARTY_NOTICES` and `LICENSES/`.

## Known limitations

- Native OS file dialogs are not used; all dialogs are in-window overlays.
- Windows and macOS packages are built in CI and are not individually
  verified by the maintainer (no macOS hardware; Windows tested via CI
  artifacts and `docs/WINDOWS_MANUAL_TEST.md`).
- Signed/notarized binaries are not produced; expect OS trust prompts.
- Interactive in-game key-capture for control rebinding is not implemented
  (bindings/conflict detection are).
