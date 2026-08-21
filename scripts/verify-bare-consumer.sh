#!/usr/bin/env bash
set -euo pipefail

PLATFORM="${1:-bundle}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_ROOT="${RUNNER_TEMP:-/tmp}/beeui-bare-consumer"
APP_DIR="${WORK_ROOT}/BeeUIBareSmoke"
CLI_VERSION="${BEEUI_RN_CLI_VERSION:-20.2.0}"
RN_VERSION="${BEEUI_RN_VERSION:-0.86.2}"

rm -rf "${WORK_ROOT}"
mkdir -p "${WORK_ROOT}"

npx --yes "@react-native-community/cli@${CLI_VERSION}" init BeeUIBareSmoke \
  --version "${RN_VERSION}" \
  --directory "${APP_DIR}" \
  --pm npm \
  --install-pods false \
  --skip-git-init true

cd "${APP_DIR}"

npm install --save-exact \
  uniwind@1.10.1 \
  tailwindcss@4.3.3 \
  class-variance-authority@0.7.1 \
  clsx@2.1.1 \
  tailwind-merge@3.6.0

if node -e "require.resolve('expo')" >/dev/null 2>&1; then
  echo "Bare consumer unexpectedly resolves the Expo runtime."
  exit 1
fi

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
  Screen,
  Text,
} from '@beeui/ui';
import * as React from 'react';
import { ScrollView } from 'react-native';

export default function App() {
  const [checked, setChecked] = React.useState(false);
  const [filter, setFilter] = React.useState('all');

  return (
    <Screen>
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
    </Screen>
  );
}
EOF

npx react-native bundle \
  --platform android \
  --dev false \
  --entry-file index.js \
  --bundle-output build/index.android.bundle \
  --assets-dest build/android-assets

npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output build/main.jsbundle \
  --assets-dest build/ios-assets

case "${PLATFORM}" in
  bundle)
    ;;
  android)
    cd android
    ./gradlew assembleDebug --no-daemon --stacktrace
    test -f app/build/outputs/apk/debug/app-debug.apk
    ;;
  ios)
    cd ios
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
    ;;
  *)
    echo "Unknown platform: ${PLATFORM}. Expected bundle, android, or ios."
    exit 2
    ;;
esac
