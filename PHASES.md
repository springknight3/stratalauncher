# StrataLauncher: Migration Phases (Electron + React pivot)

Status legend: [ ] todo, [~] in progress, [x] done. One phase per session. Stop after each phase and report.
Java code is the parity reference. See `AGENTS.md` for all rules.

## Online Documentation

- Electron: https://www.electronjs.org/docs/latest/
- Vite: https://vite.dev/
- React & React Router: https://react.dev/ and https://reactrouter.com/
- Tailwind CSS: https://tailwindcss.com/docs
- beUI: https://beui.dev/
- Framer Motion: https://motion.dev/
- Anime.js: https://animejs.com/documentation/
- MiniSearch: https://lucaong.github.io/minisearch/
- Supabase (deferred module): https://supabase.com/docs
- Zustand: https://zustand.docs.pmnd.rs/
- Qt 6 Core & Network (backend only): https://doc.qt.io/qt-6/

## Dependency justifications
- QtKeychain: native secret storage for Microsoft and launcher tokens without exposing them in logs or config files (C++ core).
- libarchive: handles ZIP/TAR extraction for runtime and mod archives with path traversal and symlink checks (C++ core).
- zlib: required for NBT gzip compatibility and compressed binary blobs in the launcher data model (C++ core).
- Electron + Vite + React + Tailwind + beui.dev + Zustand + MiniSearch: the new desktop UI stack replacing Qt Quick; see AGENTS.md.
- Supabase (deferred, E8): optional cloud sync of config blobs; never required for parity.

## Completed milestones (Qt era)

The C++ core is feature-complete through the former M12: offline + Microsoft auth, Mojang manifest/download/install pipeline, game launch with readiness/crash tracking, Java runtime management (Mojang/Temurin/Zulu), loaders (Fabric/Quilt/Forge/NeoForge), Modrinth content management, per-instance settings (`options.txt`, `servers.dat`, NBT), and the server manager — all with passing Qt Test suites. The Qt Quick UI was built to parity but is now the **legacy fallback**, frozen under `cpp/legacy-qml/`. Former M13 packaging/CI work is superseded by the Electron packaging phase (E7); its verification, licensing, and parity-audit requirements are retained below.

Detailed Qt-era phase history remains in git history and `docs/legacy-java/PHASES-java.md` (Java) / `docs/PARITY.md`.

## Invariants carried into every phase

- Offline-first: the launcher must be fully usable with no network dependency beyond what the core already requires; Supabase (E8) is post-parity and optional.
- Parity: preserve user-visible behavior/text (hobby warning, installing screen strings, typed `DELETE`); record deviations in `docs/PARITY.md`.
- Security: tokens only via credential store / `safeStorage`; SHA verification on downloads; archive traversal rejection; `QProcess` argument lists; atomic config writes; no secrets or full launch args over IPC or in logs.
- Data: same data directories; `instance.json`, settings, `options.txt`, `servers.dat` formats stay compatible; stored tokens do not migrate.
- IPC: JSON-RPC 2.0 over loopback WebSocket per the contract in `AGENTS.md`; high-frequency events throttled to ~50–100 ms.
- Animation: Framer Motion for declarative UI motion, Anime.js for imperative timelines only (see `AGENTS.md` UI spec).

---

## E0: Pivot scaffold and IPC skeleton [x]

Files: `electron/` (new), `cpp/core/ipc/*`, `cpp/app/main.cpp`, `CMakeLists.txt`, `cpp/legacy-qml/` (moved QML UI), `package.json`, `electron.vite.config.*`, `tailwind.config.*`, `postcss.config.*`.

- Scaffold `electron/` with electron-vite: `main/`, `preload/`, `renderer/` (React + TypeScript), `shared/` IPC types.
- Install and verify baseline deps resolve: react, react-dom, react-router-dom, clsx, tailwind-merge, framer-motion, animejs, minisearch, zustand, @supabase/supabase-js (deferred import stub OK), Tailwind, beui.dev components, Vitest.
- Move `cpp/ui/` and the QML app files (`cpp/app/*.qml`, QML resources) to `cpp/legacy-qml/`; keep it building as fallback or exclude it from the default build with a documented CMake option — do not delete.
- `cpp/core/ipc/`: JSON-RPC 2.0 WebSocket server (`QWebSocketServer`, loopback only) + dispatcher skeleton; `strata-core serve --port 0 --token <t>` prints `STRATA_READY {"port":N,"token":"..."}` on stdout and serves a trivial `ping`/`shutdown` method.
- Renderer loads a placeholder page that calls `ping` through the contextBridge proxy end-to-end.

