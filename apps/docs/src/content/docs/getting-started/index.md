---
title: Getting started
description: Evaluate BeeUI, choose a supported platform path, and render a first screen without assuming unpublished registry artifacts.
---

This is the canonical BeeUI entry point for first-time developers. Platform-specific setup lives in the sibling pages linked below, and exact version/support values are owned by the compatibility contract rather than duplicated here.

:::caution[Public package gate is closed]
BeeUI is currently **unpublished**. Do not treat `npm install`, `pnpm add`, or public `npx` commands for `@beemvp/beeui-*` as available distribution paths. Until publication is explicitly opened, use the repository, Showcase/demo, packed consumer fixtures, or the repository-local source-ownership workflow.
:::

## Choose your path

- **Evaluate without installing:** inspect [Showcase & preview](/showcase/) and the repository source.
- **[Expo](/getting-started/expo/):** use the accepted Showcase/consumer fixtures to understand Expo integration.
- **[Bare React Native](/getting-started/bare-react-native/):** follow the bare consumer boundary and native dependency expectations.
- **[Web](/getting-started/web/):** follow the React Native Web/theme-CSS path actually exercised by repository tests.
- **[CLI & source ownership](/cli/):** own component source through the repository-local Registry workflow while public CLI publication remains closed.

## Repository evaluation setup

The commands below bootstrap this repository; they are **not** package-install instructions for an external application.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm docs:build
pnpm --filter @beemvp/beeui-showcase build:web
pnpm --filter @beemvp/beeui-demo build:web
```

## Provider and safe-area contract

Every BeeUI application root should mount `BeeUIProvider`. It supplies the shared safe-area measurement context plus accepted Toast/anchored-overlay runtime services. BeeUI does not silently add app-shell safe-area padding: shell surfaces opt in with explicit `SafeArea` boundaries.

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

`Screen`, `AppHeader`, and `BottomActionBar` do not own safe-area behavior themselves. See [Provider & safe area](/getting-started/provider-safe-area/) for the ownership model.

## Verify repository changes

```bash
pnpm typecheck
pnpm test
```

## Next steps

- [Theming](/theming/) for semantic tokens, branding, and density.
- [Components](/components/) for the public component catalog.
- [Compatibility](/compatibility/) for exact tested platform/toolchain versions.
- [Showcase & preview](/showcase/) to inspect real runtime behavior.
