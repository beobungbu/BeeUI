---
title: Provider & safe area
description: BeeUIProvider runtime ownership, explicit safe areas, overlays, and Toast scope.
---

`BeeUIProvider` establishes BeeUI's application runtime boundary. It measures safe-area insets, synchronizes the accepted theme/safe-area runtime integrations, owns the root anchored-overlay scope, and provides the Toast runtime/viewport. It **does not** decide which application shell surface should consume an inset.

`SafeArea` is the explicit caller-owned boundary for that decision.

## Root setup

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
          {/* scrollable/routed application content */}
        </SafeArea>

        <SafeArea edges={['bottom', 'left', 'right']}>
          <BottomActionBar>{/* actions */}</BottomActionBar>
        </SafeArea>
      </Screen>
    </BeeUIProvider>
  );
}
```

`Screen`, `AppHeader`, and `BottomActionBar` add no implicit system inset padding. This avoids double-insetting when navigation, media, maps, sheets, or nested shells already own an edge.

## Edge ownership rules

1. Assign each physical system edge to the shell surface that actually touches it.
2. Do not wrap an entire application in a second blanket safe-area padding layer when header/body/footer need different ownership.
3. Nested content that does not touch a system edge normally does not need a `SafeArea`.
4. Re-check ownership when a route changes presentation (for example a full-screen media surface or native sheet).

## Nested BeeUIProvider behavior

A nested `BeeUIProvider` does not create a competing application-global overlay system. Providers reuse the accepted application-root overlay runtime so anchored overlays can arbitrate modal depth consistently. This prevents a later-opened root overlay from stealing dismissal/focus behavior from a child overlay inside a Dialog.

Use a nested provider only when a documented provider-scoped behavior actually requires it; it is not a layout primitive.

## Overlay scopes

`Popover` and `DropdownMenu` use BeeUI's anchored-overlay runtime. The root scope is depth `0`; modal boundaries create deeper local scopes. Dismissal chooses the deepest active scope, and native host/anchor geometry is measured relative to the nearest accepted host.

On Web the portal transport preserves React context through DOM portals. On supported native New Architecture builds the accepted teleport transport preserves context. The legacy defensive fallback is not a recommended deployment target and arbitrary consumer context preservation is not promised there.

Read the full [anchored-overlay contract](https://github.com/beobungbu/BeeUI/blob/main/docs/anchored-overlays.md) before building custom modal/portal infrastructure around BeeUI.

## Toast scope

`useToast()` resolves to the nearest accepted provider runtime. The provider owns queueing, persistence/action behavior, announcements, safe-area-aware stacking and the viewport. Do not create a second app-global Toast store merely to mirror BeeUI state.

```tsx
import { Button, useToast } from '@beemvp/beeui-ui';

export function SaveButton() {
  const toast = useToast();
  return (
    <Button
      onPress={() => toast.show({
        title: 'Saved',
        description: 'Your changes are ready.',
        variant: 'success',
      })}
    >
      Save
    </Button>
  );
}
```

## Platform/evidence note

Safe-area/provider deterministic tests prove ownership/geometry contracts; native compilation proves code builds; representative device/simulator evidence is classified separately. Do not infer live notch, keyboard, sheet, or assistive-technology behavior from a unit test alone.

Next: choose [Expo](/docs/start/expo/), [Bare React Native](/docs/start/bare-react-native/), or [Web](/docs/start/web/), then verify exact versions in [Compatibility](/docs/compatibility/).
