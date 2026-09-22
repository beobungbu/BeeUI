# WS-I — keyboard roving focus + DateTimePicker locale copy: completion report

Branch: `ws/i-keyboard-locale` @ `4fa4cda` (3 commits on top of `origin/fix/consumer-audit-followups`).

## Item 1 — Tabs (web) scrollable arrow-key roving focus — DONE

Files changed: `packages/ui/src/components/tabs.tsx`.
Tests added: `apps/showcase/__tests__/tabs-scrollable-arrow-key-roving-focus.test.tsx` (7 tests).

- Scope, per the spec's own wording: only a `TabsList scrollable` strip gets arrow-key
  roving-tabindex navigation. A plain (non-`scrollable`) `TabsList` is byte-for-byte
  unchanged — every trigger keeps ordinary Tab-key reachability, no `tabIndex`/`onKeyDown`
  wiring at all. This matches WS-F's own documented scope decision to skip full roving
  focus for Tabs generally, narrowed here to exactly the case the spec asks for.
- `TabsList` computes a roving-tabindex "current" trigger value: the last one explicitly
  focused/navigated to, falling back to the currently *selected* tab (WAI-ARIA Tabs
  Pattern's usual starting point), falling back to the first enabled trigger. `TabsTrigger`
  reads it to set `tabIndex={0}` (current) or `{-1}` (everything else) on Web only.
- `ArrowRight`/`ArrowLeft` move the roving-current trigger with wrap-around, skipping
  disabled triggers; `Home`/`End` jump to the first/last enabled trigger; RTL (read via the
  existing `useDirection()` hook, ambient-only — Tabs has no `direction` prop) flips which
  arrow key is "forward". Moving focus never changes `Tabs`'s own selection (manual-
  activation model) — only a real Enter/Space press on the focused trigger does, exactly as
  before.
- The newly-focused trigger scrolls into view via a second `useEffect` keyed on the
  roving-focus state, independent of and in addition to the pre-existing
  selection-changes-scroll effect (kept unmodified, same dependency array).
- **Load-bearing bug found and fixed during implementation, not a design choice**: a first
  draft put `currentValue` inside the same memoized context object as `register`/
  `unregister`, which changes identity on every roving-focus interaction. `TabsTrigger`'s
  register/unregister cleanup effects key their dependency array on that object's identity,
  so every arrow-key press was firing a stale-closure `unregister` and silently dropping the
  still-mounted trigger's tracked layout — reproduced via a failing pre-existing scrollTo
  jest assertion, root-caused with print debugging, and fixed by splitting the roving
  `currentValue`/`setCurrentValue` pair into its own `TabsRovingFocusContext`, decoupled
  from the registration-lifecycle `TabsListLayoutContext`. Documented in both contexts' own
  header comments so it is not silently reintroduced.

## Item 2 — Toolbar (web) roving tabindex — DONE

Files changed: `packages/ui/src/components/toolbar.tsx`.
Tests added: `apps/showcase/__tests__/toolbar-arrow-key-roving-focus.test.tsx` (6 tests).

- `role="toolbar"` roving tabindex: one item tabbable at a time. `ArrowLeft`/`ArrowRight`
  move between visible row items with wrap-around (RTL-aware, same `useDirection()`
  pattern as Tabs), `Home`/`End` jump to the first/last, and the overflow trigger (once
  anything has collapsed) is always the sequence's last stop — a collapsed item itself is
  only reachable by opening that menu, never directly, matching the spec's own wording.
- Since `ToolbarItem.children` is caller-supplied (typically an `IconButton`/`Button`, not a
  BeeUI-owned pressable the way `TabsTrigger` is), roving focus wires through
  `React.cloneElement`: `Toolbar` clones each visible item's child with a merged `ref`
  (preserving any `ref` the caller already set), a wrapped `onFocus` (preserving the
  caller's own), and the computed `tabIndex`. `ToolbarItemProps.children`'s own docblock is
  updated to describe this (it previously said "never cloned or otherwise modified", which
  WS-F wrote before this feature existed and is no longer accurate).
- `ToolbarOverflowMenu` is now `React.forwardRef`, forwarding to its `DropdownMenuTrigger`
  so the roving sequence can call `.focus()` on it and set its `tabIndex`/`onFocus` like any
  other sequence entry.
- This reverses WS-F's own documented scope decision to skip Toolbar roving focus (cloning
  arbitrary children was called out there as "risky... higher-risk to retrofit safely") —
  the current spec explicitly assigns it, so it is implemented here, with the risk
  mitigated by cloning only a `ref`/`onFocus`/`tabIndex` triple every BeeUI-owned focusable
  control already accepts, and falling back to rendering the child unmodified when it is
  not a single valid React element (`React.isValidElement` guard).

