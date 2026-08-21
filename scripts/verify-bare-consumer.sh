#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-all}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_ROOT="${RUNNER_TEMP:-/tmp}/beeui-bare-consumer"
APP_DIR="${WORK_ROOT}/BeeUIBareSmoke"
CLI_VERSION="${BEEUI_RN_CLI_VERSION:-20.2.0}"
RN_VERSION="${BEEUI_RN_VERSION:-0.86.2}"

prepare_consumer() {
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

  cd "${APP_DIR}"

  echo "::group::Install BeeUI runtime styling dependencies"
  npm install --save-exact \
    uniwind@1.10.1 \
    tailwindcss@4.3.3 \
    class-variance-authority@0.7.1 \
    clsx@2.1.1 \
    tailwind-merge@3.6.0 \
    react-native-safe-area-context@5.7.0
  echo "::endgroup::"

  if node -e "require.resolve('expo')" >/dev/null 2>&1; then
    echo "Bare consumer unexpectedly resolves the Expo runtime."
    exit 1
  fi

  echo "::group::Vendor BeeUI source into isolated consumer"
  mkdir -p vendor/beeui/core vendor/beeui/tokens vendor/beeui/ui src build
  cp -R "${ROOT_DIR}/packages/core/src" vendor/beeui/core/
  cp "${ROOT_DIR}/packages/core/package.json" vendor/beeui/core/package.json
  cp -R "${ROOT_DIR}/packages/tokens/src" vendor/beeui/tokens/
  cp "${ROOT_DIR}/packages/tokens/package.json" vendor/beeui/tokens/package.json
  cp -R "${ROOT_DIR}/packages/ui/src" vendor/beeui/ui/
  cp "${ROOT_DIR}/packages/ui/package.json" vendor/beeui/ui/package.json

  cat > metro.config.js <<'EOF'
const path = require('path');
const { getDefaultConfig } = require('@react-native/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);
const vendorRoot = path.resolve(__dirname, 'vendor/beeui');

config.watchFolders = [...(config.watchFolders ?? []), vendorRoot];
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    ...(config.resolver?.extraNodeModules ?? {}),
    '@beeui/core': path.join(vendorRoot, 'core'),
    '@beeui/tokens': path.join(vendorRoot, 'tokens'),
    '@beeui/ui': path.join(vendorRoot, 'ui'),
  },
  nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
};

module.exports = withUniwindConfig(config, {
  cssEntryFile: './src/global.css',
  dtsFile: './src/uniwind-types.d.ts',
});
EOF

  cat > src/global.css <<'EOF'
@import 'tailwindcss';
@import 'uniwind';
@import '../vendor/beeui/tokens/src/theme.css';

@source '../vendor/beeui/core/src';
@source '../vendor/beeui/ui/src';
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
  ./gradlew assembleDebug --no-daemon --stacktrace
  test -f app/build/outputs/apk/debug/app-debug.apk
}

build_ios() {
  test -d "${APP_DIR}/ios" || { echo "Bare iOS project is missing; run prepare first."; exit 1; }
  cd "${APP_DIR}/ios"
  bundle config set path ../vendor/bundle
  bundle install
  bundle exec pod install
  xcodebuild \
    -workspace BeeUIBareSmoke.xcworkspace \
    -scheme BeeUIBareSmoke \
    -configuration Debug \
    -sdk iphonesimulator \
    -destination 'generic/platform=iOS Simulator' \
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
