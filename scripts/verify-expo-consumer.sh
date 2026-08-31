#!/usr/bin/env bash
set -euo pipefail

# #204 (R7.8, parent #114): the independent, clean Expo SDK 57 consumer.
# Mirrors scripts/verify-bare-consumer.sh's and scripts/verify-web-consumer.sh's
# structure and rigor (pack real tarballs, install into an isolated app with
# no monorepo/workspace fallback) but for the Expo/Metro path — ADR-011 D7 and
# docs/decisions/011-distribution-architecture.md list Expo as one of the
# three required clean-consumer rows alongside bare React Native and Web.
#
# Unlike apps/showcase (which is workspace-linked, `@beemvp/beeui-ui: workspace:*`,
# and deliberately reorders Metro's resolver conditions to resolve `src/`
# directly — see its own metro.config.js comment), this app installs the
# packed @beemvp/beeui-core/@beemvp/beeui-tokens/@beemvp/beeui-ui tarballs like a real npm
# consumer and never touches `unstable_conditionsByPlatform`, so Metro
# resolves the packaged `dist/` output through its ordinary `react-native`/
# `browser`/`default` conditions — the real, unmodified consumer contract.

ACTION="${1:-all}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# WORK_ROOT must survive across CI jobs for the same reason
# verify-bare-consumer.sh's does: GitHub Actions empties RUNNER_TEMP at the
# start of every job.
WORK_ROOT="${BEEUI_EXPO_CONSUMER_WORK_ROOT:-${BEEUI_IOS_CACHE_ROOT:-${HOME:-/tmp}/Library/Caches/BeeUI}/expo-consumer}"
APP_DIR="${WORK_ROOT}/app"
PACKAGE_DIR="${WORK_ROOT}/packages"
FINGERPRINT_FILE="${WORK_ROOT}/.beeui-expo-consumer-fingerprint"
EXPO_SDK_VERSION="${BEEUI_EXPO_SDK_VERSION:-57.0.15}"

# Exact versions this repo has actually tested elsewhere
# (docs/compatibility-matrix.md, apps/showcase/package.json), reused here so
# this row's claims stay pinned to the same evidence rather than drifting to
# whatever `npm install` resolves.
RUNTIME_DEPS=(
  expo@${EXPO_SDK_VERSION}
  @expo/metro-runtime@57.0.12
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

DEV_DEPS=(typescript@5.9.3)

is_truthy() {
  case "${1:-}" in
    1|[Tt][Rr][Uu][Ee]|[Yy][Ee][Ss]) return 0 ;;
    *) return 1 ;;
  esac
}

compute_fingerprint() {
  {
    printf '%s\n' "${EXPO_SDK_VERSION}"
    printf '%s\n' "${RUNTIME_DEPS[@]}"
    printf '%s\n' "${DEV_DEPS[@]}"
  } | shasum -a 256 | awk '{ print $1 }'
}

pack_beeui() {
  echo "::group::Pack BeeUI packages through the package boundary"
  rm -rf "${PACKAGE_DIR}"
  mkdir -p "${PACKAGE_DIR}"

  cd "${ROOT_DIR}"
  pnpm --filter @beemvp/beeui-core pack --pack-destination "${PACKAGE_DIR}"
  pnpm --filter @beemvp/beeui-tokens pack --pack-destination "${PACKAGE_DIR}"
  pnpm --filter @beemvp/beeui-ui pack --pack-destination "${PACKAGE_DIR}"

  CORE_TARBALL="$(find "${PACKAGE_DIR}" -maxdepth 1 -type f -name 'beemvp-beeui-core-*.tgz' -print -quit)"
  TOKENS_TARBALL="$(find "${PACKAGE_DIR}" -maxdepth 1 -type f -name 'beemvp-beeui-tokens-*.tgz' -print -quit)"
  UI_TARBALL="$(find "${PACKAGE_DIR}" -maxdepth 1 -type f -name 'beemvp-beeui-ui-*.tgz' -print -quit)"

  test -n "${CORE_TARBALL}" && test -f "${CORE_TARBALL}"
  test -n "${TOKENS_TARBALL}" && test -f "${TOKENS_TARBALL}"
  test -n "${UI_TARBALL}" && test -f "${UI_TARBALL}"
  echo "::endgroup::"
}

