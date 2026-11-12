# AGENTS.md - Project Instructions

## Online Documentation

Official docs for every library and framework used in this project. Check these before guessing APIs.

- Electron: https://www.electronjs.org/docs/latest/
- Vite: https://vite.dev/
- React & React Router: https://react.dev/ and https://reactrouter.com/
- Tailwind CSS: https://tailwindcss.com/docs
- beUI (shadcn + Tailwind + Framer Motion component library): https://beui.dev/
- Framer Motion: https://motion.dev/
- Anime.js: https://animejs.com/documentation/
- MiniSearch: https://lucaong.github.io/minisearch/
- Supabase (deferred module): https://supabase.com/docs
- Zustand: https://zustand.docs.pmnd.rs/
- Qt 6 Core & Network (backend only): https://doc.qt.io/qt-6/

## Project
StrataLauncher: a cross-platform (Windows, macOS, Linux) custom Minecraft: Java Edition launcher.

Architecture: a **headless C++ core daemon** (`strata-core serve`) performs all launcher logic, and an **Electron + Vite + React (TypeScript)** desktop client renders the UI. The two communicate over a JSON-RPC 2.0 IPC bridge on a loopback WebSocket. The old Qt Quick (QML) frontend is retained temporarily as a fallback under `cpp/legacy-qml/` and is frozen — do not extend it.

The Java code (`src/`, `build.gradle.kts`, ...) is LEGACY. It is the behavior specification. Port/verify behavior from its source and tests. Record every deviation in `docs/PARITY.md`. Old Java phase history is in `docs/legacy-java/PHASES-java.md`.

Authentication remains offline-first through parity completion. Microsoft sign-in and credential storage live strictly inside the C++ core. Supabase cloud sync is a deferred post-parity module (see Stack).

## Stack

### Frontend (Electron renderer)
- Electron + Vite, React 18/19 + TypeScript, React Router for in-window navigation.
- Tailwind CSS + beui.dev component library (shadcn-style primitives built on Tailwind + Framer Motion). Quick Controls-style custom theming is replaced by Tailwind theme tokens and CSS variables.
- State: Zustand stores per domain (instances, installs, runtimes, auth, servers, content, settings, console). High-frequency IPC events update external stores — never per-line `setState` in components.
- Search: MiniSearch client-side indexes of version manifests, mods/content, runtimes, servers, and settings.
- Supabase (`@supabase/supabase-js`): DEFERRED. Only for cloud-syncing instance configurations, profiles, JVM flag presets, and settings blobs — never game files. Session tokens persist via Electron `safeStorage`, not `localStorage`. Microsoft/Mojang game auth stays in the C++ core; Supabase auth is a separate launcher account concern.

Required baseline imports (must resolve without conflicts):
```typescript
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { BrowserRouter, MemoryRouter, Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import anime from 'animejs';
import MiniSearch from 'minisearch';
import { createClient, SupabaseClient } from '@supabase/supabase-js'; // deferred module
```

### Backend (C++ core, unchanged)
- C++20, CMake 3.25+ with presets, Ninja. Warnings: `-Wall -Wextra -Wpedantic`, treated as errors in CI. `.clang-format` and a clang-tidy config (bugprone-*, modernize-*, selected cppcoreguidelines-*).
- Qt >= 6.8 Core + Network ONLY (no Gui/Quick in the active core). The daemon runs headless via `strata-core serve`.
- Non-Qt dependencies only where Qt has no equivalent: QtKeychain (credentials), libarchive (tar.gz/zip), zlib (NBT gzip). `find_package` first, `vcpkg.json` fallback. Each needs a one-line justification in `PHASES.md`.
- Namespace `strata`. PascalCase classes, camelCase methods, `m_` members.

## IPC contract (Electron <-> C++ core)

- Transport: JSON-RPC 2.0 over a WebSocket bound to `127.0.0.1` on an ephemeral port.
- Startup: Electron main spawns `strata-core serve --port 0 --token <random>`. The core prints exactly one line to stdout once listening:
  `STRATA_READY {"port":<N>,"token":"<token>"}`
  Electron main parses this line, then connects. The port+token reach the renderer ONLY through the preload `contextBridge` proxy — never expose the raw socket or token to page JS.
