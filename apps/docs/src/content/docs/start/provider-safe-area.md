---
title: Provider & safe area
description: What BeeUIProvider owns at runtime, how safe-area edge ownership works, and how overlay and Toast scopes resolve.
---

Every BeeUI application mounts exactly one `BeeUIProvider` at its root. This page is the runtime mental model behind that line: what the provider owns, what it deliberately does not own, and how the two most common onboarding failures — a missing provider and a doubled inset — actually present.

Read this after you have a platform guide running: [Expo](/docs/start/expo/), [Bare React Native](/docs/start/bare-react-native/) or [Web](/docs/start/web/).

## What BeeUIProvider owns

`BeeUIProvider` is BeeUI's application-root integration. It composes three runtimes in a fixed order:

```
BeeUIProvider
├── safe-area measurement            (react-native-safe-area-context)
│   └── Toast runtime                (queue, announcements, viewport)
│       └── anchored-overlay runtime (root scope, depth 0, host + transport)
│           └── Uniwind inset bridge (keeps pt-safe / bottom-safe in sync)
│               └── your application
```

Concretely, it owns:

- **inset measurement** — window metrics are seeded synchronously so the first frame is not misplaced;
- **the Uniwind inset bridge** — safe-area utility classes such as `pt-safe` stay in sync with measured insets. Turn this off with `syncUniwindInsets={false}` only when your application already owns that bridge;
- **the root anchored-overlay scope** — depth `0`, plus the host and portal transport that `Popover`, `DropdownMenu`, `Select`, `Tooltip`, `Dialog` and `Sheet` measure and mount against;
- **the Toast runtime** — queueing, persistence and action behavior, announcements, safe-area-aware stacking, and the viewport itself.

What it does **not** own: which surface in your shell consumes which system inset. That decision is yours, and `SafeArea` is where you make it.

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

Three surfaces, three different edge claims. `Screen`, `AppHeader` and `BottomActionBar` add no implicit system inset padding of their own — that is what makes this composition predictable when navigation, media, maps, sheets or nested shells already own an edge.

## Safe-area ownership rules

1. Assign each physical system edge to the one shell surface that actually touches it.
2. Do not wrap the whole application in a blanket safe-area layer when the header, body and footer need different ownership.
3. Nested content that never touches a system edge normally needs no `SafeArea` at all.
4. Re-check ownership whenever a route changes presentation — a full-screen media surface or a native sheet moves which element touches the edge.
5. Be explicit with `edges`. `SafeArea` defaults to *all* edges, which is exactly the default that produces doubled insets when it is nested inside another `SafeArea`.

### The doubled-inset failure

This is the most common shell bug, and it produces no error — just a header that sits too low and a footer floating above the gesture bar:

```tsx
// Wrong: the outer SafeArea already claimed `top`, and the inner one
// defaults to every edge, so the top inset is applied twice.
<SafeArea edges={['top', 'left', 'right']}>
  <SafeArea>
    <AppHeader title="BeeUI" />
  </SafeArea>
</SafeArea>
```

```tsx
// Right: one owner per edge.
<SafeArea edges={['top', 'left', 'right']}>
  <AppHeader title="BeeUI" />
</SafeArea>
```

The tell is a gap roughly equal to the status-bar or home-indicator height that scales with the device rather than with your spacing tokens. On Web there is usually no visible symptom, because browsers report no system insets — which is why this bug survives a Web-only review and appears on the first device.

## Nested BeeUIProvider behavior

A nested `BeeUIProvider` does not create a competing application-global overlay system. The overlay runtime detects an existing parent runtime and yields to it, so anchored overlays keep arbitrating modal depth from a single root. That is what stops a later-opened root overlay from stealing dismissal or focus behavior from a child overlay inside a `Dialog`.

The Toast runtime does not de-duplicate the same way: a nested provider establishes a nearer Toast runtime, and `useToast()` inside it resolves to that nearer one. Toasts raised there queue and render in the nested scope, not the root viewport.

Use a nested provider only when a documented provider-scoped behavior genuinely requires it. It is not a layout primitive, and it is not the way to scope styling.

## Overlay scopes

`Popover`, `DropdownMenu`, `Select`, `Tooltip`, `Dialog` and `Sheet` all use BeeUI's anchored-overlay runtime.

- The root scope is depth `0`. Each modal boundary opens a deeper local scope, one level below its parent.
- Dismissal resolves to the **deepest active scope**, and ties at the same depth break by most recent activation. A single `Escape` or Android back press therefore closes the innermost overlay, not the outermost.
- Anchor and host geometry is measured relative to the nearest host, so an overlay opened inside a `Dialog` positions against the dialog rather than the window.