write_app_sources() {
  mkdir -p "${APP_DIR}"
  cd "${APP_DIR}"

  cat > app.json <<'EOF'
{
  "expo": {
    "name": "BeeUI Expo consumer smoke",
    "slug": "beeui-expo-consumer-smoke",
    "version": "0.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "bundleIdentifier": "com.beeui.expoconsumersmoke",
      "supportsTablet": true
    },
    "android": {
      "package": "com.beeui.expoconsumersmoke",
      "edgeToEdgeEnabled": true
    },
    "web": {
      "bundler": "metro"
    }
  }
}
EOF

  cat > index.js <<'EOF'
import '@expo/metro-runtime';
import { registerRootComponent } from 'expo';

import App from './App';

registerRootComponent(App);
EOF

  # Deliberately does NOT reorder `unstable_conditionsByPlatform` the way
  # apps/showcase's metro.config.js does — that override exists only so the
  # *workspace-linked* Showcase can resolve `@beemvp/beeui-*` straight from `src/`
  # without a build step. This is a clean consumer of the packed tarballs, so
  # Metro must resolve through the ordinary `react-native`/`browser`/
  # `default` conditions straight to the packaged `dist/` output.
  cat > metro.config.js <<'EOF'
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = withUniwindConfig(getDefaultConfig(__dirname), {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
});

if (!config.resolver.platforms.includes('web')) {
  config.resolver.platforms = [...config.resolver.platforms, 'web'];
}

module.exports = config;
EOF

  cat > global.css <<'EOF'
@import 'tailwindcss';
@import 'uniwind';
@import '@beemvp/beeui-tokens/theme.css';

@source '../node_modules/@beemvp/beeui-core/src';
@source '../node_modules/@beemvp/beeui-ui/src';
EOF

  cat > tsconfig.json <<'EOF'
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true
  },
  "include": ["**/*.ts", "**/*.tsx"]
}
EOF

  # Barrel plus a granular per-component subpath import (#204, ADR-012,
  # docs/decisions/012-granular-subpath-exports.md) — proves both resolve and
  # compile from the packed tarball under Expo/Metro, matching the same proof
  # already carried by scripts/verify-bare-consumer.sh and
  # scripts/verify-web-consumer.sh.
  cat > App.tsx <<'EOF'
import './global.css';

import {
  BeeUIProvider,
  Button,
  Card,
  Checkbox,
  Chip,
  ChipGroup,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
  Input,
  SafeArea,
  Screen,
  Text,
} from '@beemvp/beeui-ui';
import { Badge } from '@beemvp/beeui-ui/badge';
import * as React from 'react';
import { ScrollView } from 'react-native';

export default function App() {
  const [checked, setChecked] = React.useState(false);
  const [filter, setFilter] = React.useState('all');

  return (
    <BeeUIProvider>
      <Screen>
        <SafeArea edges={['top', 'left', 'right']} className="flex-1">
          <ScrollView contentContainerStyle={{ padding: 24 }}>
            <Card className="gap-4">
              <Text variant="title">BeeUI Expo consumer smoke</Text>
              <Badge>Granular subpath: @beemvp/beeui-ui/badge</Badge>
              <Input accessibilityLabel="Project name" placeholder="Project name" />
              <Checkbox checked={checked} label="Enable notifications" onCheckedChange={setChecked} />
              <ChipGroup onValueChange={(value) => setFilter(String(value))} value={filter}>
                <Chip value="all">All</Chip>
                <Chip value="active">Active</Chip>
              </ChipGroup>
              <Dialog>
                <DialogTrigger>Open dialog</DialogTrigger>
                <DialogContent>
                  <DialogTitle>Expo consumer dialog</DialogTitle>
                  <DialogDescription>Provider/theme, forms, and overlays from the packed tarballs.</DialogDescription>
                  <DialogFooter>
                    <DialogClose variant="outline">Close</DialogClose>
                    <Button>Save</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </Card>
          </ScrollView>
        </SafeArea>
      </Screen>
    </BeeUIProvider>
  );
}
EOF
}

