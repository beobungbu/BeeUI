---
title: Expo
description: Add BeeUI to an Expo SDK 57 application through the packed-package boundary, and verify it with a real Metro export.
---

This is the path to add BeeUI to an Expo application on SDK 57 — a new app you are about to create, or an existing one you want BeeUI inside. It is the fastest way to get BeeUI rendering on Android, iOS and Web from one codebase.

Choose a different guide if you run React Native without the Expo runtime ([Bare React Native](/docs/start/bare-react-native/)), if you ship a browser-only product ([Web](/docs/start/web/)), or if you want the component source committed into your own repository ([CLI & source ownership](/docs/guides/cli-source-ownership/)).

:::caution[Public distribution is closed]
BeeUI packages and the BeeUI CLI are not published to the public npm registry yet, so there is no public install command to copy. This guide uses `examples/expo-package-consumer`, which packs the real package artifacts locally and installs them into an isolated app — the same boundary an external consumer will use once publication opens.
:::

## Prerequisites

These are the values `examples/expo-package-consumer/setup.sh` installs. The authoritative machine-checked table is [Compatibility](/docs/compatibility/) — check it before pinning anything, and do not copy version numbers out of a starter's committed `package.json`, which is a resolved lock artifact rather than the tested pin.

| Dependency | Tested value |
| --- | --- |
| Node.js | `24.13.1` |
| pnpm (for the repository build) | `10.15.0` |
| `expo` | `~57.0.0` |
| `@expo/metro-runtime` | `~57.0.12` |
| `react` / `react-dom` | `19.2.3` |
| `react-native` | `0.86.2` |
| `react-native-web` | `0.21.0` |
| `react-native-safe-area-context` | `~5.7.0` |
| `react-native-teleport` | `~1.1.13` |
| `tailwindcss` / `uniwind` | `4.3.3` / `1.10.1` |

Optional native peers — `@react-native-community/datetimepicker@~9.1.0`, `@gorhom/bottom-sheet@~5.2.14`, `react-native-reanimated@~4.5.1`, `react-native-gesture-handler@~2.32.0`, `react-native-worklets@~0.10.1` — are installed by the same script because `Sheet`, `DatePicker` and `DateTimePicker` need them. Install them in your own app only if you use those components.

## Starting project state

