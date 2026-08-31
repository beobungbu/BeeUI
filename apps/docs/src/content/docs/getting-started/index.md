---
title: Getting started
description: Install BeeUI, add the provider, and render your first screen.
---

This page is the canonical BeeUI quick start. It is accurate for the current repository
state; platform-specific detail lives in the sibling pages linked below.

:::note[Reference implementation]
This page is BeeUI's reference example of a complete docs page: it demonstrates the
site's navigation, code blocks, and admonitions. Other pages in this release are
intentionally stubs — see each page for what is pending.
:::

## Choose your platform

- **[Expo](/getting-started/expo/)** — the fastest path; BeeUI's own Showcase app runs on Expo SDK 57.
- **[Bare React Native](/getting-started/bare-react-native/)** — no Expo runtime dependency.
- **[Web](/getting-started/web/)** — React Native Web through Expo's web target or a standalone bundler.

## Install

BeeUI ships as source-consumed workspace packages today; publication to npm is a
release-gated milestone, not yet available. Until BeeUI 1.0 publishes, consume BeeUI
through a pnpm workspace (this repository) or the source-ownership CLI described in
[CLI & source ownership](/cli/).

```bash
corepack enable
pnpm install --frozen-lockfile
```

## Add the provider and own your safe areas

Every BeeUI application root wraps its content in `BeeUIProvider`. The provider supplies
safe-area measurement, the shared Toast runtime/viewport, and the anchored-overlay runtime
used by `Popover` and `DropdownMenu`. BeeUI never adds safe-area padding for you outside an
explicit `SafeArea` boundary, so each shell element that touches a system edge (a header, the
scrollable body, a bottom action bar) opts in explicitly:

```tsx
import {
  AppHeader,
  BeeUIProvider,
  BottomActionBar,
  SafeArea,
  Screen,
} from '@beemvp/beeui-ui';

function AppShell() {
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

`Screen`, `AppHeader`, and `BottomActionBar` own no safe-area behavior themselves — see
[Provider & safe area](/getting-started/provider-safe-area/) for the full ownership model.

## Verify your setup

```bash
pnpm typecheck
pnpm test
```

## Next steps

- [Theming](/theming/) to apply your brand's tokens and choose a density.
- [Components](/components/) for the full component catalog.
- [Compatibility](/compatibility/) to confirm your React Native/React/Node versions are supported.
