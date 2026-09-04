---
title: Bare React Native
description: Reach a bundled BeeUI screen in a true bare React Native application with no Expo runtime, verified by Android and iOS Metro bundles.
---

This is the path for a React Native application that does not use the Expo runtime — an app scaffolded with the React Native Community CLI, or an existing bare app you own the `android/` and `ios/` trees for. BeeUI maintains this path independently of Expo, and the fixture actively asserts that the Expo runtime is *not* resolvable.

Choose a different guide if your app runs on Expo ([Expo](/docs/start/expo/)) or ships to browsers only ([Web](/docs/start/web/)).

:::caution[Public distribution is closed]
BeeUI is unpublished, so nothing below is a public-registry installation instruction. The commands use `examples/bare-rn-consumer`, which packs the real package artifacts locally and installs them into a freshly scaffolded bare application.
:::

## Prerequisites

These are the pins `examples/bare-rn-consumer/setup.sh` and `scripts/verify-bare-consumer.sh` share. The authoritative machine-checked table is [Compatibility](/docs/compatibility/); do not lift version numbers from a starter's generated `package.json`.

| Dependency | Tested value |
| --- | --- |
| Node.js | `24.13.1` |
| pnpm (for the repository build) | `10.15.0` |
| `@react-native-community/cli` | `20.2.0` |
| `react-native` | `0.86.2` |
| `react` / `react-dom` | `19.2.3` |
| `react-native-safe-area-context` | `5.7.0` |
| `react-native-teleport` | `1.1.13` |
| `tailwindcss` / `uniwind` | `4.3.3` / `1.10.1` |

Optional native peers for `Sheet`, `DatePicker` and `DateTimePicker`: `@react-native-community/datetimepicker@9.1.0`, `@gorhom/bottom-sheet@5.2.14`, `react-native-reanimated@4.5.1`, `react-native-gesture-handler@2.32.0`, `react-native-worklets@0.10.1`. The starter installs all of them because its screen exercises all of them.

Platform toolchains are the standard React Native ones and BeeUI does not replace them: a JDK and the Android SDK for Android, and Xcode with CocoaPods for iOS. Note that the starter's own acceptance gate is a Metro bundle, so it needs neither — you only need them when you go on to compile or run the app.

## Starting project state

A clean checkout of this repository with the workspace built. The starter scaffolds its own application: `setup.sh` runs the pinned React Native Community CLI to generate `examples/bare-rn-consumer/app/`, then overlays four committed files onto it. The generated `android/` and `ios/` trees are deliberately **not** committed — they are hundreds of mechanically reproducible files, and keeping them out makes the BeeUI-relevant source reviewable.

Those four files in `src-overrides/` are the entire integration contract, and they are what you copy into your own app:

- `App.tsx` — provider, safe area and components;
- `index.js` — `AppRegistry` registration;
- `metro.config.js` — Metro plus Uniwind wiring;
- `global.css` — the Tailwind, Uniwind and BeeUI theme entry.

## 1. Build the workspace and run the clean consumer

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build

cd examples/bare-rn-consumer
bash setup.sh
bash bundle.sh
```

`setup.sh` scaffolds the pinned bare app, copies `src-overrides/` over it, packs `@beemvp/beeui-core`, `@beemvp/beeui-tokens` and `@beemvp/beeui-ui` with `pnpm pack`, installs those tarballs plus the pinned native peers with `npm install --save-exact`, and then fails loudly if `require.resolve('expo')` succeeds. That last guard is what keeps this path honest.

`bundle.sh` produces release-mode Metro bundles for both native platforms:

```bash
npx react-native bundle \
  --platform android \
  --dev false \
  --entry-file index.js \
  --bundle-output build/index.android.bundle \
  --assets-dest build/android-assets
```

The iOS invocation is identical apart from `--platform ios` and `--bundle-output build/main.jsbundle`. Both outputs are asserted non-empty.

## 2. Wire the styling entry

`src-overrides/global.css`, verbatim:

```css
@import 'tailwindcss';
@import 'uniwind';
@import '@beemvp/beeui-tokens/theme.css';

@source '../node_modules/@beemvp/beeui-core/src';
@source '../node_modules/@beemvp/beeui-ui/src';
```

The `@source` lines point Tailwind at BeeUI's own source. Drop them and every BeeUI class is compiled away, which shows up as a fully unstyled screen rather than an error.

## 3. Wire Metro bundling

Bare React Native uses `@react-native/metro-config` rather than Expo's config. `src-overrides/metro.config.js`, verbatim:

```js
const { getDefaultConfig } = require('@react-native/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
});
```

Register the root component as React Native expects (`src-overrides/index.js`):

```js
import { AppRegistry } from 'react-native';

import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
```

## 4. Mount the provider and own your safe-area edges

The application-side shape is identical to Expo — that is the point of the package boundary.

```tsx
import './global.css';

import {
  BeeUIProvider,
  Button,
  Card,
  SafeArea,
  Screen,
  Text,
} from '@beemvp/beeui-ui';

