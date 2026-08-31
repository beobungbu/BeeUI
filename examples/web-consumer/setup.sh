#!/usr/bin/env bash
# R10.4 (#233) — installs this starter's own dependencies from freshly packed
# BeeUI tarballs (BeeUI is unpublished; see README.md and
# docs/decisions/011-distribution-architecture.md). Mirrors
# scripts/verify-web-consumer.sh's dependency pins so this starter matches the
# same tested Web support contract (docs/compatibility-matrix.md).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RUNTIME_DEPS=(
  react@19.2.3
  react-dom@19.2.3
  react-native@0.86.2
  react-native-web@0.21.0
  class-variance-authority@0.7.1
  react-native-safe-area-context@5.7.0
  react-native-teleport@1.1.13
  @react-native-community/datetimepicker@9.1.0
  @gorhom/bottom-sheet@5.2.14
  react-native-reanimated@4.5.1
  react-native-gesture-handler@2.32.0
  react-native-worklets@0.10.1
  tailwindcss@4.3.3
  uniwind@1.10.1
)

DEV_DEPS=(
  vite@8.2.2
  vite-plugin-rnw@0.0.12
  @tailwindcss/vite@4.3.3
  typescript@5.9.3
)

echo "==> Packing @beeui/core, @beeui/tokens, @beeui/ui through the package boundary"
eval "$(node ../scripts/pack-beeui-packages.mjs --out .beeui-tarballs --packages core,tokens,ui)"

echo "==> Installing BeeUI tarballs and Web runtime/tooling dependencies (npm, no monorepo/pnpm fallback)"
npm install --save-exact \
  "${CORE_TARBALL}" \
  "${TOKENS_TARBALL}" \
  "${UI_TARBALL}" \
  "${RUNTIME_DEPS[@]}"
npm install --save-exact -D "${DEV_DEPS[@]}"

if node -e "require.resolve('expo')" >/dev/null 2>&1; then
  echo "This Web consumer unexpectedly resolves the Expo runtime; it must stay independent of the Showcase's Expo path." >&2
  exit 1
fi

echo "==> Setup complete. Run: npm run build"
