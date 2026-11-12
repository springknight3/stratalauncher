#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-only
# Assemble a self-contained strata-core bundle for packaging:
#   dist/strata-core-bundle/
#     strata-core        wrapper script (sets LD_LIBRARY_PATH, execs binary)
#     strata-core.bin    the real binary
#     qt.conf            points Qt at the bundled plugins dir
#     lib/               shared-library closure (Qt, OpenSSL, libarchive, ...)
#     plugins/           Qt TLS + networkinformation plugins
#
# glibc and the dynamic loader are intentionally NOT bundled — they must come
# from the host system. Everything else in the ldd closure is copied so the
# binary runs on hosts without Qt6/libarchive/qt6keychain installed.
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
mkdir -p "$OUT/lib" "$OUT/plugins"

# --- collect the shared-library closure -------------------------------------
# Seeds: the core binary, every .so in the Qt plugin dirs we ship, and
# libsecret (dlopen'ed by the credential store backend at runtime).
declare -A SEEN=()
LIBS=()

add_libs_of() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  while read -r _path_rest; do
    # ldd lines: "\tlibfoo.so => /path/libfoo.so.1 (0x...)" or "\t/lib/ld-linux.so (0x...)"
    local resolved
    resolved="$(echo "$_path_rest" | sed -n 's/.*=> \([^ ]*\).*/\1/p')"
    if [[ -z "$resolved" ]]; then
      resolved="$(echo "$_path_rest" | awk '{print $1}')"
    fi
    [[ -n "$resolved" && -f "$resolved" ]] || continue
    local base
    base="$(basename "$resolved")"
    # Skip the dynamic loader and glibc components — host must provide these.
    case "$base" in
      linux-vdso*|ld-linux*|ld-musl*|libc.so*|libm.so*|libpthread*|libdl.so*|\
      librt.so*|libresolv*|libnss_*|libanl*|libthread_db*|libutil*|libcrypt*|\
      libBrokenLocale*|libcidn*|libnsl*|libmemusage*|libpcprofile*|libSegFault*)
        continue
        ;;
    esac
    if [[ -z "${SEEN[$base]:-}" ]]; then
      SEEN[$base]=1
      LIBS+=("$resolved")
      # Recurse: the resolved lib may itself pull dlopen-adjacent deps we
      # still want in the closure (ldd already lists transitives, but seeds
      # added later — e.g. libsecret — need their own pass).
      add_libs_of "$resolved"
    fi
  done < <(ldd "$file" 2>/dev/null || true)
}

add_libs_of "$CORE_BIN"

# Discover Qt plugin roots: distro layouts plus aqtinstall/install-qt-action
# layouts (~/Qt/<ver>/<arch>/plugins) and /opt/Qt.
PLUGIN_SEARCH_ROOTS=(
  /usr/lib/qt6/plugins
  /usr/lib/x86_64-linux-gnu/qt6/plugins
  /usr/lib64/qt6/plugins
)
for base in "$HOME"/Qt/*/*/plugins /opt/Qt/*/*/plugins /usr/local/Qt/*/*/plugins; do
  [[ -d "$base" ]] && PLUGIN_SEARCH_ROOTS+=("$base")
done

for plugindir in "${PLUGIN_SEARCH_ROOTS[@]}"; do
  [[ -d "$plugindir" ]] || continue
  # Only ship plugin categories the headless core actually loads.
  for category in tls networkinformation; do
    srcdir="$plugindir/$category"
    [[ -d "$srcdir" ]] || continue
    for so in "$srcdir"/*.so; do
      [[ -f "$so" ]] || continue
      mkdir -p "$OUT/plugins/$category"
      cp -L "$so" "$OUT/plugins/$category/$(basename "$so")"
      add_libs_of "$so"
    done
  done
done

# libsecret is dlopen'ed by the Secret Service backend; seed it explicitly.
for candidate in /usr/lib/libsecret-1.so.0 /usr/lib/x86_64-linux-gnu/libsecret-1.so.0; do
  if [[ -f "$candidate" ]]; then
    add_libs_of "$candidate"
    break
  fi
done

for lib in "${LIBS[@]}"; do
  cp -L "$lib" "$OUT/lib/$(basename "$lib")"
done

cp "$CORE_BIN" "$OUT/strata-core.bin"
chmod 755 "$OUT/strata-core.bin"

cat > "$OUT/qt.conf" <<'EOF'
[Paths]
Plugins = plugins
EOF

cat > "$OUT/strata-core" <<'EOF'
#!/bin/sh
# StrataLauncher core wrapper: resolve bundled shared libraries, then exec.
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
export LD_LIBRARY_PATH="$DIR/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export QT_QPA_PLATFORM=offscreen
exec "$DIR/strata-core.bin" "$@"
EOF
chmod 755 "$OUT/strata-core"

echo "Bundle assembled at $OUT"
echo "  binary:  $OUT/strata-core"
echo "  libs:    $(ls "$OUT/lib" | wc -l) shared libraries"
echo "  plugins: $(find "$OUT/plugins" -name '*.so' | wc -l) Qt plugins"
