---
title: Bare React Native
description: Install the BeeUI release candidate in a true bare React Native 0.86 application and verify native bundles without Expo.
---

Use this path for a React Native application that does not use the Expo runtime. BeeUI `0.86.2-rc.1` is public under the npm `next` dist-tag; stable `latest` is not promoted yet.

## Install

```bash
npm install @beemvp/beeui-ui@next @beemvp/beeui-core@next @beemvp/beeui-tokens@next
npm install react@19.2.3 react-dom@19.2.3 react-native@0.86.2 \
  react-native-safe-area-context@5.7.0 react-native-teleport@1.1.13 \
  tailwindcss@4.3.3 uniwind@1.10.1
```

Pin `@0.86.2-rc.1` instead of `@next` when you need an immutable RC dependency.

Optional native peers for `Sheet`, `DatePicker` and `DateTimePicker` are listed in [Compatibility](/docs/compatibility/).

## Styling entry

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
