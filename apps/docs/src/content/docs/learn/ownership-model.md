---
title: Ownership model
description: Which decisions belong to BeeUI, which belong to your application, and how to tell when a boundary has been crossed.
---

Every responsibility in a BeeUI screen belongs to exactly one owner: **BeeUI owns component behavior, semantic tokens and the provider/overlay runtime; your application owns routing, data, domain state and product policy.**

## Why the concept exists

Almost every hard bug people hit with a UI system is an ownership bug rather than a rendering bug: two safe-area layers both claiming the top inset, a second global toast store mirroring BeeUI's, an application state machine fighting a component's internal open state. None of those produce a clean error. They produce a screen that is *slightly* wrong, on one platform, sometimes.

Drawing the boundary once, explicitly, turns those into questions with an answer.

## The boundary

```
                        ┌─────────────────────────────────────────┐
   application owns ──► │ router · navigation IA · data fetching  │
                        │ auth · analytics · business policy      │
                        │ domain state · persistence · validation │
                        │ which shell surface claims which inset  │
                        └──────────────────┬──────────────────────┘
                                           │ props, callbacks, children
                        ┌──────────────────▼──────────────────────┐
        BeeUI owns ──►  │ component behavior + variants           │
                        │ accessibility semantics per contract    │
                        │ semantic tokens, theme, density         │
                        │ provider/overlay/toast runtime          │
                        │ reusable screen composition patterns    │
                        └─────────────────────────────────────────┘
```

The interface between the two halves is ordinary React: props in, callbacks out, children for composition. There is no hidden channel, no global store you must adopt, and no BeeUI-specific data layer.

### BeeUI owns

| Responsibility | What that means concretely |
| --- | --- |
| Component behavior | Press, focus, selection, dismissal, keyboard interaction and the accessibility semantics each component's contract states. |
| Semantic tokens and themes | Color roles, typography scale, spacing, radius, density metrics, breakpoint constants — see [Theming](/docs/theming/). |
| Provider and overlay infrastructure | Safe-area measurement, the anchored-overlay runtime and host, dismissal arbitration, the toast runtime and viewport. |
| Reusable screen composition | The [pattern library](/docs/patterns/) — real composed screens you copy and adapt. |

### Your application owns

| Responsibility | Why BeeUI stays out |
| --- | --- |
| Routing and navigation IA | A router is an architectural commitment with real lock-in; BeeUI components work under any of them. |
| Data, backend and persistence | BeeUI never fetches, caches or stores your data. |
| Domain state and business logic | Including *most* component state — see [State model](/docs/learn/state-model/). |
| Validation rules | BeeUI renders invalid state; it does not decide what invalid means. See [Forms model](/docs/learn/forms-model/). |
| Auth, analytics, policy | Product decisions, not presentation decisions. |
| Safe-area edge assignment | Only your shell knows which surface touches which system edge. |

## Rules and invariants

1. **One owner per system edge.** Exactly one `SafeArea` claims `top`; exactly one claims `bottom`. `SafeArea` defaults to *all* edges, so an unqualified nested `SafeArea` is how doubled insets happen.
2. **One `BeeUIProvider` at the application root**, mounted above the router. Nested providers are for documented provider-scoped behavior, never for layout or styling scope.
3. **Do not mirror runtime state.** BeeUI's toast runtime already owns the queue; a parallel application-global toast store produces two sources of truth and a viewport that disagrees with your state.
4. **State that has business meaning is yours.** If losing the value on unmount would be a bug, it belongs in your state, passed in as a controlled prop.
5. **Layout composition is application work.** `Screen`, `AppHeader`, `BottomActionBar` and `SafeArea` are unopinionated surfaces; they add no implicit system inset padding of their own so your shell stays predictable.

## Consequences for application code

A correctly owned shell reads like this — BeeUI surfaces, application decisions:

```tsx
import {
  AppHeader,
  BeeUIProvider,
  BottomActionBar,
  Button,
  SafeArea,
  Screen,
} from '@beemvp/beeui-ui';

export function AppShell({ children, onSave, title }: AppShellProps) {
  return (
    <BeeUIProvider>
      <Screen>
        <SafeArea edges={['top', 'left', 'right']}>
          {/* `title` comes from your router — BeeUI never reads route state */}
          <AppHeader title={title} />
        </SafeArea>

        <SafeArea className="flex-1" edges={['left', 'right']}>
          {children}
        </SafeArea>

        <SafeArea edges={['bottom', 'left', 'right']}>
          <BottomActionBar>
            {/* `onSave` is your domain logic; BeeUI only owns the press contract */}
            <Button onPress={onSave}>Save</Button>
          </BottomActionBar>
        </SafeArea>
      </Screen>
    </BeeUIProvider>
  );
}
```

Three surfaces, three different edge claims, and every product decision arriving as a prop.

## Common misconception

> "The library should just handle safe area for me."

It cannot, and the reason is structural: only your shell knows whether the header, a full-screen map, a native sheet or the router's own container is the thing touching the notch on this route. A library that applied insets implicitly would be right on the simplest screen and wrong on every screen with a custom presentation — and the failure is silent on Web, because browsers report no system insets. That bug then appears on the first device run.

The related anti-pattern is the **blanket wrapper**: one `SafeArea` around the entire application. It looks tidy, and it breaks the moment header, body and footer need different ownership.

## Where to go next

- [Provider & safe area](/docs/start/provider-safe-area/) — the executable version of these rules, with the failure table.
- [Overlays & runtime ownership](/docs/learn/overlays-and-runtime/) — provider-tree ownership in detail.
- [State model](/docs/learn/state-model/) — where component state should live.
- [Patterns](/docs/patterns/) — composed screens that already respect this boundary.
- [Reference app](/docs/reference-app/) and the running [demo](/demo/) — the boundary at production scale.
- [Troubleshooting](/docs/guides/troubleshooting/) — when a boundary has already been crossed.

## Source authority

- [`packages/ui/src/components/safe-area.tsx`](https://github.com/beobungbu/BeeUI/blob/main/packages/ui/src/components/safe-area.tsx) — `BeeUIProvider` and `SafeArea`.
- [`docs/architecture.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/architecture.md) — the boundary contract.
- [`docs/responsive-layout.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/responsive-layout.md) — shell and layout responsibilities.
