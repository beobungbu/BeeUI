---
title: Responsive model
description: BeeUI's compact-first width model — who owns breakpoints, who owns adaptation, and where components stop.
---

BeeUI is **compact-first**: every component is designed to work at the narrowest supported width, and extra width is treated as capability your *layout* opts into — not as a different design that gets shrunk.

## Why the concept exists

Two different responsive decisions get confused constantly. "Should this text wrap or truncate?" is a component decision, and BeeUI owns it. "Should navigation be a bottom tab bar or a side rail?" is an application decision, and BeeUI must not own it — the answer depends on your information architecture, not on a pixel count.

Separating the two gives you one shared width vocabulary without a library that guesses at your product's structure.

## The width model

```
      ┌── compact ───────────┬── medium ─────────┬── expanded ──────────┐
      │ the implicit base    │ breakpoint.medium │ breakpoint.expanded  │
      │ (phone portrait)     │ and wider         │ and wider            │
      └──────────────────────┴───────────────────┴──────────────────────┘
        one column             two-column or        persistent rail,
        bottom navigation      wider containers     bounded content width
```

BeeUI ships exactly two named thresholds, `breakpoint.medium` and `breakpoint.expanded`, and anything below `medium` is the implicit compact base. That is deliberately a small vocabulary: three semantic layout classes are enough to describe structural change, and a longer list invites per-screen special cases.

Read them from the tokens package rather than restating the numbers:

```ts
import { breakpoint, contentWidth, pageGutter } from '@beemvp/beeui-tokens';

export type ShellLayoutClass = 'compact' | 'medium' | 'expanded';

export function resolveShellLayoutClass(width: number): ShellLayoutClass {
  if (width >= breakpoint.expanded) return 'expanded';
  if (width >= breakpoint.medium) return 'medium';
  return 'compact';
}
```

That is the shape the production demo uses to promote a compact bottom tab bar into a persistent side rail. Alongside the breakpoints, three more token families carry the layout vocabulary: `pageGutter` for horizontal page-edge padding, `contentWidth` for bounded measure on wide viewports, and `controlSize` for the minimum interactive target.

## Rules and invariants

1. **BeeUI's breakpoint tokens are the only screen taxonomy.** Do not introduce a second set of thresholds; classify against `breakpoint` so your shell, your components and the pattern library agree.
2. **Breakpoints are build-time constants on Web.** Tailwind/Uniwind compiles them into responsive variants, so they are readable values — for example to classify a measured width — but not a runtime override surface.
3. **Use CSS variants for cosmetics, a measured width for structure.** On Web, prefer responsive utility variants for width-driven styling. Reserve a `useWindowDimensions()` read for the one structural decision utilities cannot express: which subtree renders.
4. **The page gutter composes with the safe area — it does not replace it.** Apply the gutter *inside* the safe area. See [Ownership model](/docs/learn/ownership-model/).
5. **Touch targets do not shrink with the viewport.** `controlSize.touchTarget` is the floor at every width and under every density mode. Density changes spacing and row metrics; it never reduces the accessibility obligation.
6. **Text-bearing surfaces must be able to grow.** Fixed heights on anything containing text are exceptions that need a reason — large text, long localization and RTL all change intrinsic size. See [Accessibility model](/docs/learn/accessibility-model/).
7. **Vertical scrolling is normal; horizontal page scrolling is a bug.** A wide table or code block scrolls inside its own container, not by moving the page.

## Consequences for application code

- **Your shell owns adaptation; components own their own fit.** Decide navigation chrome, column count and container width once in the shell. Do not pass a "layout class" down into leaf components so each one can re-decide.
- **Bound the measure on wide viewports.** A form stretched to 1200px is worse than one held at a readable width — `contentWidth` exists for exactly this, and `KeyboardAwareScreen` accepts a `contentWidth` prop for form-style screens.
- **Design the compact case first and completely.** Expanding a working compact layout is mechanical; compressing a desktop layout usually is not.
- **Stress more than width.** Short-height landscape, 200% Web zoom, large text, long localized strings, RTL and a visible keyboard all break layouts that only ever saw width changes.

## Common misconception

> "The components are responsive, so my screens are responsive."

Component-level responsiveness means a button wraps its label sensibly and a table can scroll — it does not mean your navigation reorganizes itself at 1280px. The library cannot make that choice for you, and if it tried, the result would be wrong for any product whose IA is not the one the library assumed.

The related anti-pattern is **inventing a fourth breakpoint** for one stubborn screen. It solves that screen and desynchronizes it from everything else; fix the screen's layout instead.

## Where to go next

- [Responsive & mobile-first](/docs/responsive/) — the short task-level summary.
- [Ownership model](/docs/learn/ownership-model/) — safe-area and shell responsibilities.
- [Accessibility model](/docs/learn/accessibility-model/) — large text, zoom and RTL pressure on layout.
- [Density guide](/docs/guides/density/) — the orthogonal metric axis.
- [Patterns](/docs/patterns/) and the running [demo](/demo/) — the responsive shell in a real application.
- [Reference](/docs/reference/) — exact token values.

## Source authority

- [`docs/responsive-layout.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/responsive-layout.md) — the canonical responsive layout contract.
- [`packages/tokens/src/index.ts`](https://github.com/beobungbu/BeeUI/blob/main/packages/tokens/src/index.ts) — `breakpoint`, `pageGutter`, `contentWidth`, `controlSize`.
- [`apps/demo/src/shell/responsive-nav.ts`](https://github.com/beobungbu/BeeUI/blob/main/apps/demo/src/shell/responsive-nav.ts) — the documented structural width switch.