export default function App() {
  return (
    <BeeUIProvider>
      <Screen>
        <SafeArea edges={['top', 'left', 'right']} className="flex-1">
          <Card className="gap-4">
            <Text variant="title">BeeUI on bare React Native</Text>
            <Text variant="body">No Expo runtime, same component contract.</Text>
            <Button>Continue</Button>
          </Card>
        </SafeArea>
      </Screen>
    </BeeUIProvider>
  );
}
```

`BeeUIProvider` owns inset measurement, theme synchronization, the root overlay scope and the Toast viewport. `SafeArea` stays application-owned so a header, body and footer can claim different edges. See [Provider & safe area](/docs/start/provider-safe-area/).

The starter's `App.tsx` goes further and wires `BackHandler` so the Android hardware back button dismisses an open `Sheet`. That is import- and compile-level evidence only: this starter never presses a real back button.

## 5. Verify

Rows 1 and 6-7 run from the repository root; rows 2-5 run from `examples/bare-rn-consumer`.

| Checkpoint | Run from | Command | Expected result |
| --- | --- | --- | --- |
| Packages built | repository root | `pnpm build` | exits `0`; `packages/ui/dist` exists |
| App scaffolded and installed | `examples/bare-rn-consumer` | `bash setup.sh` | ends with `==> Setup complete. Run: bash bundle.sh`; the Expo isolation guard did not trip |
| Expo really absent | `examples/bare-rn-consumer` | `cd app && node -e "require.resolve('expo')"` | fails — a success here means the isolation contract is broken |
| Metro bundling succeeds | `examples/bare-rn-consumer` | `bash bundle.sh` | ends with `OK: both Android and iOS Metro bundles produced non-empty output.` |
| Output on disk | `examples/bare-rn-consumer` | — | `app/build/index.android.bundle` and `app/build/main.jsbundle` both exist and are non-empty (the recorded run produced roughly 2.3 MB each) |
| Android compiles | repository root | `bash scripts/verify-bare-consumer.sh android-build` | Gradle produces `app/build/outputs/apk/debug/app-debug.apk`; needs a JDK and the Android SDK |
| iOS compiles | repository root | `bash scripts/verify-bare-consumer.sh ios-build` | `pod install` then `xcodebuild` against the iOS simulator SDK succeeds; needs Xcode and CocoaPods |

**What this proves, and what it does not.** A passing `bundle.sh` is *packed-package resolution plus bare Metro bundle evidence* for Android and iOS. It is not a Gradle or Xcode compile, and not simulator or device interaction. BeeUI's CI lane (`scripts/verify-bare-consumer.sh`) adds those as separate, heavier gates — `./gradlew assembleDebug` producing `app-debug.apk`, and `pod install` plus `xcodebuild` against the iOS simulator SDK. Report each class for what it is.

## Common failures

| Symptom | Cause | Fix |
| --- | --- | --- |
| `packages/ui/dist is missing. Run "pnpm build" …` | the packer refuses to pack an unbuilt workspace | run `pnpm build` from the repository root, then re-run `bash setup.sh` |
| `This bare RN consumer unexpectedly resolves the Expo runtime.` | Expo leaked into the dependency graph, usually from a stale `node_modules` or a hoisted parent install | delete `examples/bare-rn-consumer/app/` and re-run `bash setup.sh`, which regenerates the app from scratch |
| `npm install` fails resolving native peers | the bare starter installs with strict peer resolution on purpose, so a drifted pin is a real error | align the peer versions with the prerequisites above and [Compatibility](/docs/compatibility/) rather than forcing the install |
| Screen renders but every component is unstyled | `global.css` was not imported from the entry component, or the `@source` lines are missing | import `./global.css` at the top of `App.tsx` and restore the entry from step 2 |
| `Unable to resolve module uniwind/metro` | `metro.config.js` was copied from the Expo path (`expo/metro-config`) or Uniwind is not installed in the app | use `@react-native/metro-config` as in step 3, confirm `uniwind` is in the app's dependencies, then restart Metro with `--reset-cache` |
| `Sheet` or `DateTimePicker` fails to resolve at bundle time | its optional native peer is missing | install the matching peer from the prerequisites, then rebuild the native app — a JavaScript refresh cannot install native code |
| Bundle succeeds but the app crashes on launch | the native project was not rebuilt after a native dependency changed | rebuild the native project with your own Android or iOS toolchain, re-running `pod install` on iOS first — a JavaScript refresh cannot install native code |
| `bundle.sh` reports `app/ is missing; run setup.sh first.` | `bundle.sh` was run before the app was scaffolded | run `bash setup.sh` first |

## Next steps

- Browse [Components](/docs/components/) for the generated per-component reference.
- Compose real screens with [Patterns](/docs/patterns/).
- Work through a stuck setup in [Troubleshooting](/docs/troubleshooting/).
- Read [Provider & safe area](/docs/start/provider-safe-area/) for edge ownership, and [Compatibility → Native](/docs/compatibility/native/) for what native verification does and does not prove.

## Source authority

- [`examples/bare-rn-consumer`](https://github.com/beobungbu/BeeUI/tree/main/examples/bare-rn-consumer) — the maintained isolated starter this page documents.
- [`scripts/verify-bare-consumer.sh`](https://github.com/beobungbu/BeeUI/blob/main/scripts/verify-bare-consumer.sh) — the CI lane that adds Gradle and Xcode compile evidence.
- [`docs/native-verification.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/native-verification.md) — the native evidence taxonomy.
- [`docs/compatibility-matrix.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/compatibility-matrix.md) — the tested version contract.