Acceptance: `cmake --preset debug && cmake --build --preset debug` and `ctest` pass; `cd electron && npm run dev` shows the placeholder calling `ping` through main → core → response; `npm test` passes a deps smoke test importing every baseline package.

## E1: IPC bridge and state stores [x]

Files: `cpp/core/ipc/*`, `electron/main/*`, `electron/preload/*`, `electron/shared/*`, `electron/renderer/src/stores/*`, `cpp/tests/*Ipc*`.

- Implement the full JSON-RPC method table mirroring the `LauncherController`/`ContentController`/`InstanceSettingsController` invokable surface (`instances.*`, `install.*`, `launch.*`, `accounts.*`, `auth.*`, `runtime.*`, `servers.*`, `content.*`, `settings.*`, `console.*`).
- Push events for every NOTIFY signal: `install.progress`, `console.line`, `runtime.progress`, `server.log`, `auth.deviceCode`, `instances.changed`, etc. Coalesce high-frequency events to ~50–100 ms; cache/diff large payloads.
- Electron main: spawn `strata-core serve`, parse `STRATA_READY`, own the WebSocket client, proxy requests/events to the renderer via `ipcMain`/`ipcRenderer`; preload exposes a typed `window.strata` API only (`contextIsolation`, `nodeIntegration: false`, `sandbox: true`).
- Renderer: typed IPC client + Zustand store per domain; subscribe/unsubscribe lifecycle; reconnect handling.
- Tests: Qt Test for dispatcher (method routing, error codes, throttling); Vitest for store updates from mocked events.

Acceptance: every controller method reachable over IPC; progress/console events arrive throttled; no token/credential/launch-arg data in any event or log; core tests + renderer tests pass.

## E2: App shell, theme, startup [ ]

Files: `electron/renderer/src/{App,routes,components,theme}/*`, `electron/main/*` (window creation).

- React Router shell: Home, Instances, Servers, Settings, About, Content pages (placeholders OK).
- Tailwind theme tokens (central radius token, dark/light via CSS variables + `.dark` class); toggle persisted through IPC `ThemeSettings`; system-preference default.
- beui.dev primitives for buttons/inputs/switches; icon components wrapping existing SVG pairs (`*-dark`/`*-light`).
- Startup sequence: logo, hobby warning, copyright — minimum 3 s, longer while init runs; animejs timeline for orchestration; all refreshes begin only after window + animation visible.
- Page transitions: crossfade + slight horizontal translation, staggered element fade/move; tab indicator shared `layoutId`; reduce-motion respected.
- Hobby warning text and About copyright preserved verbatim.

Acceptance: dark/light toggle persists across restarts; startup animation honors minimum duration and reduce-motion; navigation animates per spec; `npm run dev` GUI check requested before continuing.

## E3: Instances, install, launch, console [x]

Files: `electron/renderer/src/{pages/Instances,components/{InstanceCard,InstallView,ConsolePanel,StatusLight}}/*`, stores.

- Instances list with cards, hover physics, recent-launch tracking.
- Create-instance flow: version + loader selection, real install progress ("Installing <name>..." / progress bar / "Downloading: <item>" parity strings), error surfacing.
- Launch/stop controls; status light driven by `launch.status` events (grey → blue → green on readiness signal → red on crash; never a timer).
- Live console panel: fade+slide in, virtualized line list, batched appends, autoscroll; instance selector.
- Typed `DELETE` confirmation for instance deletion.

Acceptance: can create, launch, and stop a vanilla instance end-to-end through the React UI; console streams without UI jank; status light transitions verified in GUI check.

## E4: Flyouts — accounts and instance settings [x]

Files: `electron/renderer/src/components/flyouts/*`, stores, `cpp/core/ipc` (if gaps found).

- Accounts flyout: offline + Microsoft device-code sign-in (code/URL surfaced via `auth.deviceCode` events), multi-account list, active selection, typed `DELETE` removal.
- Instance settings flyout: game options (`options.txt`), Java args, runtime selection, loader display — edits flow through IPC to the core's atomic writers.
- Flyouts built once, slide+fade in/out; keyboard/accessibility pass.

Acceptance: sign-in, account switching, and per-instance settings edits persist and survive restart; GUI check requested.

## E5: Runtimes, servers, content [x]

