#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-only
# Package the Electron client + bundled strata-core with electron-builder.
#
#   ./scripts/package-electron.sh [extra electron-builder args]
#
# Steps: build strata-core (release preset, incremental) -> assemble the
# self-contained core bundle (shared libs + Qt plugins) -> build the renderer
# -> run electron-builder for the host platform.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORE_BIN="$ROOT/build/qt-release/cpp/app/strata-core"

echo "==> Building strata-core (release)"
cmake --build --preset release --target strata-core -j"$(nproc)"

echo "==> Assembling core bundle"
"$ROOT/scripts/deploy-core-bundle.sh" "$CORE_BIN"

echo "==> Building Electron app"
cd "$ROOT/electron"
npm run build

echo "==> electron-builder"
npx electron-builder "$@"
