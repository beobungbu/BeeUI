---
title: Expo
description: Evaluate and integrate BeeUI through the accepted Expo package boundary.
---

BeeUI's accepted Expo path is exercised on Expo SDK 57 with the same public package boundary intended for external consumers. Because BeeUI is currently unpublished, the repository's `examples/expo-package-consumer` fixture packs the three BeeUI packages into tarballs before installing them into an isolated Expo app. That is the executable onboarding authority today.

:::caution[Distribution gate]
The BeeUI packages and BeeUI CLI are not published to the public npm registry yet. The workflow below is intentionally repository-local and uses packed artifacts; no public package-install command is implied.
:::

## 1. Prove the clean Expo consumer

From a clean checkout:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build

cd examples/expo-package-consumer
bash setup.sh
bash bundle.sh
```

`setup.sh` packs `@beemvp/beeui-core`, `@beemvp/beeui-tokens`, and `@beemvp/beeui-ui`, then installs the tarballs plus the pinned Expo/native peers into the isolated fixture. `bundle.sh` runs Expo's headless export for Android, iOS, and Web.

For an interactive local session after `setup.sh`:

```bash
npx expo start
```

Use Expo's normal `i`, `a`, or `w` targets when the matching simulator/emulator/browser environment is available.

## 2. Wire the styling entry

The accepted fixture imports Tailwind, Uniwind, and BeeUI's semantic Web/theme output once:

```css
@import 'tailwindcss';
@import 'uniwind';
@import '@beemvp/beeui-tokens/theme.css';

@source '../node_modules/@beemvp/beeui-core/src';
@source '../node_modules/@beemvp/beeui-ui/src';
```

Its Metro config uses Uniwind's supported wrapper and points to the same CSS entry:

```js
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

module.exports = withUniwindConfig(getDefaultConfig(__dirname), {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
  extraThemes: [
    'violet-light',
    'violet-dark',
    'high-contrast-light',
    'high-contrast-dark',
  ],
});
```

Treat the fixture files as executable source if these details change; the public guide is guarded against drifting away from them.

## 3. Mount BeeUIProvider and explicit safe areas

```tsx
import './global.css';

import {
  BeeUIProvider,
  Button,
  SafeArea,
  Screen,
  Text,
} from '@beemvp/beeui-ui';

export default function App() {
  return (
    <BeeUIProvider>
      <Screen>
        <SafeArea edges={['top', 'left', 'right']} className="flex-1">
          <Text variant="title">BeeUI on Expo</Text>
          <Button>Continue</Button>
        </SafeArea>
      </Screen>
    </BeeUIProvider>
  );
}
```

`BeeUIProvider` supplies accepted runtime services; `SafeArea` is still an explicit application-owned edge boundary. Read [Provider & safe area](/docs/start/provider-safe-area/) before building an app shell.

## 4. Understand what the fixture proves

The Expo consumer's acceptance is **package-boundary + Metro export evidence** for Android, iOS, and Web. A successful export is not a native simulator/device interaction result and must not be reported as one.

For live component/pattern inspection use [Showcase](/showcase/). For a routed application use [Demo](/demo/). Exact platform/toolchain support lives in [Compatibility](/docs/compatibility/).

## Source authority

- [`examples/expo-package-consumer`](https://github.com/beobungbu/BeeUI/tree/main/examples/expo-package-consumer) — isolated executable consumer.
- [`apps/showcase`](https://github.com/beobungbu/BeeUI/tree/main/apps/showcase) — full Expo runtime surface.
- [`docs/compatibility-matrix.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/compatibility-matrix.md) — tested version contract.
