---
title: Bare React Native
description: Install the BeeUI release candidate in a true bare React Native 0.86 application and verify native bundles without Expo.
releaseStatus: true
---

Use this path for a React Native application that does not use the Expo runtime (see the release status above). Keep using `@next` in the commands below.

**Prerequisites:** an existing bare React Native `0.86.x` project created with the React
Native Community CLI (this page does not cover scaffolding one) and Node.js/npm available
locally. Already on `0.86.2-rc.1`? Read [Upgrading from 0.86.2-rc.1](/docs/guides/migration-versioning/#upgrading-from-0862-rc1-to-0862-rc2) first — the required `Sheet` provider rewiring is a breaking native-root change.

## Install

Install BeeUI and every runtime peer it declares in one command — installing `@beemvp/beeui-ui` alone first and the React Native peers afterward, in two separate commands, is the ordering that produces an `ERESOLVE` on `react-native`:

```bash
npm install @beemvp/beeui-ui@next @beemvp/beeui-core@next @beemvp/beeui-tokens@next \
  react@19.2.3 react-dom@19.2.3 react-native@0.86.2 \
  react-native-safe-area-context@5.7.0 react-native-teleport@1.1.13 \
  tailwindcss@4.3.3 uniwind@1.10.1
```

Pin the exact version from `CHANGELOG.md` instead of `@next` when you need an immutable RC dependency — see the release status above for today's exact version.

Optional native peers for `Sheet`, `DatePicker` and `DateTimePicker` are listed in [Compatibility](/docs/compatibility/).

## Styling entry

Create `global.css` at the project root, matching the `cssEntryFile` path your Metro/Uniwind
config points at. `@source` paths are relative to this file:

```css
@import 'tailwindcss';
@import 'uniwind';
@import '@beemvp/beeui-tokens/theme.css';

@source './node_modules/@beemvp/beeui-core/src';
@source './node_modules/@beemvp/beeui-ui/src';
```

## Application root

```tsx
import { BeeUIProvider, SafeArea, Screen, Text } from '@beemvp/beeui-ui';

export default function App() {
  return (
    <BeeUIProvider>
      <Screen>
        <SafeArea edges={['top', 'bottom', 'left', 'right']}>
          <Text>BeeUI on bare React Native</Text>
        </SafeArea>
      </Screen>
    </BeeUIProvider>
  );
}
```

Your Metro/Uniwind setup should follow the maintained consumer fixture at `examples/bare-rn-consumer`.

## Sheet on native

If your app renders `Sheet`, mount BeeUI's public `SheetProvider` directly below `BeeUIProvider`, above the rest of the app:

```tsx
import { BeeUIProvider, SheetProvider } from '@beemvp/beeui-ui';

export default function App() {
  return (
    <BeeUIProvider>
      <SheetProvider>
        {/* Screen / SafeArea as above */}
      </SheetProvider>
    </BeeUIProvider>
  );
}
```

`SheetProvider` is required on native: it installs `GestureHandlerRootView` and `@gorhom/bottom-sheet`'s `BottomSheetModalProvider` itself, so gorhom's portal host is constructed below BeeUI's runtime contexts. Do not also mount an outer `GestureHandlerRootView`/`BottomSheetModalProvider` — if you followed an earlier BeeUI release's guidance to wire `GestureHandlerRootView > BottomSheetModalProvider > BeeUIProvider`, remove that outer `BottomSheetModalProvider` when you upgrade. `SheetProvider` deliberately does not reuse an already-present outer gorhom provider.

`SheetContent` only sees React contexts mounted above `SheetProvider`. Keep app-wide providers (a query client, i18n, navigation, your own app stores) above `SheetProvider`; a screen-scoped provider that a Sheet's content still needs to read must be passed through `SheetContent`'s `bridgeContexts` prop instead. See the [Sheet component reference](/docs/components/sheet/) for the full provider and `bridgeContexts` contract.

## Verify the maintained bare consumer

From `examples/bare-rn-consumer`:

```bash
bash setup.sh
bash bundle.sh
```

The fixture scaffolds a clean RN 0.86 app, installs BeeUI through the package boundary and performs **Metro bundling** for Android and iOS without an Expo fallback.

Equivalent direct Metro commands inside a configured consumer look like:

```bash
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
```

The maintained fixture remains stricter than an ordinary app install: CI asserts that Expo is not resolvable and separately exercises native compile lanes.

## Native toolchains

BeeUI does not replace the standard React Native platform toolchains:

- Android: JDK + Android SDK/Gradle tooling;
- iOS: Xcode + CocoaPods.

A Metro bundle proves package/bundler resolution, not native compilation or runtime interaction. Follow the repository release/native verification contracts for those stronger evidence classes.
