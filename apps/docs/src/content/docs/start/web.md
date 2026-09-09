---
title: Web
description: Install the BeeUI release candidate in a Vite + React Native Web application and verify it with a production build.
---

Use this path for a browser-first product built with Vite and React Native Web. BeeUI `0.86.2-rc.1` is public under the npm `next` dist-tag; stable `latest` is not promoted yet.

## Install

```bash
npm install @beemvp/beeui-ui@next @beemvp/beeui-core@next @beemvp/beeui-tokens@next
npm install react@19.2.3 react-dom@19.2.3 react-native@0.86.2 \
  react-native-web@0.21.0 react-native-safe-area-context@5.7.0 \
  react-native-teleport@1.1.13 tailwindcss@4.3.3 uniwind@1.10.1
npm install -D vite@8.2.2 vite-plugin-rnw@0.0.12 @tailwindcss/vite@4.3.3
```

Pin `@0.86.2-rc.1` instead of `@next` when you need an immutable RC dependency.

## Styling entry

```css
@import 'tailwindcss';
@import 'uniwind';
@import '@beemvp/beeui-tokens/theme.css';

@source './node_modules/@beemvp/beeui-core/src';
@source './node_modules/@beemvp/beeui-ui/src';
```

## Vite configuration

The maintained `examples/web-consumer` fixture is the executable authority for plugin order and React Native Web aliasing. Keep the RNW, Uniwind and Tailwind integrations aligned with that fixture.

## Application root

```tsx
import { BeeUIProvider, SafeArea, Screen, Text } from '@beemvp/beeui-ui';

export function App() {
  return (
    <BeeUIProvider>
      <Screen>
        <SafeArea edges={['top', 'bottom', 'left', 'right']}>
          <Text>BeeUI on Web</Text>
        </SafeArea>
      </Screen>
    </BeeUIProvider>
  );
}
```

## Verify

```bash
npm run build
npm run preview
```

The clean Web consumer in `examples/web-consumer` installs the package boundary without monorepo links and produces a Vite production build in CI.

## Current Web evidence boundary

The current maintained Web stack is Vite + React Native Web. Browser integration/visual evidence is Chromium-based. Do not infer Next.js, Webpack, Parcel, SSR or multi-browser support unless the corresponding compatibility page explicitly records it.
