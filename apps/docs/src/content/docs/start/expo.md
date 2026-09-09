---
title: Expo
description: Install the BeeUI release candidate in Expo SDK 57 and verify Android, iOS and Web through Metro.
---

Use this path for an Expo SDK 57 application. BeeUI `0.86.2-rc.1` is public under the npm `next` dist-tag; stable `latest` is not promoted yet.

## Install

```bash
npm install @beemvp/beeui-ui@next @beemvp/beeui-core@next @beemvp/beeui-tokens@next
npm install react@19.2.3 react-dom@19.2.3 react-native@0.86.2 \
  react-native-web@0.21.0 react-native-safe-area-context@~5.7.0 \
  react-native-teleport@~1.1.13 tailwindcss@4.3.3 uniwind@1.10.1
```

Pin `@0.86.2-rc.1` instead of `@next` when you need an immutable RC dependency.

Optional native peers used by `Sheet`, `DatePicker` and `DateTimePicker` are listed in [Compatibility](/docs/compatibility/); install only the ones your application uses.

## Styling entry

```css
@import 'tailwindcss';
@import 'uniwind';
@import '@beemvp/beeui-tokens/theme.css';

@source './node_modules/@beemvp/beeui-core/src';
@source './node_modules/@beemvp/beeui-ui/src';
```

The `@source` entries are required so Tailwind sees BeeUI's published source classes.

## Metro configuration

The maintained Expo fixture uses Uniwind's Metro wrapper:

```js
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

module.exports = withUniwindConfig(getDefaultConfig(__dirname), {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
  extraThemes: ['violet-light', 'violet-dark', 'high-contrast-light', 'high-contrast-dark'],
});
```

## Provider

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