- Requests: `{"jsonrpc":"2.0","id":N,"method":"<domain>.<verb>","params":{...}}`. Methods mirror the controller invokable surface: `instances.*`, `install.*`, `launch.*`, `accounts.*`, `auth.*`, `runtime.*`, `servers.*`, `content.*`, `settings.*`, `console.*`. Responses: `{"jsonrpc":"2.0","id":N,"result":...}` or `{"error":{"code":...,"message":...}}`.
- Events (server push): `{"jsonrpc":"2.0","method":"<event>","params":{...}}` — e.g. `install.progress`, `console.line`, `runtime.progress`, `server.log`, `auth.deviceCode`, `instances.changed`. The renderer subscribes via the bridge and writes into Zustand stores.
- Throttling: high-frequency events (console lines, download progress) are coalesced server-side to at most ~50–100 ms (or on item change). Large payloads (manifests, inventories, server properties) are cached/diffed core-side; send deltas where cheap.
- Security: tokens, credentials, and full launch args never cross IPC in logs or events. The core substitutes the access token into game args at launch only.

## Layout
- `electron/` -> Vite app: `main/` (Electron main: spawn core, IPC proxy, safeStorage), `preload/` (contextBridge API), `renderer/` (React app, `src/`), `shared/` (IPC types). QML module work is frozen.
- `cpp/core/` -> static lib `strata_core`: QtCore + QtNetwork ONLY, no Gui/Quick. Mirrors Java packages: instance, mojang, launch, download, auth, loader, modrinth, settings, server, runtime, logging, ipc.
- `cpp/core/ipc/` -> JSON-RPC 2.0 WebSocket server + dispatcher wrapping the controller surface; `cpp/app/` -> `strata-core` executable (`serve` daemon mode; the Qt GUI bootstrap moves to `cpp/legacy-qml/`).
- `cpp/legacy-qml/` -> frozen Qt Quick UI kept as temporary fallback. Do not modify except to keep it building.
- `cpp/tests/` -> Qt Test (core), including IPC dispatcher tests.
- `electron/renderer/src/` -> React components/hooks/pages, Zustand stores, MiniSearch indexes, Tailwind theme.
- `assets/` (repo-level or `electron/renderer/src/assets/`) -> fonts (DM Sans, Outfit, JetBrains Mono), icons, logo. Reuse existing SVGs.
- `docs/PARITY.md`: Java class -> C++ class -> UI status (QML legacy / React) -> test status -> known differences.

## Build and test commands
- Core: `cmake --preset debug && cmake --build --preset debug` (Qt Core/Network + ipc + tests only)
- Core tests: `ctest --preset debug --output-on-failure` (headless)
- UI dev: `cd electron && npm install && npm run dev` (electron-vite dev server + Electron)
- UI build: `cd electron && npm run build`
- UI tests: `cd electron && npm test` (Vitest + Testing Library; Playwright for smoke where needed)
- Release: `cmake --preset release && cmake --build --preset release` and `npm run build` in `electron/`
- Presets: `debug` (ASan + UBSan), `release`, `offscreen-test`.

## Rules: parity and data
- Preserve user-visible behavior and text, including:
  - Hobby warning: "This is a hobby project and not meant to replace anything! May contain security issues and flaws! Not affiliated with Mojang Studios, Microsoft, ..." (startup splash and About page, plus a copyright line).
  - Installing screen: white centered header "Installing <instance-name>...", centered animated progress bar, small gray centered "Downloading: <item>".
  - Typed `DELETE` confirmation for destructive actions.
- Use the same data directories (`~/.local/share/StrataLauncher`, `%APPDATA%`, `~/Library/Application Support`). Keep instance.json, settings, options.txt, and servers.dat formats compatible. Stored tokens do not migrate (users sign in again); document it.
- Supabase sync (when implemented) covers config blobs only — instance.json, settings, JVM flag presets — never game files. Local disk remains source of truth with last-write-wins conflict resolution.
- Translate each Java test suite into Qt Test (core) first, then write C++ until it passes; UI behavior is verified against the React renderer.

## Rules: memory safety and security
- RAII only in C++. No raw owning pointers, no manual new/delete. Use Qt parent ownership, `std::unique_ptr`, `QPointer`. Bounds-checked access (`.at()`).
- The debug preset builds with AddressSanitizer + UBSan. All core tests must pass under it.
- Preserve every Java security behavior:
  - Tokens only through the credential store (QtKeychain in core; Electron `safeStorage` for any renderer-side secrets). Never log tokens, keys, or full launch args that contain them. The IPC token is per-session and never exposed to page JS.
  - SHA verification on every download.
  - Archive extraction rejects absolute paths, `..`, and symlink escapes, and verifies integrity.
  - Processes via `QProcess` with argument lists, never a shell string.
  - Access token substituted into game args only at launch (inside the core).
  - Atomic config writes (`QSaveFile` in core; renderer writes go through IPC, never direct file I/O).
  - TLS defaults stay on. Bounded reads of network responses.
  - Electron: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; preload exposes only the typed IPC proxy.

