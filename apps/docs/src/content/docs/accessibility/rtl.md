---
title: RTL & localization
description: Right-to-left layout and localized/long-content behavior.
---

BeeUI resolves right-to-left (RTL) layout from one shared, stateless direction resolver
rather than each component reading the platform independently. This is [ADR-004:
Direction architecture](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/004-direction-architecture.md)
in the source repository, implemented in `use-direction.ts` (`@beemvp/beeui-ui`).

## How direction is resolved

For every direction-aware component, the effective direction is:

1. an explicit `direction` prop, when a caller supplies one;
2. otherwise the platform's own ambient authority — `I18nManager.isRTL` on iOS/Android, or
   `document.documentElement.dir === 'rtl'` on Web;
3. otherwise `'ltr'`.

BeeUI never calls `I18nManager.forceRTL()` and never writes the DOM `dir` attribute —
setting the app's direction stays the host application's responsibility. BeeUI only reads
the existing authority and forwards it, the same pattern already established for theme
scope: no second global state engine, no context provider, no subscription store dedicated
to RTL.

Because there is no live subscription, a Web `document.dir` change is reflected the next
time an affected component re-renders (not instantly, without an app-triggered
re-render); a native `I18nManager.forceRTL()` change takes effect after the app reloads.
This is a documented, accepted limitation, not a defect.

## What resolves direction today

`Popover`, `DropdownMenu`, `Select`, and `Tooltip` — every anchored-overlay component —
call the same resolver instead of each duplicating the platform read. `Breadcrumb`,
`Pagination`, `Table`, and `Calendar` also call it directly for their own logical
start/end layout (separator glyphs, previous/next chevrons, column order, and
navigation-chevron/arrow-key mirroring, respectively).

Concretely:

- **Pagination** points "previous" toward the logical start and "next" toward the logical
  end, mirroring the rendered chevron glyphs under RTL.
- **Breadcrumb** mirrors its default separator glyph under RTL while still honoring an
  explicit caller-supplied separator unchanged.
- **Table** (`layout="scroll"`) adopts `dir="rtl"` on its scroll wrapper and visually
  reverses column order under RTL, verified against real rendered DOM order, not just a
  flipped prop.
- **Calendar** mirrors ArrowLeft/ArrowRight keyboard navigation and its navigation
  chevrons to match real RTL layout — verified against actual rendered geometry with a
  real browser, not only a unit-level assertion.
- **Sheet** and **Tooltip** remain fully operable (dismissible, keyboard-reachable) when
  the document direction is RTL.

## Known gaps

RTL is implemented and exercised per-component with real evidence (deterministic
precedence tests plus Chromium Playwright tests for Table, Calendar, Sheet, and Tooltip),
but BeeUI does not yet have a single cross-cutting RTL acceptance matrix the way it has one
for keyboard/focus (`docs/keyboard-focus-acceptance-matrix.md`, #146). That consolidation
is tracked as open work in BeeUI issues #141 (RTL overlay acceptance) and #142 (RTL
component stress matrix). Localized/long-content stress testing (CJK, long translated
strings, etc.) beyond BeeUI's existing Dynamic Type wrap-vs-truncation policy is tracked
separately and also remains open (#144).

The full, per-component RTL evidence index lives in `docs/accessibility-contract.md` and
`docs/decisions/004-direction-architecture.md` in the source repository.
