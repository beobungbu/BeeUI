---
title: Bare React Native
description: Evaluate BeeUI in a true bare React Native consumer without an Expo runtime.
---

BeeUI maintains a true bare React Native consumer independently of the Expo runtime. The accepted fixture regenerates a pinned native project, overlays the BeeUI-specific source/config, packs the BeeUI packages, installs those tarballs, and bundles Android and iOS through Metro.

:::caution[Distribution gate]
BeeUI is unpublished. The commands below use the repository's isolated packed-artifact fixture; they are not public-registry installation instructions.
:::

## 1. Run the isolated bare consumer

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build

cd examples/bare-rn-consumer
bash setup.sh
bash bundle.sh
```

`setup.sh` uses the pinned React Native Community CLI/RN versions to regenerate the native project, applies `src-overrides/`, then installs packed BeeUI artifacts plus the native peer set. `bundle.sh` produces non-empty Android and iOS Metro bundles without an Expo runtime.

## 2. Keep BeeUI-specific source reviewable

The generated `android/`/`ios/` native project tree is deliberately reproducible rather than treated as BeeUI documentation. The stable integration source lives in the fixture's `src-overrides/` files:

- `App.tsx` — provider/components and Android Back example;
- `index.js` — application registration;
- `metro.config.js` — Metro + Uniwind integration;
- `global.css` — Tailwind/Uniwind/BeeUI semantic theme entry.

For a real application, own your generated native project as normal; the fixture only separates regenerable CLI boilerplate from the BeeUI integration contract.

## 3. Provider/safe-area shell

The application-side shape stays the same as Expo:

```tsx
import {
  BeeUIProvider,
  SafeArea,
  Screen,
  Text,
} from '@beemvp/beeui-ui';

export function App() {
  return (
    <BeeUIProvider>
      <Screen>
        <SafeArea edges={['top', 'left', 'right', 'bottom']} className="flex-1">
          <Text variant="title">BeeUI on bare React Native</Text>
        </SafeArea>
      </Screen>
    </BeeUIProvider>
  );
}
```

Native dependencies used by a selected component remain normal application dependencies. The executable fixture is the authority for the currently tested peer set; do not copy an old dependency list from a blog post or release note.

## 4. Evidence boundary

A passing `bundle.sh` proves **packed-package resolution + bare Metro bundling** for Android and iOS. It is not equivalent to Gradle/Xcode native compilation and not equivalent to simulator/device interaction. BeeUI's heavier CI/native-runtime evidence is classified separately.

See [Compatibility](/docs/compatibility/) for supported versions and [Accessibility](/docs/accessibility/) for what deterministic, compile, browser, and device evidence each claim uses.

## Source authority

- [`examples/bare-rn-consumer`](https://github.com/beobungbu/BeeUI/tree/main/examples/bare-rn-consumer) — maintained isolated starter.
- [`scripts/verify-bare-consumer.sh`](https://github.com/beobungbu/BeeUI/blob/main/scripts/verify-bare-consumer.sh) — heavier CI consumer verification.
- [`docs/native-verification.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/native-verification.md) — native evidence taxonomy.
