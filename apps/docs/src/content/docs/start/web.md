---
title: Web
description: Evaluate BeeUI with React Native Web through the maintained Vite consumer.
---

BeeUI's standalone Web consumer uses Vite + React Native Web with no Expo runtime and no Showcase internals. It consumes the same packed package boundary as other clean consumers and produces a normal production Web bundle.

:::caution[Distribution gate]
BeeUI is unpublished. The repository fixture installs locally packed BeeUI tarballs; this page does not imply public package availability.
:::

## 1. Build the independent Web consumer

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build

cd examples/web-consumer
bash setup.sh
npm run build
npm run preview
```

`setup.sh` packs BeeUI into tarballs and installs them into the isolated fixture. `npm run build` runs the fixture's Vite production build. `preview` is optional and serves that built output locally.

## 2. Import the semantic theme once

The accepted Web consumer imports the BeeUI semantic CSS from its CSS entry:

```css
@import 'tailwindcss';
@import 'uniwind';
@import '@beemvp/beeui-tokens/theme.css';
```

The exact source scanning/bundler aliases belong to the maintained consumer fixture because they can change with the styling/toolchain integration. Public component behavior does not depend on Vite itself.

## 3. Mount BeeUI like native

```tsx
import {
  BeeUIProvider,
  Button,
  SafeArea,
  Screen,
  Text,
} from '@beemvp/beeui-ui';

export function App() {
  return (
    <BeeUIProvider>
      <Screen>
        <SafeArea edges={['top', 'left', 'right']} className="flex-1">
          <Text variant="title">BeeUI on Web</Text>
          <Button>Continue</Button>
        </SafeArea>
      </Screen>
    </BeeUIProvider>
  );
}
```

The same component imports are used across Web and native. Platform differences are documented at the behavior-contract level instead of requiring separate component APIs.

## 4. Know what the Web gate proves

The clean consumer proves **package-boundary resolution + Vite/RNW production bundling**. BeeUI separately runs browser integration, accessibility and visual-regression lanes against richer surfaces. A Web result never substitutes for iOS/Android runtime evidence.

For live Web inspection, open [Showcase](/showcase/). For a realistic routed app, open [Demo](/demo/). Read [Compatibility → Web](/docs/compatibility/web/) for the tested support contract.

## Source authority

- [`examples/web-consumer`](https://github.com/beobungbu/BeeUI/tree/main/examples/web-consumer) — independent Vite/RNW consumer.
- [`scripts/verify-web-consumer.sh`](https://github.com/beobungbu/BeeUI/blob/main/scripts/verify-web-consumer.sh) — CI clean-consumer authority.
- [`docs/web-support-contract.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/web-support-contract.md) — Web support/evidence contract.
