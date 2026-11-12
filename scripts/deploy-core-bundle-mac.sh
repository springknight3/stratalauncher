#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-only
# Assemble a self-contained strata-core bundle for macOS packaging:
#   dist/strata-core-bundle/
#     strata-core       the real binary
#     Frameworks/       Qt frameworks deployed by macdeployqt
#     plugins/          Qt plugins deployed by macdeployqt
#
# macdeployqt rewrites the binary's @rpath entries and deploys the Qt
# framework/plugin closure, so the result runs without a system Qt install.
# MACDEPLOYQT may point at the tool explicitly.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORE_BIN="${1:-$ROOT/build/qt-release/cpp/app/strata-core}"
OUT="$ROOT/dist/strata-core-bundle"

if [[ ! -x "$CORE_BIN" ]]; then
  echo "strata-core binary not found at $CORE_BIN" >&2
  echo "Build it first: cmake --preset release && cmake --build --preset release" >&2
  exit 1
fi

rm -rf "$OUT"
mkdir -p "$OUT"
cp "$CORE_BIN" "$OUT/strata-core"
chmod 755 "$OUT/strata-core"

MDQ="${MACDEPLOYQT:-}"
if [[ -z "$MDQ" ]]; then
  # Search likely Qt install roots (aqtinstall layouts, ~/Qt, Homebrew).
  for base in "$HOME/Qt" /usr/local/Qt /opt/Qt /opt/homebrew/opt/qt*; do
    [[ -d "$base" ]] || continue
    MDQ="$(find "$base" -name macdeployqt -type f 2>/dev/null | head -1)"
    [[ -n "$MDQ" ]] && break
  done
fi
if [[ -z "$MDQ" || ! -x "$MDQ" ]]; then
  echo "macdeployqt not found - bundle will contain only the bare binary." >&2
  echo "Set MACDEPLOYQT=/path/to/macdeployqt and re-run." >&2
  exit 0
fi

"$MDQ" "$OUT/strata-core" -always-overwrite || {
  echo "macdeployqt reported errors; bundle may be incomplete." >&2
}

echo "Bundle assembled at $OUT"
