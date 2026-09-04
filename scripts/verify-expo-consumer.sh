#!/usr/bin/env bash
set -euo pipefail

# Independent, clean Expo SDK 57 consumer. It packs the real BeeUI packages,
# installs them into an isolated app and verifies the public package boundary.
ACTION="${1:-all}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_ROOT="${BEEUI_EXPO_CONSUMER_WORK_ROOT:-${BEEUI_IOS_CACHE_ROOT:-${HOME:-/tmp}/Library/Caches/BeeUI}/expo-consumer}"
APP_DIR="${WORK_ROOT}/app"
PACKAGE_DIR="${WORK_ROOT}/packages"
FINGERPRINT_FILE="${WORK_ROOT}/.beeui-expo-consumer-fingerprint"
EXPO_SDK_VERSION="${BEEUI_EXPO_SDK_VERSION:-57.0.15}"

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
  # Expo SDK 57's generated app/build.gradle starts `node` processes at
  # configuration time (resolveAppEntry plus require.resolve for react-native,
  # hermes-compiler, @react-native/codegen and @expo/cli), which Gradle 9.3.1's
  # configuration cache rejects outright. Keep this consumer on the task output
  # cache only; docs/rc-ci-matrix.md records the same rejection.
  gradle_args=(--no-daemon --stacktrace --no-configuration-cache)
  if is_truthy "${BEEUI_ANDROID_FRESH_BUILD:-}"; then
    gradle_args+=(--no-build-cache)
  else
    gradle_args+=(--build-cache)
  fi
  ./gradlew assembleDebug "${gradle_args[@]}"
  test -f app/build/outputs/apk/debug/app-debug.apk
}

build_ios() {
  test -d "${APP_DIR}" || { echo "Expo consumer is missing; run prepare first."; exit 1; }
  cd "${APP_DIR}"

  echo "::group::Expo prebuild (iOS)"
  EXPO_NO_GIT_STATUS=1 npx expo prebuild --clean --no-install --platform ios
  echo "::endgroup::"

  cd ios
  pod install

  local workspace scheme node_binary cache_root xcode_version safe_xcode_version pod_hash derived_data
  node_binary="$(command -v node)"
  test -n "${node_binary}"
  if [ -n "${NODE_VERSION:-}" ]; then
    test "$(node --version)" = "v${NODE_VERSION}"
  fi
  printf 'export NODE_BINARY="%s"\n' "${node_binary}" > .xcode.env.local

  workspace="$(find . -maxdepth 1 -type d -name '*.xcworkspace' -print -quit)"
  test -n "${workspace}" || { echo "No generated .xcworkspace found after pod install."; exit 1; }

  scheme="$({ xcodebuild -workspace "${workspace}" -list -json; } | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => (input += chunk));
    process.stdin.on("end", () => {
      const data = JSON.parse(input);
      const schemes = data.workspace?.schemes ?? [];
      if (!schemes.length) process.exit(2);
      process.stdout.write(schemes[0]);
    });
  ')"
  test -n "${scheme}" || { echo "No shared Xcode scheme found in ${workspace}."; exit 1; }

  cache_root="${BEEUI_IOS_CACHE_ROOT:-${HOME:-${RUNNER_TEMP:-/tmp}}/Library/Caches/BeeUI}"
  xcode_version="${BEEUI_XCODE_VERSION:-$(xcodebuild -version | awk 'NR == 1 { print $2 }')}"
  safe_xcode_version="$(printf '%s' "$xcode_version" | tr -cs '[:alnum:].-' '_')"
  test -f Podfile.lock
  pod_hash="$(shasum -a 256 Podfile.lock | awk '{ print $1 }')"
  derived_data="${cache_root}/DerivedData/expo-consumer/xcode-${safe_xcode_version}/pods-${pod_hash}"
  mkdir -p "$derived_data"
  echo "Using Expo consumer DerivedData: $derived_data"

  xcodebuild \
    -workspace "${workspace}" \
    -scheme "${scheme}" \
    -configuration Debug \
    -sdk iphonesimulator \
    -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath "$derived_data" \
    -showBuildTimingSummary \
    COMPILATION_CACHE_ENABLE_CACHING="${BEEUI_XCODE_COMPILATION_CACHE:-YES}" \
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
