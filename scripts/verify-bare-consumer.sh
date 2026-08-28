#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-all}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# WORK_ROOT must survive across CI jobs for the R1 reuse path to hit: the
# GitHub Actions runner empties RUNNER_TEMP at the start of every job, so the
# reusable bare app lives under the persistent iOS cache root instead (the
# same location family as the DerivedData caches derived below). Fall back to
# the same HOME path the ios-build step uses, then to /tmp for throwaway runs.
WORK_ROOT="${BEEUI_BARE_WORK_ROOT:-${BEEUI_IOS_CACHE_ROOT:-${HOME:-/tmp}/Library/Caches/BeeUI}/bare-consumer}"
APP_DIR="${WORK_ROOT}/BeeUIBareSmoke"
PACKAGE_DIR="${WORK_ROOT}/packages"
FINGERPRINT_FILE="${WORK_ROOT}/.beeui-bare-fingerprint"
CLI_VERSION="${BEEUI_RN_CLI_VERSION:-20.2.0}"
RN_VERSION="${BEEUI_RN_VERSION:-0.86.2}"

# @beeui/ui peers on react-native-teleport for its native context-preserving
# overlay host; teleport in turn peers on react-dom, so pin react-dom to the
# app's react version to keep strict peer resolution clean.
PINNED_DEPS=(
  uniwind@1.10.1
  tailwindcss@4.3.3
  react-native-safe-area-context@5.7.0
  react-native-teleport@1.1.13
  react-dom@19.2.3
)

is_truthy() {
  case "${1:-}" in
    1|[Tt][Rr][Uu][Ee]|[Yy][Ee][Ss]) return 0 ;;
    *) return 1 ;;
  esac
}

compute_bare_fingerprint() {
  {
    printf '%s\n' "${CLI_VERSION}" "${RN_VERSION}"
    printf '%s\n' "${PINNED_DEPS[@]}"
  } | shasum -a 256 | awk '{ print $1 }'
}

pack_beeui() {
  echo "::group::Pack BeeUI packages through the package boundary"
  rm -rf "${PACKAGE_DIR}"
  mkdir -p "${PACKAGE_DIR}"

  cd "${ROOT_DIR}"
  pnpm --filter @beeui/core pack --pack-destination "${PACKAGE_DIR}"
  pnpm --filter @beeui/tokens pack --pack-destination "${PACKAGE_DIR}"
  pnpm --filter @beeui/ui pack --pack-destination "${PACKAGE_DIR}"

  CORE_TARBALL="$(find "${PACKAGE_DIR}" -maxdepth 1 -type f -name 'beeui-core-*.tgz' -print -quit)"
  TOKENS_TARBALL="$(find "${PACKAGE_DIR}" -maxdepth 1 -type f -name 'beeui-tokens-*.tgz' -print -quit)"
  UI_TARBALL="$(find "${PACKAGE_DIR}" -maxdepth 1 -type f -name 'beeui-ui-*.tgz' -print -quit)"

  test -n "${CORE_TARBALL}" && test -f "${CORE_TARBALL}"
  test -n "${TOKENS_TARBALL}" && test -f "${TOKENS_TARBALL}"
  test -n "${UI_TARBALL}" && test -f "${UI_TARBALL}"
  echo "::endgroup::"
}

prepare_consumer() {
  local fingerprint existing_fingerprint need_clean=0
  fingerprint="$(compute_bare_fingerprint)"

  if is_truthy "${BEEUI_BARE_CLEAN:-}"; then
    need_clean=1
  elif [ ! -d "${APP_DIR}" ]; then
    need_clean=1
  else
    existing_fingerprint="$(cat "${FINGERPRINT_FILE}" 2>/dev/null || true)"
    if [ "${existing_fingerprint}" != "${fingerprint}" ]; then
      need_clean=1
    fi
  fi

  if [ "${need_clean}" -eq 1 ]; then
    echo "::group::Create fresh bare React Native ${RN_VERSION} consumer"
    rm -rf "${WORK_ROOT}"
    mkdir -p "${WORK_ROOT}"

    npx --yes "@react-native-community/cli@${CLI_VERSION}" init BeeUIBareSmoke \
      --version "${RN_VERSION}" \
      --directory "${APP_DIR}" \
      --pm npm \
      --install-pods false \
      --skip-git-init true
    echo "::endgroup::"

    pack_beeui
    cd "${APP_DIR}"

    echo "::group::Install BeeUI tarballs and runtime styling dependencies"
    npm install --save-exact \
      "${CORE_TARBALL}" \
      "${TOKENS_TARBALL}" \
      "${UI_TARBALL}" \
      "${PINNED_DEPS[@]}"
    echo "::endgroup::"

    printf '%s' "${fingerprint}" > "${FINGERPRINT_FILE}"
  else
    echo "Reusing existing bare React Native consumer at ${APP_DIR} (environment fingerprint unchanged)"
    pack_beeui
    cd "${APP_DIR}"

    echo "::group::Reinstall BeeUI tarballs into existing consumer"
    # The BeeUI tarball versions do not change between runs, so npm would skip
    # a same-version reinstall; force it by clearing the scope first so new
    # tarball content is always picked up. The rest of node_modules and
    # ios/Pods are left intact for incremental installs/builds.
    rm -rf node_modules/@beeui
    npm install --save-exact \
      "${CORE_TARBALL}" \
      "${TOKENS_TARBALL}" \
      "${UI_TARBALL}"
    echo "::endgroup::"
  fi

  if node -e "require.resolve('expo')" >/dev/null 2>&1; then
    echo "Bare consumer unexpectedly resolves the Expo runtime."
    exit 1
  fi

  echo "::group::Configure isolated consumer"
  mkdir -p src build

  cat > metro.config.js <<'EOF'
const { getDefaultConfig } = require('@react-native/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withUniwindConfig(config, {
  cssEntryFile: './src/global.css',
  dtsFile: './src/uniwind-types.d.ts',
});
EOF

  cat > src/global.css <<'EOF'