## Item 3 — DateTimePicker locale-derived placeholder + Done label — DONE

Files changed: `packages/ui/src/components/date-time-picker-locale.ts`,
`date-time-picker.web.tsx`, `date-time-picker.native.tsx`.
Tests added: `apps/showcase/__tests__/date-time-picker-locale-copy.test.tsx` (6 tests).

- Mirrors WS-C's exact fix for `DatePicker` (`date-picker-locale.ts`): `placeholder` no
  longer defaults to a static English string at destructure time; it is now
  `placeholder ?? getDateTimePickerDefaultPlaceholder(locale)`, computed after `locale` is
  resolved, with a small built-in `en-US`/`vi-VN` dictionary. The previously-exported
  `DATE_TIME_PICKER_DEFAULT_PLACEHOLDER` constant is kept (unused internally now, same as
  `DatePicker`'s own `DATE_PICKER_DEFAULT_PLACEHOLDER`) for public-API stability.
- Extended beyond placeholder to the other hardcoded-English **visible** copy this
  component owns with no dedicated override prop: the "Done" button that closes the Web
  `Popover` / native iOS `Dialog` footer, now `getDateTimePickerDoneLabel(locale)` (`'Done'`/
  `'Xong'`). `hourAccessibilityLabel`/`minuteAccessibilityLabel`/`periodAccessibilityLabel`/
  `clearAccessibilityLabel` intentionally stay separate, unlocalized-by-default props — the
  same scope boundary `DatePicker`'s month-nav accessibility labels kept, and consistent
  with ADR-008's "no huge locale database" constraint.
- Neither dictionary's strings coincide with `date-picker-locale.ts`'s own (different
  sentences: "Select a date" vs. "Select a date and time"), so nothing is literally
  reused/imported from there — the architecture (small built-in dictionary, `en-US`
  fallback for an unknown `locale`, no ambient auto-detection) is deliberately identical.

## Gate commands and results (all run from repo root with Node 24.13.1, pnpm 10.15.0)

| Gate | Result |
| --- | --- |
| `pnpm lint` | pass, 0 warnings |
| `pnpm --filter @beemvp/beeui-ui typecheck` | pass |
| `pnpm --filter @beemvp/beeui-showcase typecheck` | pass (includes `pretypecheck` → `example-registry:check`, 63 public components + 37 pattern sources) |
| `pnpm ui-exports:check` | pass — 63 public component subpaths, no export drift |
| `pnpm --filter @beemvp/beeui-showcase test` | pass — **126/126 suites, 1129/1129 tests** (19 new tests across the three new files, zero regressions) |
| `pnpm --filter @beemvp/beeui-visual-regression typecheck` | pass |
| `pnpm build:web && playwright test keyboard-roving-focus --project=desktop-light` | pass — **3/3** (see below for the webServer note) |

**Playwright environment note (not a code issue, resolved locally, nothing committed):**
the repo's `apps/visual-regression` `webServer` config always boots three servers,
including a docs-portal server whose `command` runs `pnpm --filter @beemvp/beeui-docs
build`. That build times out (300s) and, in this sandbox, also mutated ~63 `apps/docs/**`
markdown files (stripped their "Live Web preview" iframe section — a pre-existing
generator issue unrelated to WS-I, reproducing independently of any change in this branch).
`apps/docs` is out of this workstream's file ownership, so those changes were reverted with
`git checkout -- apps/docs` immediately, verified clean, and never touched again. To run the
new spec without invoking that build, two local-only static stub HTTP servers (returning a
bare 200) were started on the docs/gallery-qa ports so Playwright's
`reuseExistingServer: true` skips their `command` entirely; the real showcase server (port
4173, actually serving `dist-web`) is what my spec's fixture runs against. This workaround
is not part of any commit — flagging it for whichever workstream owns `apps/visual-regression`
CI wiring, since a plain local `pnpm --filter @beemvp/beeui-visual-regression test` will hit
the same 300s timeout outside CI's own environment.

**Pre-existing, unrelated baseline mismatch found and ruled out:** `visual.spec.ts`'s
`navigation-data` canonical screenshot fails locally (~1% pixel diff, font-rendering, not a
layout/behavior difference) on a clean checkout of `origin/fix/consumer-audit-followups`
with **none** of this workstream's changes applied (verified via `git stash` before
re-running the same test) — confirmed pre-existing to this machine/Chromium build, not
introduced by WS-I. Not in this workstream's Gates list; not touched.