Files: `electron/renderer/src/pages/{Servers,Content}/*`, `components/SettingsDialog.tsx`, `lib/{launcher,content}.ts`, stores.

- `lib/launcher.ts` extended: `servers`, `installedRuntimes`, runtime preferences, global/recommended Java flags, track-launches, server content/status fields.
- `lib/content.ts` + `stores/content.ts`: typed `content.state` snapshot (projects, versions, installed, worlds, pagination, dependencies).
- ServersPage: server list + create dialog (name/version/distribution), detail tabs (Overview settings + server.properties editor / Console with Start-Stop-Terminate + command input / Content Modrinth search for Paper+Fabric / Dangerous repair + typed-DELETE delete), EULA accept flow, typed DELETE confirmation, busy/progress display.
- ContentPage: instance + content-type + world selectors, Modrinth search with pagination, project→version pick, install, installed-content enable/disable/delete, dependency confirmation dialog.
- SettingsDialog: General tab (appearance, diagnostics, track launches, Azure client ID, global Java flags with recommended preset) + Runtime Manager tab (vendor, redundant runtimes, install progress, inventory, reviewed deletion with in-use protection).
- MiniSearch indexes deferred to E6 (lists are small enough for now).
- Fixes: `launcher.refresh` now runs on connect (versions/instances/servers/runtimes populate at startup); beUI Select replaced by searchable `VersionPicker` for large lists (MC/loader versions froze the renderer); center-morph modal focus effect stabilized (typing no longer jumps focus to Close).
- Data directory setting (Settings → General → Data): presets `~/.local/share/StrataLauncher` (default), `~/.stratalauncher`, `~/.minecraft`, or custom path; persisted client-side, applied via `strata-core serve --data-dir` + core respawn (`Paths::setDataDirectoryOverride`).
- Instance creation options: Allocated RAM range slider (1 GB – 75% of system RAM via `strata:getSystemMemoryMb`), Launch-after-Install checkbox, Use Managed Java, Auto-Add Performance Mods (Fabric API, Sodium, EntityCulling, ModMenu + missing deps via `ContentController::installPerformanceMods`). New optional params on `install.instanceWithLoader` (`allocatedMemoryMb`, `launchAfterInstall`, `useManagedJava`, `autoPerformanceMods`) applied post-install in `LauncherController` (RAM → instance Java-flags override derived from global flags; managed Java → `installInstanceRuntime`; launch → `launchInstance`).
- Import dialog (Instances → Import): `import.scan`/`import.instance` IPC + `instance/InstanceImporter` scanning Official launcher (`launcher_profiles.json`), PrismLauncher + SKLauncher (MultiMC `instance.cfg`/`mmc-pack.json`), CurseForge app (`minecraftinstance.json`), Modrinth app (`.mrpack` via libarchive `modrinth.index.json`; files downloaded through `DownloadManager`, loader installed via `LoaderInstaller`). `InstanceManager::import` copies foreign game dirs.
- Instance settings flyout: FOV/gamma `RangeSlider`, render/simulation distance + max FPS + GUI scale `AdaptiveStepper`, Unlimited `Switch`, VSync/fullscreen square checkboxes, Advanced behind "Show Advanced" checkbox, Save action-swap (Save Changes → Saving... → Saved + toast), unsaved-changes exit blocked with "You need to save your changes first!" toast (same for Controls save), Java tab managed-Java checkbox + System-Java hover overflow fix.
- Content page: beUI `Pagination` replaces ‹ › buttons. Server content tab rebuilt as two-pane project/version layout matching Content page; console fills remaining panel height; Start/Stop/Terminate are icon-only (`play_arrow`/`stop`/`bolt`).
- Launcher Settings + About open as flyouts over the current screen (uiStore flags, no route switch); Runtime Manager refresh button moved into tab body. `launcher.refresh` now also loads servers (was the servers-not-refreshing bug).
- Global themed scrollbars (thin, theme-token thumb) in `index.css`.

Acceptance: runtime install + server create/start/stop + content install all work through React UI; GUI check requested.

## E6: Polish, remaining UI, search [~]

Files: `electron/renderer/src/**`, `electron/renderer/src/search/*`.