@import 'tailwindcss';
@import 'uniwind';
@import '@beeui/tokens/theme.css';

@source '../node_modules/@beeui/core/src';
@source '../node_modules/@beeui/ui/src';
EOF

  cat > App.tsx <<'EOF'
import './src/global.css';

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
} from '@beeui/ui';
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
              <Text variant="title">BeeUI bare React Native smoke</Text>
              <Input accessibilityLabel="Project name" placeholder="Project name" />
              <Checkbox checked={checked} label="Enable notifications" onCheckedChange={setChecked} />
              <ChipGroup onValueChange={(value) => setFilter(String(value))} value={filter}>
                <Chip value="all">All</Chip>
                <Chip value="active">Active</Chip>
              </ChipGroup>
              <Dialog>
                <DialogTrigger>Open dialog</DialogTrigger>
                <DialogContent>
                  <DialogTitle>Bare RN dialog</DialogTitle>
                  <DialogDescription>React Native core Modal without Expo runtime.</DialogDescription>
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
  echo "::endgroup::"
}

bundle_consumer() {
  test -d "${APP_DIR}" || { echo "Bare consumer is missing; run prepare first."; exit 1; }
  cd "${APP_DIR}"
  mkdir -p build

  echo "::group::Bundle bare React Native Android"
  npx react-native bundle \
    --platform android \
    --dev false \
    --entry-file index.js \
    --bundle-output build/index.android.bundle \
    --assets-dest build/android-assets
  test -s build/index.android.bundle
  echo "::endgroup::"

  echo "::group::Bundle bare React Native iOS"
  npx react-native bundle \
    --platform ios \
    --dev false \
    --entry-file index.js \
    --bundle-output build/main.jsbundle \
    --assets-dest build/ios-assets
  test -s build/main.jsbundle
  echo "::endgroup::"
}

build_android() {
  test -d "${APP_DIR}/android" || { echo "Bare Android project is missing; run prepare first."; exit 1; }
  cd "${APP_DIR}/android"
  ./gradlew assembleDebug --no-daemon --build-cache --stacktrace
  test -f app/build/outputs/apk/debug/app-debug.apk
}

build_ios() {
  test -d "${APP_DIR}/ios" || { echo "Bare iOS project is missing; run prepare first."; exit 1; }
  cd "${APP_DIR}/ios"

  local cache_root xcode_version safe_xcode_version ruby_version bundle_path pod_hash derived_data
  cache_root="${BEEUI_IOS_CACHE_ROOT:-${HOME:-${RUNNER_TEMP:-/tmp}}/Library/Caches/BeeUI}"
  xcode_version="${BEEUI_XCODE_VERSION:-$(xcodebuild -version | awk 'NR == 1 { print $2 }')}"
  safe_xcode_version="$(printf '%s' "$xcode_version" | tr -cs '[:alnum:].-' '_')"
  ruby_version="$(ruby -e 'print RUBY_VERSION')"
  bundle_path="${cache_root}/bundle/ruby-${ruby_version}-$(uname -m)/rn-${RN_VERSION}"

  mkdir -p "$bundle_path"
  echo "Using persistent Bundler cache: $bundle_path"
  bundle config set --local path "$bundle_path"
  bundle install
  bundle exec pod install

  test -f Podfile.lock
  pod_hash="$(shasum -a 256 Podfile.lock | awk '{ print $1 }')"
  derived_data="${cache_root}/DerivedData/bare-rn-${RN_VERSION}/xcode-${safe_xcode_version}/pods-${pod_hash}"
  mkdir -p "$derived_data"
  echo "Using persistent bare RN DerivedData: $derived_data"

  xcodebuild \
    -workspace BeeUIBareSmoke.xcworkspace \
    -scheme BeeUIBareSmoke \
    -configuration Debug \
    -sdk iphonesimulator \
    -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath "$derived_data" \
    -showBuildTimingSummary \
    COMPILATION_CACHE_ENABLE_CACHING=YES \
    CODE_SIGNING_ALLOWED=NO \
    build
}

case "${ACTION}" in
  prepare)
    prepare_consumer
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
  all|android)
    prepare_consumer
    bundle_consumer
    build_android
    ;;
  ios)
    prepare_consumer
    bundle_consumer
    build_ios
    ;;
  *)
    echo "Unknown action: ${ACTION}. Expected prepare, bundle, android-build, ios-build, android, ios, or all."
    exit 2
    ;;
esac
