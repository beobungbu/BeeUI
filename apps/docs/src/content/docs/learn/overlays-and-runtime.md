---
title: Overlays & runtime ownership
description: The provider tree behind Dialog, Sheet, Popover, DropdownMenu, Select, Tooltip and Toast — and why two of its runtimes nest differently.
---

Overlays are not standalone components: they are **clients of two provider-owned runtimes** that `BeeUIProvider` installs at the application root — one for anchored/modal overlays, one for transient notifications.

## Why the concept exists

An overlay has to answer questions no single component can answer alone. Which layer does this `Escape` close? Where is "the anchor", when the trigger is inside a dialog that is itself inside a scroll view? Which viewport does this toast render into?

Those are arbitration questions, and arbitration needs one authority. That authority is the runtime, and the runtime lives in the provider — which is why "mount exactly one `BeeUIProvider` at the root" is a correctness rule rather than a setup convenience.

## The provider tree

```
BeeUIProvider                       ← the only public entry point
└── safe-area measurement           react-native-safe-area-context
    └── Toast runtime               queue · announcements · viewport
        └── overlay runtime         root scope (depth 0) · host · transport ·
            │                       dismiss stack · active-scope coordinator
            └── Uniwind inset bridge
                └── your application
                    └── Dialog / Sheet          → open a deeper modal scope + host
                        └── Popover / DropdownMenu / Select / Tooltip
                                                → anchor to the nearest host
```

Two families sit on that runtime, and they are deliberately different primitives. **Modal-class surfaces** (`Dialog`, `AlertDialog`, and the native `Sheet`) establish a modal boundary: a nested host, a deeper dismissal scope and their own geometry origin. **Anchored surfaces** (`Popover`, `DropdownMenu`, `Select`, `Tooltip`) position against a trigger inside whichever host is nearest.

Dismissal resolves to the **deepest active scope**, with ties at equal depth broken by most recent activation. One `Escape` or one Android back press therefore closes the innermost overlay, not the outermost.

## The nesting asymmetry

The two runtimes behave differently when a second `BeeUIProvider` appears in the tree, and this is the single most surprising thing on this page:

| Runtime | Nested provider behavior | Consequence |
| --- | --- | --- |
| **Overlay** | Detects a parent runtime and **yields to it** — it renders children and installs nothing | Depth arbitration, the dismiss stack and the platform back/`Escape` listener stay single-rooted, so a nested provider cannot create a competing overlay authority |
| **Toast** | **Always establishes a new runtime**, with its own queue and its own viewport | `useToast()` resolves to the *nearest* runtime; toasts raised under a nested provider queue and render there, not in the root viewport |

That asymmetry is intentional. Overlay dismissal is a global, physical-input concern — two roots listening for the back button would fight. A toast viewport is a local rendering concern, and a nested scope that wants its own is expressing a real requirement.

It is also the explanation for a bug that otherwise looks impossible: **a toast that fires without an error and never appears.** It went to a nested runtime whose viewport is offscreen, clipped or unmounted.

## Rules and invariants

1. **One `BeeUIProvider` at the application root**, mounted above the router. Overlays rendered outside any provider throw — the error names the provider explicitly.
2. **A nested provider is not a layout or styling primitive.** Use it only when a documented provider-scoped behavior requires it; use `BeeThemeScope` for scoped theming.
3. **Do not build a second global overlay root or a second global toast store.** The runtime already owns the queue and the dismiss stack; a parallel store gives you two sources of truth that disagree.
4. **Keep triggers and content in their documented composition.** Hoisting `PopoverTrigger` away from `PopoverContent` breaks anchoring, dismissal and focus restoration at once — see [Composition model](/docs/learn/composition-model/).
5. **Geometry is measured against the nearest host.** An overlay opened inside a `Dialog` positions against the dialog, not the window. That is what keeps it on screen when the dialog is not centered.
6. **Controlled `open` does not opt you out of arbitration.** The runtime still decides which layer a dismissal reaches; your `onOpenChange` is how you are told. See [State model](/docs/learn/state-model/).
7. **The portal transport is platform-specific and internal.** Web uses a DOM portal; React Native's New Architecture uses a teleport transport that preserves context equivalently. A legacy fallback path exists as a defensive measure only — it is not a recommended deployment target, and arbitrary consumer context preservation is not promised there.

## Consequences for application code

- **Mount the provider above the router.** Overlays opened from any route must resolve to the same runtime, and a provider mounted per-screen defeats that.
- **Expect Web and native to differ in evidence, not in API.** Overlay dismissal, hardware back and native sheet gestures are simulator/device questions — see [Cross-platform model](/docs/learn/cross-platform-model/).
- **Reach for `useToast()`, not a notification component.** The runtime owns queueing, duration, announcements, safe-area-aware stacking and the viewport; you supply the message.
- **When testing overlays, wrap the tree under test in `BeeUIProvider`.** A missing provider in a test harness produces exactly the same error as a missing provider in an app.
- **Layer order is a token contract.** Toasts sit above anchored overlays by design; do not restack them with ad-hoc `zIndex` values.

## Common misconception

> "A `Dialog` is just an absolutely positioned view, so I can portal it wherever I like."

Moving an overlay outside its host removes it from the scope that arbitrates its dismissal and from the geometry origin that positions it. Nothing type-checks as broken; the failure appears as `Escape` closing the wrong layer, or a popover anchored to the window instead of the dialog.

The second misconception is that nesting `BeeUIProvider` "scopes" overlays. It does not — the overlay runtime yields to the parent — while it silently *does* scope toasts. If you nested a provider expecting overlay isolation, you got neither what you wanted nor what you expected.

## Where to go next

- [Provider & safe area](/docs/start/provider-safe-area/) — the executable setup, verification checklist and failure table.
- [Ownership model](/docs/learn/ownership-model/) — the wider boundary this runtime sits inside.
- [Composition model](/docs/learn/composition-model/) — why trigger and content must stay together.
- [Accessibility model](/docs/learn/accessibility-model/) — modal boundaries and focus restoration.
- [Dialog](/docs/components/reference/dialog/) · [Sheet](/docs/components/reference/sheet/) · [Popover](/docs/components/reference/popover/) · [Dropdown menu](/docs/components/reference/dropdown-menu/) · [Select](/docs/components/reference/select/) · [Tooltip](/docs/components/reference/tooltip/) · [Toast](/docs/components/reference/toast/)
- [Troubleshooting](/docs/guides/troubleshooting/) — when an overlay is already misbehaving.

## Source authority

- [`packages/ui/src/components/safe-area.tsx`](https://github.com/beobungbu/BeeUI/blob/main/packages/ui/src/components/safe-area.tsx) — the provider composition order.
- [`packages/ui/src/components/overlay-runtime.tsx`](https://github.com/beobungbu/BeeUI/blob/main/packages/ui/src/components/overlay-runtime.tsx) — scope, host, dismissal and the parent-yielding behavior.
- [`packages/ui/src/components/toast.tsx`](https://github.com/beobungbu/BeeUI/blob/main/packages/ui/src/components/toast.tsx) — the toast runtime and viewport.
- [`docs/anchored-overlays.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/anchored-overlays.md) — the canonical overlay and dismissal contract.
