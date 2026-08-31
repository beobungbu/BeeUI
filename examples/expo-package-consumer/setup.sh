#!/usr/bin/env bash
# R10.1 (#230) — installs this starter's own dependencies from freshly packed
# BeeUI tarballs (BeeUI is unpublished; see README.md). Pins match
# apps/showcase's tested Expo SDK 57 dependency set (docs/compatibility-matrix.md).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RUNTIME_DEPS=(
  expo@~57.0.0
  @expo/metro-runtime@~57.0.12
  react@19.2.3
  react-dom@19.2.3
  react-native@0.86.2
  react-native-web@0.21.0
  react-native-safe-area-context@~5.7.0
  react-native-teleport@~1.1.13
  @react-native-community/datetimepicker@~9.1.0
  @gorhom/bottom-sheet@~5.2.14
  react-native-reanimated@~4.5.1
  react-native-gesture-handler@~2.32.0
  react-native-worklets@~0.10.1
  tailwindcss@4.3.3
  uniwind@1.10.1
)

echo "==> Packing @beemvp/beeui-core, @beemvp/beeui-tokens, @beemvp/beeui-ui through the package boundary"
eval "$(node ../scripts/pack-beeui-packages.mjs --out .beeui-tarballs --packages core,tokens,ui)"

echo "==> Installing BeeUI tarballs and Expo SDK 57 runtime dependencies (npm, no monorepo/pnpm fallback)"
npm install --save-exact \
  "${CORE_TARBALL}" \
  "${TOKENS_TARBALL}" \
  "${UI_TARBALL}" \
  "${RUNTIME_DEPS[@]}"

echo "==> Setup complete. Run: bash bundle.sh"