## Rules: threading and performance
- The GUI/renderer thread never blocks. Core work stays async (QNetworkAccessManager, QtConcurrent/QThreadPool, queued signals); the IPC layer batches events rather than flooding the socket.
- Renderer performance: high-frequency streams update Zustand stores, not React state; components subscribe selectively. No file I/O or large JSON parsing on the renderer main thread beyond what IPC delivers.
- Target: steady 60 FPS on the maintainer's machine (Intel HD 4600, Mesa, Wayland). Electron inherits Chromium's Wayland support — enable it (`--ozone-platform=wayland` or auto) and log the effective platform/backend at startup.
- Debug-only frame-time overlay (off by default) in the renderer.
- Build views and flyouts once and reuse them (hidden or translated). Never construct them at transition time. Pre-load fonts and icons at startup.

## Rules: platform
- The maintainer cannot test macOS. Keep OS-specific logic (paths, osx/arm64 rule evaluation, runtime selection, `-XstartOnFirstThread`, safeStorage behavior) in small injectable functions in the C++ core with unit tests simulating Windows/macOS/Linux and x64/arm64. Renderer platform differences go through the typed IPC/settings surface.
- The launcher has no JVM of its own but still downloads and manages Java runtimes (Mojang, Temurin, Zulu) for Minecraft and servers.

## UI and animation spec
Modern UI, dark/light toggle, sleek gradient style, rounded corners from one central radius token. Base the look on the official Minecraft launcher and SKLauncher; do not copy their branding or assets.
- Fonts (bundled, loaded at startup): DM Sans (UI), Outfit (headers/titles), JetBrains Mono (consoles).
- Icons: reuse the existing SVGs. `*-dark.svg` = fill #000000 (light-mode backgrounds), `*-light.svg` = fill #ffffff (dark-mode backgrounds). Check how the Java `IconAssets` handles pairs and mirror it. Icons recolor with the theme at runtime (React component selecting the pair by theme, or `currentColor` + CSS).
- Theme tokens live in Tailwind config / CSS variables (one central radius token). Dark/light toggle persists via IPC to `ThemeSettings`.
- Motion: Framer Motion is the primary engine. The three curves from `CURVES.md` map to cubic-bezier arrays:
  - standard `[0.25, 0.1, 0.25, 1]`
  - emphasis `[0.22, 1, 0.36, 1]`
  - express `[0.2, 0.8, 0.2, 1]`
  Respect `useReducedMotion()` plus the persisted reduce-motion setting.
- Anime.js is reserved for imperative timelines the React tree should not own: startup logo/warning sequence orchestration, SVG stroke-draw/logo reveals, canvas background particles. Never mutate `style` on nodes Framer Motion or React manages; animejs targets must be refs to non-React-managed SVG/canvas elements. Animate `transform`/`opacity` only. Sequence animejs timelines with React mount/unmount via promises/callbacks so `AnimatePresence` exit animations complete first.
- Animations:
  - Startup: logo, warning, copyright. Minimum 3 seconds, longer if initialization is still running. All refreshes begin only after the window and animation are visible.
  - Button click/hover; instance card hover.
  - Page/tab switch: crossfade + slight horizontal translation (`AnimatePresence` + variants), staggered element fade + move in; tab indicator uses shared `layoutId`.
  - Progress bar movement is interpolated (framer-motion `useSpring`/`animate` on the IPC progress value).
  - Status light: grey (no animation) when not running; blue after process start and before readiness; green only after an in-game readiness signal (never a timer), with a slight in/out fade blink plus a growing overlay dot; red on crash. Driven by IPC `launch.status` events.
  - Live console: fade in + vertical slide in; virtualized list, appended lines batched.
  - Flyouts (instance settings, launcher settings, accounts): slide + fade, built once and reused.
  - Toasts: centered at the bottom, sleek fade in; pulse + size increase for warn/error.
- All dialogs are in-window overlays (React portals within the same window), never separate OS windows. Document unavoidable native file dialogs as known gaps.

## Working rules
- Use grep to locate code before opening files. Never print whole files or whole build logs (errors and the last ~30 lines only). Do not re-read files already read this session. Use targeted edits.
- Pick the simplest approach that meets the acceptance criteria. Compare at most two options. State a one-line assumption for ambiguity and continue. If the same fix fails twice, stop and report.
- Do not refactor unrelated code or add features outside the phase.
- Run only the tests relevant to the change while working; run the full build and tests once at the end of a phase.
- Every phase compiles/builds cleanly with no TODO stubs for core features. Deferred work goes in a "Known gaps" list.
- Before launching the GUI, state exactly what you need me to check. I will close it.
- Inside /TEMPORARY ASSETS/, all assets (icons, fonts) are there raw. Use those.
- At the end of a phase, run its verification commands, report (what changed, test results, startup log lines, known gaps), update the status in `PHASES.md`, then STOP. Do not start the next phase until confirmed.
