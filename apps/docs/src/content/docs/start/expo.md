---
title: Expo
description: Install the BeeUI release candidate in Expo SDK 57 and verify Android, iOS and Web through Metro.
---

Use this path for an Expo SDK 57 application. BeeUI `0.86.2-rc.3` is public under the npm `next` dist-tag (observed 2026-09-24). During the `0.86.2` prerelease line `latest` follows the newest complete, verified RC only after the owner moves it for all four packages, so it can lag `next`; the last observed `latest` target is recorded in [`docs/dist-tag-policy.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/dist-tag-policy.md); keep using `@next` in the commands below.

**Prerequisites:** Node.js and npm/npx available locally, and the [tested version table](/docs/start/#prerequisites) if you already have an Expo project instead of creating a new one below. Already on `0.86.2-rc.1`? Read [Upgrading from 0.86.2-rc.1](/docs/guides/migration-versioning/#upgrading-from-0862-rc1-to-0862-rc2) first — the required `Sheet` provider rewiring is a breaking native-root change.

## Create the project

`create-expo-app`'s current default template is an Expo Router app whose root is `app/_layout.tsx`. That layout is where the Provider section below mounts `BeeUIProvider`.

```bash
npx create-expo-app@latest my-app
cd my-app
```

## Add BeeUI to Expo

Install BeeUI and every runtime peer it declares in one command — installing `@beemvp/beeui-ui` alone first and the React Native peers afterward is the ordering that produces an `ERESOLVE` on `react-native`:

```bash
npm install @beemvp/beeui-ui@next @beemvp/beeui-core@next @beemvp/beeui-tokens@next \
  react@19.2.3 react-dom@19.2.3 react-native@0.86.2 \
  react-native-web@0.21.0 react-native-safe-area-context@~5.7.0 \
  react-native-teleport@~1.1.13 tailwindcss@4.3.3 uniwind@1.10.1
```

Pin `@0.86.2-rc.3` instead of `@next` when you need an immutable RC dependency.

Optional native peers used by `Sheet`, `DatePicker` and `DateTimePicker` are listed in [Compatibility](/docs/compatibility/); install only the ones your application uses.

## Styling entry

Create `global.css` **at the project root** — the same path the Metro configuration below points `cssEntryFile` at — and import it once from your root layout (`app/_layout.tsx`). `@source` paths are resolved relative to this file:

```css
@import 'tailwindcss';
@import 'uniwind';
@import '@beemvp/beeui-tokens/theme.css';

@source './node_modules/@beemvp/beeui-core/src';
@source './node_modules/@beemvp/beeui-ui/src';
```

The `@source` entries are required so Tailwind sees BeeUI's own source-emitted classes; without them the app builds with no error and renders unstyled.

## Metro configuration

The maintained Expo fixture uses Uniwind's Metro wrapper. Copy the whole file, including the `require`/`module.exports` wrapper — a bare options object with no wrapper is not valid Metro config:

```js
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

module.exports = withUniwindConfig(getDefaultConfig(__dirname), {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
  extraThemes: ['violet-light', 'violet-dark', 'high-contrast-light', 'high-contrast-dark'],
});
```

## Generate Uniwind's TypeScript artifacts before typechecking

Metro only writes `uniwind-types.d.ts` (the file `dtsFile` above names) the first time it bundles. A fresh checkout that runs `tsc --noEmit` before ever starting Metro fails with dozens of `Property 'className' does not exist on type 'ViewProps'` errors — this is not a BeeUI defect, it is Uniwind's codegen not having run yet. Run its CLI once, and wire it into `postinstall` so CI and editors never hit this:

```bash
npx uniwind generate-artifacts --css ./global.css \
  --theme violet-light --theme violet-dark \
  --theme high-contrast-light --theme high-contrast-dark \
  --dts ./uniwind-types.d.ts
```

```json
{
  "scripts": {
    "postinstall": "uniwind generate-artifacts --css ./global.css --theme violet-light --theme violet-dark --theme high-contrast-light --theme high-contrast-dark --dts ./uniwind-types.d.ts",
    "typecheck": "tsc --noEmit"
  }
}
```

List the same `--theme` values passed to `extraThemes` above so the generated types match the Metro config exactly.

## Provider

Mount `BeeUIProvider` in the Expo Router root layout, above the `Stack` — not inside a bare `App()` component, which is not what `create-expo-app`'s current template scaffolds:

```tsx
// app/_layout.tsx
import '../global.css';

import { BeeUIProvider, SafeArea, Screen } from '@beemvp/beeui-ui';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <BeeUIProvider>
      <Screen>
        <SafeArea edges={['top', 'left', 'right']} className="flex-1">
          <Stack screenOptions={{ headerShown: false }} />
        </SafeArea>
      </Screen>
    </BeeUIProvider>
  );
}
```

If your project does not use Expo Router, mount the same provider in a bare `App()` instead:

```tsx
import { BeeUIProvider, SafeArea, Screen, Text } from '@beemvp/beeui-ui';

export default function App() {
  return (
    <BeeUIProvider>
      <Screen>
        <SafeArea edges={['top', 'bottom', 'left', 'right']}>
          <Text>BeeUI on Expo</Text>
        </SafeArea>
      </Screen>
    </BeeUIProvider>
  );
}
```

## Sheet on native

If your app renders `Sheet` on iOS/Android, mount BeeUI's public `SheetProvider` directly below `BeeUIProvider`, above the rest of the app:

```tsx
import { BeeUIProvider, SheetProvider } from '@beemvp/beeui-ui';

export default function RootLayout() {
  return (
    <BeeUIProvider>
      <SheetProvider>
        {/* Screen / SafeArea / Stack as above */}
      </SheetProvider>
    </BeeUIProvider>
  );
}
```

`SheetProvider` is required on native: it installs `GestureHandlerRootView` and `@gorhom/bottom-sheet`'s `BottomSheetModalProvider` itself, so gorhom's portal host is constructed below BeeUI's runtime contexts. Do not also mount an outer `GestureHandlerRootView`/`BottomSheetModalProvider` — if you followed an earlier BeeUI release's guidance to wire `GestureHandlerRootView > BottomSheetModalProvider > BeeUIProvider`, remove that outer `BottomSheetModalProvider` (and move `GestureHandlerRootView` inside `SheetProvider`'s ownership) when you upgrade. `SheetProvider` deliberately does not reuse an already-present outer gorhom provider.

`SheetContent` only sees React contexts mounted above `SheetProvider`. Keep app-wide providers (a query client, i18n, navigation, your own app stores) above `SheetProvider`; a screen-scoped provider that a Sheet's content still needs to read must be passed through `SheetContent`'s `bridgeContexts` prop instead. Web and the RN `Modal` fallback do not need `SheetProvider` mounted for correctness — it is a pass-through there — but it is safe to mount everywhere for one consistent tree. See the [Sheet component reference](/docs/components/sheet/) for the full provider and `bridgeContexts` contract.

## Verify with the maintained consumer

The executable authority is `examples/expo-package-consumer`. From that directory, the release-equivalent flow is:

```bash
bash setup.sh
bash bundle.sh
```

The setup script creates the isolated consumer boundary and the bundle script exercises Metro/export behavior with the fixture's exact dependency/configuration contract.

For an interactive session:

```bash
npx expo start
```

Use Expo's normal `i`, `a` or `w` targets when the matching simulator, emulator or browser is available.

## Evidence boundary

A successful Expo export proves Metro resolution for Android, iOS and Web. It is not a substitute for native compilation or simulator/device interaction. BeeUI tracks those evidence classes separately in [Release & security](/docs/release-security/) and the repository release contract.