Transport differs by platform, and the difference is real:

- **Web** — a DOM portal that preserves React context through the portal boundary.
- **Native, New Architecture** — the teleport transport preserves context equivalently.
- **Legacy fallback** — a defensive path only. It is not a recommended deployment target, and arbitrary consumer context preservation is not promised there.

Read the full [anchored-overlay contract](https://github.com/beobungbu/BeeUI/blob/main/docs/anchored-overlays.md) before building custom modal or portal infrastructure around BeeUI.

## Toast scope

`useToast()` resolves to the nearest provider runtime. That runtime owns the queue, persistence and action behavior, announcements, safe-area-aware stacking and the viewport. Do not stand up a second application-global toast store to mirror BeeUI state.

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

`show()` requires a non-empty string `title` and throws a `TypeError` without one. It returns an id you can pass to `dismiss(id)`; `dismissAll()` clears the queue.

## Verify

| Checkpoint | How to check | Expected result |
| --- | --- | --- |
| Exactly one root provider | search your application for `BeeUIProvider` | one occurrence at the root, unless a documented provider-scoped behavior requires a nested one |
| Overlays are wired | open a `Select` or `Dialog` | it mounts and positions against the correct host, and no provider error is thrown |
| Dismissal picks the deepest scope | open a `Dialog`, open a `Select` inside it, press `Escape` | the `Select` closes and the `Dialog` stays open; a second `Escape` closes the `Dialog` |
| Toast is wired | call `toast.show({ title: 'Saved' })` | the toast appears in the viewport and clears itself on schedule |
| Edge ownership is right | run on a device or simulator with a notch and a gesture bar | header content clears the status bar, footer content clears the home indicator, and neither gap is doubled |

## Common failures

| Symptom | Cause | Fix |
| --- | --- | --- |
| `BeeUI anchored overlays require BeeUIProvider at the application root.` | an overlay component rendered outside any provider | mount one `BeeUIProvider` at the application root, above the router |
| `BeeUI toast APIs require BeeUIProvider at the application root.` | `useToast()` called outside any provider — often from a test or a Storybook-style harness | wrap the tree under test in `BeeUIProvider` |
| Header sits too low, footer floats above the gesture bar | a nested `SafeArea` re-applied an edge its parent already owned | give every `SafeArea` an explicit `edges` list, one owner per edge |
| Content hides under the notch or the home indicator | no surface claimed that edge | add the edge to the `SafeArea` that actually touches it |
| `Escape` or Android back closes the wrong overlay | a second application-global overlay root was created, or interactive children were hoisted out of their documented composition | keep one root provider and keep triggers and content in their documented composition |
| A toast fires but never appears | it was raised through a nested provider whose viewport is not visible | raise it from the root provider, or make the nested scope's viewport visible |
| `TypeError: BeeUI toast show() requires a non-empty string title.` | `show()` was called with no title or an empty one | pass a non-empty `title` |
| Safe-area utility classes such as `pt-safe` never update | the Uniwind inset bridge was disabled with `syncUniwindInsets={false}` and nothing replaced it | re-enable it, or own the bridge yourself deliberately |

## Platform and evidence notes

Provider and safe-area deterministic tests prove ownership and geometry contracts. Native compilation proves the code builds. Real notch, keyboard, sheet and assistive-technology behavior is device or simulator evidence, and it is classified separately — do not infer it from a passing unit test.

Two platform differences are worth planning around. Browsers report no system insets, so an edge-ownership bug is invisible on Web and appears on the first device run. And the Web starter deliberately uses no `SafeArea` at all: its outer container is ordinary layout.

## Next steps

- Browse [Components](/docs/components/) for the overlay, Toast and layout components this runtime serves.
- Compose real shells with [Patterns](/docs/patterns/).
- Diagnose a stuck provider or overlay in [Troubleshooting](/docs/troubleshooting/).
- Pick a platform: [Expo](/docs/start/expo/), [Bare React Native](/docs/start/bare-react-native/) or [Web](/docs/start/web/), then confirm exact versions in [Compatibility](/docs/compatibility/).

## Source authority

- [`packages/ui/src/components/safe-area.tsx`](https://github.com/beobungbu/BeeUI/blob/main/packages/ui/src/components/safe-area.tsx) — `BeeUIProvider` and `SafeArea`.
- [`docs/anchored-overlays.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/anchored-overlays.md) — the anchored-overlay and dismissal contract.
- [`docs/compatibility-matrix.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/compatibility-matrix.md) — the tested version contract.