prepare_consumer() {
  local fingerprint existing_fingerprint need_clean=0
  fingerprint="$(compute_fingerprint)"

  if is_truthy "${BEEUI_EXPO_CONSUMER_CLEAN:-}"; then
    need_clean=1
  elif [ ! -d "${APP_DIR}" ]; then
    need_clean=1
  else
    existing_fingerprint="$(cat "${FINGERPRINT_FILE}" 2>/dev/null || true)"
    if [ "${existing_fingerprint}" != "${fingerprint}" ]; then
      need_clean=1
    fi
  fi

  pack_beeui

  if [ "${need_clean}" -eq 1 ]; then
    echo "::group::Create fresh independent Expo SDK 57 consumer"
    rm -rf "${APP_DIR}"
    mkdir -p "${APP_DIR}"

    cat > "${APP_DIR}/package.json" <<'EOF'
{
  "name": "beeui-expo-consumer-smoke",
  "private": true,
  "version": "0.0.0",
  "main": "index.js"
}
EOF

    write_app_sources

    cd "${APP_DIR}"
    echo "::group::Install BeeUI tarballs and Expo runtime dependencies"
    npm install --save-exact --legacy-peer-deps \
      "${CORE_TARBALL}" \
      "${TOKENS_TARBALL}" \
      "${UI_TARBALL}" \
      "${RUNTIME_DEPS[@]}"
    npm install --save-exact --legacy-peer-deps -D "${DEV_DEPS[@]}"
    echo "::endgroup::"

    printf '%s' "${fingerprint}" > "${FINGERPRINT_FILE}"
    echo "::endgroup::"
  else
    echo "Reusing existing Expo consumer at ${APP_DIR} (environment fingerprint unchanged)"
    write_app_sources
    cd "${APP_DIR}"

    echo "::group::Reinstall BeeUI tarballs into existing consumer"
    rm -rf node_modules/@beemvp
    npm install --save-exact --legacy-peer-deps \
      "${CORE_TARBALL}" \
      "${TOKENS_TARBALL}" \
      "${UI_TARBALL}"
    echo "::endgroup::"
  fi
}

typecheck_consumer() {
  test -d "${APP_DIR}" || { echo "Expo consumer is missing; run prepare first."; exit 1; }
  cd "${APP_DIR}"
  npx tsc --noEmit
}

bundle_consumer() {
  test -d "${APP_DIR}" || { echo "Expo consumer is missing; run prepare first."; exit 1; }
  cd "${APP_DIR}"

  echo "::group::Export Expo consumer for Web"
  npx expo export --platform web --output-dir dist-web
  test -d dist-web
  echo "::endgroup::"

  echo "::group::Export Expo consumer for Android"
  npx expo export --platform android --output-dir dist-android
  test -d dist-android
  echo "::endgroup::"

  echo "::group::Export Expo consumer for iOS"
  npx expo export --platform ios --output-dir dist-ios
  test -d dist-ios
  echo "::endgroup::"
}

build_android() {
  test -d "${APP_DIR}" || { echo "Expo consumer is missing; run prepare first."; exit 1; }
  cd "${APP_DIR}"

  echo "::group::Expo prebuild (Android)"
  EXPO_NO_GIT_STATUS=1 npx expo prebuild --clean --no-install --platform android
  echo "::endgroup::"

  cd android
  ./gradlew assembleDebug --no-daemon --build-cache --configuration-cache --stacktrace
  test -f app/build/outputs/apk/debug/app-debug.apk
}

build_ios() {
  test -d "${APP_DIR}" || { echo "Expo consumer is missing; run prepare first."; exit 1; }
  cd "${APP_DIR}"

  echo "::group::Expo prebuild (iOS)"
  EXPO_NO_GIT_STATUS=1 npx expo prebuild --clean --no-install --platform ios
  echo "::endgroup::"

  cd ios
  bundle install
  bundle exec pod install

  local workspace scheme
  workspace="$(find . -maxdepth 1 -type d -name '*.xcworkspace' -print -quit)"
  test -n "${workspace}" || { echo "No generated .xcworkspace found after pod install."; exit 1; }
  scheme="beeuiexpoconsumersmoke"

  xcodebuild \
    -workspace "${workspace}" \
    -scheme "${scheme}" \
    -configuration Debug \
    -sdk iphonesimulator \
    -destination 'generic/platform=iOS Simulator' \
    -showBuildTimingSummary \
    CODE_SIGNING_ALLOWED=NO \
    build
}

case "${ACTION}" in
  prepare)
    prepare_consumer
    ;;
  typecheck)
    typecheck_consumer
    ;;
  bundle)
    bundle_consumer
    ;;
  android-build)
    build_android
    ;;
  ios-build)
    build_ios
    ;;
  all)
    prepare_consumer
    typecheck_consumer
    bundle_consumer
    ;;
  *)
    echo "Unknown action: ${ACTION}. Expected prepare, typecheck, bundle, android-build, ios-build, or all."
    exit 2
    ;;
esac
