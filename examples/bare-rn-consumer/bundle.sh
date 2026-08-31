#!/usr/bin/env bash
# R10.3 (#232) acceptance evidence: a headless Metro bundle for both native
# platforms (no simulator/device, no native compile — see README.md's
# "compile vs runtime evidence" note for why full android/ios native compile
# is a separate, heavier pass this starter's acceptance does not require).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${SCRIPT_DIR}/app"

test -d "${APP_DIR}" || { echo "app/ is missing; run setup.sh first." >&2; exit 1; }
cd "${APP_DIR}"
mkdir -p build

echo "==> Bundling bare React Native Android"
npx react-native bundle \
  --platform android \
  --dev false \
  --entry-file index.js \
  --bundle-output build/index.android.bundle \
  --assets-dest build/android-assets
test -s build/index.android.bundle

echo "==> Bundling bare React Native iOS"
npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output build/main.jsbundle \
  --assets-dest build/ios-assets
test -s build/main.jsbundle

echo "OK: both Android and iOS Metro bundles produced non-empty output."