## Docs text to publish

### Tabs — `TabsList scrollable` keyboard behavior (new, no prop change)

No new props. Add to the existing `TabsList`/`TabsTrigger` docs page, under `scrollable`:

> On Web, a `scrollable` `TabsList` supports arrow-key roving-tabindex navigation: only one
> trigger is Tab-reachable at a time (matching the WAI-ARIA Tabs Pattern). `ArrowRight`/
> `ArrowLeft` move focus between enabled triggers with wrap-around (`ArrowLeft`/`ArrowRight`
> swap meaning in RTL layouts), `Home`/`End` jump to the first/last enabled trigger, and the
> focused trigger scrolls into view. Moving focus never changes the selected tab — press
> Enter/Space (or click) to select the focused trigger, same as before. A non-`scrollable`
> `TabsList` is unaffected: every trigger keeps ordinary Tab-key reachability.

### Toolbar — roving-tabindex keyboard behavior (new, no prop change)

Add to the `Toolbar` docs page:

> On Web, `Toolbar` implements the WAI-ARIA Toolbar Pattern's roving tabindex: one item is
> Tab-reachable at a time. `ArrowRight`/`ArrowLeft` move between the currently visible items
> with wrap-around (RTL-aware), `Home`/`End` jump to the first/last, and once any item has
> collapsed into the overflow menu, the overflow trigger button becomes the sequence's last
> stop — a collapsed item's action itself is only reachable by opening that menu.

### DateTimePicker — `locale` now localizes its own placeholder and "Done" copy

Update the `locale` prop description (mirrors the `DatePicker` page's own #573 item 3 fix):

> Explicit-only (no ambient device/browser locale auto-detection). Defaults to `'en-US'`.
> Also derives the empty-state `placeholder` (when omitted) and the "Done" button text from
> a small built-in dictionary (`en-US`/`vi-VN` today); an explicit `placeholder` prop always
> wins. Other labels (`hourAccessibilityLabel`, `minuteAccessibilityLabel`,
> `periodAccessibilityLabel`, `clearAccessibilityLabel`) remain separate, English-default
> props — pass them explicitly for a locale this dictionary does not cover.

## Files modified/added

- `packages/ui/src/components/tabs.tsx` (roving-tabindex additions to `TabsList`/`TabsTrigger`)
- `packages/ui/src/components/toolbar.tsx` (roving-tabindex additions to `Toolbar`/`ToolbarOverflowMenu`)
- `packages/ui/src/components/date-time-picker-locale.ts` (new `getDateTimePickerDefaultPlaceholder`/`getDateTimePickerDoneLabel`)
- `packages/ui/src/components/date-time-picker.web.tsx`, `date-time-picker.native.tsx` (wire the two new locale helpers)
- `apps/showcase/__tests__/tabs-scrollable-arrow-key-roving-focus.test.tsx` (new)
- `apps/showcase/__tests__/toolbar-arrow-key-roving-focus.test.tsx` (new)
- `apps/showcase/__tests__/date-time-picker-locale-copy.test.tsx` (new)
- `apps/visual-regression/App.tsx` (new `KeyboardRovingFocusFixture` + `keyboard-roving-focus` fixture id — imports `Toolbar`/`ToolbarItem`, adds `Tabs`/`Toolbar` fixture screens)
- `apps/visual-regression/tests/keyboard-roving-focus.spec.ts` (new, 3 tests)

## Deliberately not touched

- `apps/docs`: not owned by this workstream; the accidental local mutation described above
  was reverted and never re-triggered in any commit.
- `pnpm docs:portal-pages:generate`: not run — no exported prop's JSDoc changed (only new
  internal, non-exported types/comments in `tabs.tsx`/`toolbar.tsx`).
- `hourAccessibilityLabel`/`minuteAccessibilityLabel`/`periodAccessibilityLabel`/
  `clearAccessibilityLabel`: intentionally left as separate, unlocalized-by-default props
  (see item 3 above) — same boundary `DatePicker`'s month-nav labels already established.

Status: DONE
Branch: ws/i-keyboard-locale @ 4fa4cda
Summary: All three WS-I items implemented and tested (19 new jest tests + 3 new Playwright tests, zero regressions across 1129 existing showcase tests); every listed Gate passes.
Concerns: the visual-regression `webServer` config unconditionally requires the docs-portal build, which times out and (independently of this branch) mutates `apps/docs/**` content — worth a follow-up ticket for whichever workstream owns that CI wiring, since it will also block a plain `pnpm --filter @beemvp/beeui-visual-regression test` locally outside this session's stub-server workaround.