- Launcher settings page (global Java args, launch tracking, theme, reduce motion), About page with hobby warning + copyright.
- MiniSearch: unified index over versions, instances, runtimes, servers, content projects, settings keys; debounced re-index on `*.changed` events; search UI in relevant pages.
- Motion polish pass: hover states, toasts (bottom-center, pulse on warn/error), focus states, accessibility (keyboard nav, ARIA), frame-time debug overlay.
- Full parity sweep against `docs/PARITY.md` UI rows.
- [11/11/26 UPDATE] Modify the initialization screen to include a beUI loader - one of Spinner, Dots, Dot Matrix, ASCII. Match all loaders with this one.
- StartupOverlay now shows the beUI `Loader` (`dot-matrix`); InstallOverlay matched to the same variant — all loaders unified.
- MiniSearch unified index (`lib/search.ts`): static commands + settings keys + live instances, servers, versions (capped per type), runtimes, Modrinth projects + installed content, accounts. Debounced (~200 ms) rebuild on snapshot changes; `searchDocuments` forces a synchronous rebuild when a rebuild is pending so results are never stale. Wired into the command palette via a new `searchResults` prop on `CommandPalette` — typing in Ctrl+K now returns grouped domain results; selecting an instance/server deep-links and selects it on the target page (`uiStore.focusInstanceId`/`focusServerId`), versions open Create instance, runtimes/settings keys open the Settings flyout on the right tab (`uiStore.settingsTab`), content/accounts act accordingly. "Import instance" added as a palette action.
- Motion/a11y polish: error toasts pulse gently (scale-only, reduced-motion aware); global `:focus-visible` ring using the `--ring` token (inputs/selects keep their own beUI focus styles); frame-time debug overlay already gated behind Settings → diagnostics.
- `docs/PARITY.md` sweep: UI rows repointed from QML paths to their React equivalents; runtime/server-content/bootstrap rows marked done.

Acceptance: all pages functional; search returns relevant results; `npm test` + core `ctest` green.

## E7: Packaging, CI, parity audit [~]

Adapted from former M13 — same verification rigor, Electron artifacts:

- electron-builder (or equivalent) packages renderer + bundled `strata-core` binary per platform: Linux AppImage + tarball, macOS `.app`/dmg, Windows installer. Core binary must be spawned from resources path; `STRATA_READY` handshake verified in packaged builds.
- CI: `verify.yml`-style workflow building core (cmake presets) + renderer (npm ci/build) + packaging matrix; smoke-launch check headless where possible.
- Licensing: GPL-3.0 `LICENSE`, `LICENSES/`, `THIRD_PARTY_NOTICES` shipped in every artifact; SPDX headers; **add npm dependency license audit** to THIRD_PARTY_NOTICES; corresponding-source archive on release; Qt LGPL notices only where Qt libs still ship (core links Qt dynamically — keep replaceable).
- Remote verification via `gh` follows the former M13 rules (full text in git history): dispatch `verify.yml` with `platform=all`, watch runs, download artifacts locally; on failure read `--log-failed`, fix, re-dispatch (stop after 5 attempts on the same error). Forbidden without explicit maintainer approval: pushing tags, creating/editing releases, force-pushing, pushing to the default branch, changing repo secrets/settings, running `release.yml` against a real tag. If `gh auth status` fails or push is rejected, mark dependent platforms UNVERIFIED/UNBUILT and stop.
- Final parity audit: `docs/PARITY.md` line-by-line; Missing items block completion.
- README: build/run/package instructions for both stacks, license section, known limitations (native file dialogs, unsigned binaries).
- Decide Qt fallback fate: keep `cpp/legacy-qml/` buildable or remove — record decision in PARITY.md.

Acceptance: artifacts build locally and in CI; smoke tests pass; parity audit resolved; Windows manual test checklist updated for the Electron app.

## E8 (DEFERRED, post-parity): Supabase cloud sync [ ]

Do not start until E7 parity audit passes.

- Auth: `@supabase/supabase-js` in renderer/main with session persisted via Electron `safeStorage` (never `localStorage`); separate from Mojang/Microsoft game auth in the core.
- Schema: `profiles`, `instances` (config JSONB), `flag_presets`, `sync_meta`; RLS `owner_id = auth.uid()`; service key never ships.
- Sync: config blobs only (instance.json, settings, JVM flag presets) — never game files; local disk source of truth; last-write-wins + `updated_at`.
- MiniSearch indexes union of local manifests + synced profiles.

---

## Verification rules (all phases)

- Core: `cmake --preset debug && cmake --build --preset debug && ctest --preset debug --output-on-failure` (ASan+UBSan clean).
- UI: `cd electron && npm run build && npm test`.
- GUI: state exactly what to check before launching; user verifies and closes.
- Phase end: run verification, report changes/test results/startup logs/known gaps, update this file's status, STOP.
