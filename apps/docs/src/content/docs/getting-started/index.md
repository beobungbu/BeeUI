---
title: Getting started
description: Install BeeUI, add the provider, and render your first screen.
---

This page is the canonical BeeUI quick start. It reflects the current repository release
candidate (`20260902.0.0`); platform-specific detail lives in the sibling pages linked below.

## Choose your platform

- **[Expo](/getting-started/expo/)** — the fastest path; BeeUI's own Showcase app runs on Expo SDK 57.
- **[Bare React Native](/getting-started/bare-react-native/)** — use BeeUI in a native application with the supported React Native toolchain.
- **[Web](/getting-started/web/)** — React Native Web through Expo's web target or a standalone bundler.

## Install

Public npm publication is still owner-gated, so `@beemvp/beeui-ui` is not yet a public
consumer install contract. Until publication completes, use BeeUI from this repository's
pnpm workspace or follow the source-ownership workflow in
[CLI & source ownership](/cli/).

```bash
corepack enable
pnpm install --frozen-lockfile
```

After the npm publication gate closes, this page will promote the public package install
command as the primary consumer path. Until then, the repository and Showcase are the
canonical executable surfaces.

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
- [Components](/components/) for the component catalog and public API guidance.
- [Showcase & preview](/showcase/) to inspect the real cross-platform implementation.
- [Compatibility](/compatibility/) to confirm your React Native/React/Node versions are supported.
