# Assemble a self-contained strata-core bundle for Windows packaging:
# SPDX-License-Identifier: GPL-3.0-only
#   dist/strata-core-bundle/
#     strata-core.exe   the real binary
#     Qt6*.dll, plugins/  deployed by windeployqt
#
# windeployqt resolves the Qt DLL/plugin closure for the binary, so no manual
# library list is needed. VC++ runtime DLLs are copied from the Qt install's
# bin directory when present.
param(
    [string]$CoreBin = "build\qt-release\cpp\app\strata-core.exe",
    [string]$OutDir = "dist\strata-core-bundle",
    [string]$WindeployQt = "",
    [string]$QtBin = ""
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$coreBinPath = Join-Path $root $CoreBin
if (-not (Test-Path $coreBinPath)) {
    Write-Error "strata-core binary not found at $coreBinPath - build it first (cmake --preset release)"
}

# --- locate windeployqt ------------------------------------------------------
if ($WindeployQt -eq "" -and $env:WINDEPLOYQT -ne "") { $WindeployQt = $env:WINDEPLOYQT }
if ($WindeployQt -eq "") {
    $cmd = Get-Command windeployqt.exe -ErrorAction SilentlyContinue
    if ($cmd) { $WindeployQt = $cmd.Source }
}
if ($WindeployQt -eq "" -and $QtBin -ne "") {
    $candidate = Join-Path $QtBin 'windeployqt.exe'
    if (Test-Path $candidate) { $WindeployQt = $candidate }
}
if ($WindeployQt -eq "") {
    # Common Qt install layouts (aqtinstall / aqt / installer).
    $roots = @("$env:USERPROFILE\Qt", 'C:\Qt', "$env:LOCALAPPDATA\Qt")
    foreach ($r in $roots) {
        if (Test-Path $r) {
            $found = Get-ChildItem -Path $r -Recurse -Filter 'windeployqt.exe' -ErrorAction SilentlyContinue |
                Select-Object -First 1
            if ($found) { $WindeployQt = $found.FullName; break }
        }
    }
}
if ($WindeployQt -eq "" -or -not (Test-Path $WindeployQt)) {
    Write-Error "windeployqt.exe not found - set WINDEPLOYQT or pass -WindeployQt"
}
if ($QtBin -eq "") { $QtBin = Split-Path -Parent $WindeployQt }

Remove-Item -Recurse -Force (Join-Path $root $OutDir) -ErrorAction SilentlyContinue
$bundle = Join-Path $root $OutDir
New-Item -ItemType Directory -Path $bundle | Out-Null

Copy-Item $coreBinPath (Join-Path $bundle 'strata-core.exe')

Push-Location $bundle
try {
    & $WindeployQt --release --no-translations --no-system-d3d-compiler .\strata-core.exe
    if ($LASTEXITCODE -ne 0) { Write-Error "windeployqt failed with exit code $LASTEXITCODE" }
} finally {
    Pop-Location
}

# VC++ runtime DLLs ship next to the Qt binaries on most Qt layouts.
foreach ($dll in 'vcruntime140.dll','vcruntime140_1.dll','msvcp140.dll','msvcp140_1.dll','msvcp140_2.dll','concrt140.dll') {
    $src = Join-Path $QtBin $dll
    if (Test-Path $src) { Copy-Item $src $bundle }
}

Write-Host "Bundle assembled at $bundle"
