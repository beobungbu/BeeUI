#!/usr/bin/env bash
# R10.3 (#232) — scaffolds a true bare React Native app (via the official
# @react-native-community/cli, same as `npx react-native init`) into ./app,
# overlays this starter's committed App/index/metro/global.css source, then
# installs BeeUI through freshly packed tarballs plus the pinned native peers
# BeeUI declares. Mirrors scripts/verify-bare-consumer.sh's dependency pins
# and native-peer set so this starter matches the same tested compatibility
# row (docs/compatibility-matrix.md).
#
# ./app is generated, not committed (see README.md for why): it contains the
# full native android/ios projects, which are mechanically reproducible from
# the pinned CLI/RN version plus the checked-in src-overrides/ here.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

APP_DIR="${SCRIPT_DIR}/app"
CLI_VERSION="${BEEUI_RN_CLI_VERSION:-20.2.0}"
RN_VERSION="${BEEUI_RN_VERSION:-0.86.2}"

# Same optional-native-peer set scripts/verify-bare-consumer.sh installs:
# uniwind/tailwindcss for styling, react-native-safe-area-context +
# react-native-teleport for the overlay runtime/app-root provider,
# @react-native-community/datetimepicker for DatePicker/DateTimePicker's
# native file, and @gorhom/bottom-sheet + its Reanimated/Gesture-Handler/
# Worklets peers for Sheet's native adapter (ADR-006).
PINNED_DEPS=(
  uniwind@1.10.1
  tailwindcss@4.3.3
  react-native-safe-area-context@5.7.0
  react-native-teleport@1.1.13
  @react-native-community/datetimepicker@9.1.0
  @gorhom/bottom-sheet@5.2.14
  react-native-reanimated@4.5.1
  react-native-gesture-handler@2.32.0
  react-native-worklets@0.10.1
  react-dom@19.2.3
)

echo "==> Scaffolding a fresh bare React Native ${RN_VERSION} app (CLI ${CLI_VERSION})"
rm -rf "${APP_DIR}"
npx --yes "@react-native-community/cli@${CLI_VERSION}" init BeeUIBareConsumer \
  --version "${RN_VERSION}" \
  --directory "${APP_DIR}" \
  --pm npm \
  --install-pods false \
  --skip-git-init true

echo "==> Overlaying this starter's committed App/index/metro/global.css source"
cp src-overrides/App.tsx "${APP_DIR}/App.tsx"
cp src-overrides/index.js "${APP_DIR}/index.js"
cp src-overrides/metro.config.js "${APP_DIR}/metro.config.js"
cp src-overrides/global.css "${APP_DIR}/global.css"

echo "==> Packing @beemvp/beeui-core, @beemvp/beeui-tokens, @beemvp/beeui-ui through the package boundary"
eval "$(node ../scripts/pack-beeui-packages.mjs --out .beeui-tarballs --packages core,tokens,ui)"

cd "${APP_DIR}"
echo "==> Installing BeeUI tarballs and pinned native peers (npm, no monorepo/pnpm fallback)"
npm install --save-exact \
  "${CORE_TARBALL}" \
  "${TOKENS_TARBALL}" \
  "${UI_TARBALL}" \
  "${PINNED_DEPS[@]}"

if node -e "require.resolve('expo')" >/dev/null 2>&1; then
  echo "This bare RN consumer unexpectedly resolves the Expo runtime." >&2
  exit 1
fi

echo "==> Setup complete. Run: bash bundle.sh"
