---
title: Getting started
description: Choose a supported BeeUI evaluation path and reach a verified first screen without assuming unpublished registry artifacts.
---

BeeUI is currently **unpublished**, so the first decision is not “which package-install command do I copy?” It is which accepted consumption/evidence path you need today. This page gets you from a clean checkout to a real BeeUI surface and then points to the exact external-consumer contract that will remain valid when publication opens.

:::caution[Public distribution is closed]
No `@beemvp/beeui-*` package or BeeUI CLI should be assumed to resolve from the public npm registry. Repository examples use packed artifacts or owned source on purpose. Publication state is machine-checked from the release policy.
:::

## Choose your goal

| Goal | Start here | What it proves |
| --- | --- | --- |
| See the complete component/pattern runtime quickly | [Showcase](/showcase/) | real Expo/Web Showcase; native preview path when local toolchain/device is available |
| Evaluate an Expo package consumer | [Expo](/docs/getting-started/expo/) | isolated packed-package + Expo Metro export |
| Evaluate without Expo | [Bare React Native](/docs/getting-started/bare-react-native/) | isolated packed-package + bare RN Metro bundles |
| Evaluate standalone Web | [Web](/docs/getting-started/web/) | isolated packed-package + Vite/RNW production build |
| Own component source | [Registry/source ownership](/docs/registry/) | repository-local inspect/add/diff/update workflow |
| Inspect a coherent product app | [Demo](/demo/) | routed Dashboard/Records/Detail/Schedule/Settings reference app |

## Fastest repository proof

```bash
corepack enable
pnpm install --frozen-lockfile

# build package boundaries
pnpm build

# static docs + Web surfaces
pnpm docs:build
pnpm --filter @beemvp/beeui-showcase build:web
pnpm --filter @beemvp/beeui-demo build:web

# repository quality gates
pnpm typecheck
pnpm test
```

These are repository commands, not external package-install instructions.

## First BeeUI shell

Every application root mounts `BeeUIProvider`, while safe-area edge ownership remains explicit:

```tsx
import {
  AppHeader,
  BeeUIProvider,
  BottomActionBar,
  SafeArea,
  Screen,
} from '@beemvp/beeui-ui';

export function AppShell() {
  return (
    <BeeUIProvider>
      <Screen>
        <SafeArea edges={['top', 'left', 'right']}>
          <AppHeader title="BeeUI" />
        </SafeArea>
        <SafeArea className="flex-1" edges={['left', 'right']}>
          {/* application content */}
        </SafeArea>
        <SafeArea edges={['bottom', 'left', 'right']}>
          <BottomActionBar>{/* actions */}</BottomActionBar>
        </SafeArea>
      </Screen>
    </BeeUIProvider>
  );
}
```

Read [Provider & safe area](/docs/getting-started/provider-safe-area/) for nested providers, overlay scopes, Toast ownership and edge rules.

## Package boundary vs. source ownership

### Package boundary

Use this when you want BeeUI maintained behind package exports. While public publication is closed, the clean-consumer fixtures create real package tarballs with `pnpm pack` and install those into isolated apps. This catches deep-import/workspace fallbacks that a monorepo-only demo would miss.

Executable authorities:

- `examples/expo-package-consumer`;
- `examples/bare-rn-consumer`;
- `examples/web-consumer`;
- clean-consumer CI verification scripts.

### Source ownership

Use this when you want selected BeeUI source committed into your own repository and reviewed/modified there. BeeUI's repository-local Registry CLI owns inspect/add/diff/update semantics. Source ownership changes who owns the source file; it does **not** create a different accessibility/behavior/token contract.

See [Registry/source ownership](/docs/registry/).

## Verify the evidence you actually need

BeeUI deliberately distinguishes:

- **deterministic contract tests** — props/state/semantics/geometry logic;
- **bundle evidence** — module/package resolution and bundler output;
- **native compile evidence** — Gradle/Xcode acceptance;
- **browser runtime evidence** — keyboard/focus/visual/accessibility behavior on Web;
- **native runtime/device evidence** — actual simulator/device interaction and assistive technology.

A passing Expo export or bare Metro bundle is not native runtime proof. A Web preview is not iOS/Android proof. Public docs label the evidence class instead of collapsing them into a generic “supported” badge.

## Next steps

1. Verify exact versions in [Compatibility](/docs/compatibility/).
2. Learn semantic customization in [Theming](/docs/theming/).
3. Browse [Components](/docs/components/) and [Patterns](/docs/patterns/).
4. Read [Accessibility](/docs/accessibility/) and [Responsive layout](/docs/responsive/) before shipping a production shell.
5. Use [Troubleshooting](/docs/troubleshooting/) if a clean consumer does not match the accepted fixture.