A clean checkout of this repository with the workspace built, plus an Expo SDK 57 application. The starter *is* that application: `examples/expo-package-consumer` holds a minimal Expo app with `app.json`, `index.js`, `metro.config.js`, `global.css` and `App.tsx` already wired. Work through it first, then apply the same five files to your own app. Copying those five
files does not make `@beemvp/beeui-ui` resolvable on its own — see [Installing into an app you already own](/docs/start/#installing-into-an-app-you-already-own) for the packer invocation that does.

## 1. Build the workspace and run the clean consumer

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build

cd examples/expo-package-consumer
bash setup.sh
bash bundle.sh
```

`setup.sh` packs `@beemvp/beeui-core`, `@beemvp/beeui-tokens` and `@beemvp/beeui-ui` into real tarballs with `pnpm pack`, then installs those tarballs plus the pinned Expo SDK 57 runtime set with `npm install --save-exact`. Nothing is linked from the monorepo — that is the point of the fixture.

`bundle.sh` runs `npx expo export --platform all --output-dir dist`, Expo's own headless Metro export, and then asserts that Android and iOS bundle output actually exists.

For an interactive session against the same app:

```bash
npx expo start
```

Use Expo's normal `i`, `a` or `w` targets when the matching simulator, emulator or browser is available.

## 2. Wire the styling entry

BeeUI's Web/theme output is CSS, and Uniwind compiles the Tailwind classes the components use. One CSS entry file does both. This is `examples/expo-package-consumer/global.css` verbatim:

```css
@import 'tailwindcss';
@import 'uniwind';
@import '@beemvp/beeui-tokens/theme.css';

@source './node_modules/@beemvp/beeui-core/src';
@source './node_modules/@beemvp/beeui-ui/src';
```

The two `@source` lines matter: without them Tailwind never scans BeeUI's own source, so BeeUI's classes are compiled away and every component renders unstyled.

## 3. Point Metro at that entry

`examples/expo-package-consumer/metro.config.js`, verbatim:

```js
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

module.exports = withUniwindConfig(getDefaultConfig(__dirname), {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
  extraThemes: ['violet-light', 'violet-dark', 'high-contrast-light', 'high-contrast-dark'],
});
```

`withUniwindConfig` wraps Expo's default Metro config; `cssEntryFile: './global.css'` is what binds step 2 to the bundler. `extraThemes` is optional — list only the runtime themes you actually ship. CI checks that the three `@import` lines, `withUniwindConfig` and `cssEntryFile: './global.css'` appear in both the fixture and this page, so those five cannot drift apart silently. It also resolves every `@source` glob against the directory this starter installs into and fails if one points outside it — a glob that resolves to nothing produces a successful build with no BeeUI styling, so it cannot be left unguarded. `dtsFile` and `extraThemes` are not guarded; for those the fixture is the source of truth.

Register the root component the way Expo expects (`index.js`):

```js
import '@expo/metro-runtime';
import { registerRootComponent } from 'expo';

import App from './App';

registerRootComponent(App);
```

## 4. Mount the provider and own your safe-area edges

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
          <Card>
            <Text variant="title">BeeUI on Expo</Text>
            <Text variant="body">Packed packages, Expo Metro, one provider.</Text>
            <Button>Continue</Button>
          </Card>
        </SafeArea>
      </Screen>
    </BeeUIProvider>
  );
}
```

`BeeUIProvider` owns the runtime services — inset measurement, theme synchronization, the root anchored-overlay scope and the Toast viewport. It does **not** decide which surface consumes which inset; `SafeArea` is the explicit, application-owned boundary for that. Read [Provider & safe area](/docs/start/provider-safe-area/) before you build a header/body/footer shell.

## 5. Verify

| Checkpoint | Command | Expected result |
| --- | --- | --- |
| Packages built | `pnpm build` at the repository root | exits `0`; `packages/ui/dist` exists |
| Tarballs installed | `bash setup.sh` | ends with `==> Setup complete. Run: bash bundle.sh` |
| Bundles produced | `bash bundle.sh` | ends with `OK: Expo export produced Android, iOS, and Web bundle output under dist/.` |
| Output on disk | — | `dist/_expo/static/js/android` and `dist/_expo/static/js/ios` both exist |
| Visible UI | `npx expo start`, then `w` (or `i` / `a`) | the card, title and button above render with BeeUI styling applied |

The starter's recorded acceptance run (Expo SDK 57, RN 0.86.2) exported a Web bundle of 663 modules and Android and iOS Hermes bytecode bundles of roughly 3.5 MB each, finishing with `Exported: dist`. Treat that as the shape to compare against, not an exact target.

**What this proves, and what it does not.** A successful export is *package-boundary plus Metro bundle evidence* for all three platforms. It is not a native compile and not simulator or device interaction; `expo export` never runs `expo prebuild`, Gradle or Xcode. BeeUI's heavier CI lane adds those separately. Do not report an export as native runtime proof.

## Common failures

| Symptom | Cause | Fix |
| --- | --- | --- |
| `packages/ui/dist is missing. Run "pnpm build" …` | the packer refuses to pack an unbuilt workspace | run `pnpm build` from the repository root, then re-run `bash setup.sh` |
| `npm install` aborts on a peer-dependency conflict | Expo SDK 57's own peer graph is stricter than the pinned set in some npm versions | BeeUI's CI runs the same install with `--legacy-peer-deps`; use that flag if your npm rejects the graph, then re-check versions against [Compatibility](/docs/compatibility/) |
| Everything renders, but with no BeeUI styling | `global.css` is not imported from the entry component, or the two `@source` lines are missing | import `./global.css` at the top of `App.tsx` and restore the `@source` lines from step 2 |
| Metro cannot resolve `uniwind/metro` or ignores the CSS entry | `metro.config.js` does not wrap the default config with `withUniwindConfig`, or `cssEntryFile` points at a path that does not exist | copy the config in step 3 exactly, then restart Metro with `npx expo start --clear` |
| `bundle.sh` fails with `Expected Android bundle output missing under dist/_expo/static/js/android` | the export errored earlier, or a stale `dist/` from a partial run | delete `dist/`, re-run `bash bundle.sh`, and read the first Metro error rather than the assertion |
| A `Sheet`, `DatePicker` or `DateTimePicker` import fails to resolve | its optional native peer is not installed in your app | install the matching peer listed in the prerequisites, then rebuild — a JavaScript refresh cannot add native code |
| The starter unexpectedly picks up monorepo packages | a leftover `node_modules` from an earlier run | delete `examples/expo-package-consumer/node_modules` and `.beeui-tarballs`, then re-run `bash setup.sh` |

## Next steps

- Browse [Components](/docs/components/) for the generated reference of everything the provider makes available.
- Compose real screens with [Patterns](/docs/patterns/).
- Diagnose anything this page did not cover in [Troubleshooting](/docs/guides/troubleshooting/).
- Set edge ownership properly with [Provider & safe area](/docs/start/provider-safe-area/), and confirm pins in [Compatibility](/docs/compatibility/).

## Source authority

- [`examples/expo-package-consumer`](https://github.com/beobungbu/BeeUI/tree/main/examples/expo-package-consumer) — the isolated executable consumer this page documents.
- [`scripts/verify-expo-consumer.sh`](https://github.com/beobungbu/BeeUI/blob/main/scripts/verify-expo-consumer.sh) — the heavier CI lane that adds typecheck, per-platform exports and native compile.
- [`apps/showcase`](https://github.com/beobungbu/BeeUI/tree/main/apps/showcase) — the full Expo runtime surface.
- [`docs/compatibility-matrix.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/compatibility-matrix.md) — the tested version contract.
