# WS-F — four capability gaps: completion report

Branch: `ws/f-capabilities` @ `b40e603` (4 commits on top of `fix/consumer-audit-batch`).

## Item 1 — #591 closable, scrollable tab strip — DONE

Files changed: `packages/ui/src/components/tabs.tsx`.
Tests added: `apps/showcase/__tests__/tabs-closable-scrollable-strip.test.tsx` (8 tests).

- `TabsList` gained `scrollable?: boolean` (horizontal `ScrollView`, cross-platform via RNW —
  no `.web.tsx` split needed since `tabs.tsx` never had one) and `addon?: React.ReactNode`
  (pinned, non-scrolling trailing slot, e.g. a "+ new order" button).
- Selected-tab-scrolls-into-view: each `TabsTrigger` reports its own `onLayout` `{x, width}`
  into a small registry (`TabsListLayoutContext`); a `useEffect` on the parent `Tabs`'s
  `value` calls `scrollViewRef.current.scrollTo({x, animated: true})`.
- `TabsTrigger` gained `closable`, `closeAccessibilityLabel` (required when `closable`; dev
  warning if missing, no hardcoded English default), and `onClose`. The close control renders
  as a **sibling** `Pressable` inside a wrapping `View` that owns the pill's border/background
  — never nested inside the tab's own `Pressable` (the nested-pressable/`<button>`-in-
  `<button>` anti-pattern from #565's `DropdownMenuTrigger` finding).
- Closing the **currently selected** tab moves selection to the previous sibling, else the
  next, via a `TabsOrderContext` (`TabsList`'s own `children` order) and calls the parent
  `Tabs`'s `onValueChange`. Closing a non-selected tab only calls `onClose`.
- Non-`closable`, non-`scrollable` usage is byte-for-byte the pre-existing render path
  (same className, same Pressable-only tree) — zero regression risk for existing consumers.

**Scope decision (documented, not silently dropped):** the spec's "Keyboard and a11y: role
toolbar, arrow-key roving focus on web" line item's arrow-key roving-focus enhancement for
Tabs was intentionally **not** implemented here — `#591`'s own issue text never asks for it
(only app-owned Alt+key shortcuts), and it is not on the explicit tests list. Tabs today keep
full Tab-key/Enter-Space keyboard reachability (regular DOM tab order over each `Pressable`),
which is WCAG-sufficient; roving tabindex would need cloning an arbitrary child element with
a merged ref, non-trivial and higher-risk to retrofit safely under this workstream's time box.

## Item 2 — #592 item 1 OTPInput segmented appearance — DONE

Files changed: `packages/ui/src/components/otp-input.tsx`.
Tests added: `apps/showcase/__tests__/otp-input-segmented-appearance.test.tsx` (7 tests).

- `appearance?: 'joined' | 'segmented'`, default `'joined'` — byte-identical render path to
  before when omitted.
- `'segmented'` renders `length` decorative `View` boxes (one per character) absolutely
  positioned under a single real `Input` that spans the whole row, its text painted
  `text-transparent` and its native caret hidden via RN's own `caretHidden` prop (not a
  CSS/Uniwind class — `caret-color`/`::selection` have no native equivalent, so the real fix
  is the RN prop). One hidden-input contract is preserved exactly: one `value`, one
  `onChangeText`/`onValueChange`/`onComplete`.
- Caret/focus indicator: the box at index `resolvedValue.length` (the next slot to fill) gets
  a `border-focus-ring` outline while the hidden input is focused.
- Error/disabled states: boxes read the same `invalid`/`disabled` props already accepted by
  `OTPInputProps` and apply `border-destructive` / `bg-disabled opacity-70`.
- RTL: the box row flips via the existing `useDirection()` hook (`flex-row-reverse`), mirroring
  `table.tsx`'s established RTL convention; digit-to-cell mapping is unaffected, only visual
  order.
- Dynamic Type: boxes use `min-h-12 min-w-11` (not fixed `h-*`/`w-*`), so a scaled digit grows
  the box instead of being clipped.
- Reuses only existing tokens (`bg-input`, `border-control-border`, `border-destructive`,
  `border-focus-ring`, `bg-disabled`) — no new tokens for this item.

**Known limitation (documented):** OS text-selection tint on the invisible real input is not
overridden (Input's `cursorColorClassName`/`selectionColorClassName` are hardcoded internal to
`input.tsx`, which is not an owned file for this workstream, so they cannot be exposed as a
prop from here). This is a rare edge case for numeric OTP entry (selecting invisible text is
not a normal user action) and does not affect the caret, which is fully hidden via `caretHidden`.

## Item 3 — #603 item 1 per-table row density (48px step) — DONE

Files changed: `packages/tokens/tokens.json` (+ regenerated `packages/tokens/src/index.ts`,
`packages/tokens/src/lifecycle.json`), `packages/ui/src/components/table-shared.ts`,
`table.tsx`, `table.web.tsx`, `packages/ui/src/index.ts` (barrel re-export of `TableDensity`).
Tests added: `apps/showcase/__tests__/table-row-density-override.test.tsx` (13 tests, native +
Web).

**Design decision (load-bearing, verified against the locked test suite):** the obvious literal
reading — "add a 4th mode to the `compact`/`comfortable`/`spacious` density axis" — is
**blocked** by `scripts/__tests__/density-tokens.test.mjs` (not an owned file), which hard-
asserts `densityModeNames(source) === ['compact', 'comfortable', 'spacious']` and that
`rowHeight`/`rowGap`/`formGap` are the *only* three `densityAxis`-flagged groups, each with
*exactly* those three keys. Adding a 4th global mode would also force new `rowGap`/`formGap`
values for it (rowGap/formGap have no natural "48" evidence) and would fail that locked suite —
not something WS-F is allowed to weaken or an unowned file it may edit. `docs/density.md`
(unowned, read-only) independently confirms density has **no scoped/subtree application
surface in this release** and explicitly names the deferred extension mechanism as a local
CSS-variable/style override, not a new global mode — exactly the design implemented here.

Implementation:
- `packages/tokens/tokens.json`: added `tokens.spacing['row-dense'] = 48px` (a plain, non-
  `densityAxis` entry in the existing generic `spacing` scale — not emitted as a Tailwind CSS
  variable, only as a typed `spacing['row-dense']` JS/TS constant, which is exactly what a
  local style-based override needs). Regenerated via `pnpm tokens:generate`; `pnpm
  tokens:check`, `pnpm tokens:test` (173/173, including every locked density assertion
  unchanged), and `pnpm tokens:consumption-check` all pass.
- `table-shared.ts`: new `TableDensity = 'compact' | 'comfortable' | 'spacious' | 'dense48'`
  and `resolveTableDensityRowHeight(density)` (reuses `densityMetrics.rowHeight[mode]` for the
  three axis modes, `spacing['row-dense']` for `'dense48'`).
- `Table` (native + Web) gained `density?: TableDensity`. When set, it resolves a row-height
  pixel number and provides it via a small context; `TableRow` reads it and applies an explicit
  `style={[{minHeight}, style]}` (native) / `style={{height, ...style}}` (Web) override — the
  same "className default + explicit style override" pattern `Textarea` already uses, so a
  caller-supplied `style` still wins on any overlapping key. `layout="stacked"` ignores it (a
  card row has no fixed row height to override). Omitting `density` leaves every row exactly as
  before — verified by test.

## Item 4 — #611 item 1 toolbar overflow primitive — DONE

New file: `packages/ui/src/components/toolbar.tsx` (`Toolbar`, `ToolbarItem`, internal
`ToolbarOverflowMenu`). Barrel export added to `packages/ui/src/index.ts`;
`packages/ui/package.json` regenerated a `./toolbar` subpath via `pnpm ui-exports:generate`.
Tests added: `apps/showcase/__tests__/toolbar-overflow-collapse.test.tsx` (5 tests: all-fit/no-
menu, narrow/lowest-priority-collapses-first, activate-from-menu, resize-restores, no-priority-
never-collapses).

- `ToolbarItem` is a config-only element (`{children, label, icon?, onPress?, priority?,
  disabled?}`) — `Toolbar` reads its props directly and never mounts it as a component (same
  "declarative child as data" pattern several charting libraries use); the function body itself
  is dead code by design, documented as such.
- `Toolbar` renders a hidden, `position:absolute opacity-0 pointerEvents:none` measurement
  pass containing every item at its *natural* (never-collapsed) width, so a previously-measured
  width is never zeroed out the moment an item collapses — the bug a naive
  "just toggle visibility" implementation would have. The visible row renders only the items
  that currently fit, plus the overflow trigger when needed.
- Collapse order: ascending `priority` (lower collapses first), tie-broken trailing-to-leading;
  items with no `priority` never collapse, even if the row still overflows. A fixed 36px
  (`control-compact` width precedent) is reserved for the overflow trigger once anything
  collapses. Recomputed from `containerWidth`/`itemWidths` on every render (no separate
  "collapsed" state store), so widening the container automatically restores items — no extra
  resize-handling code needed.
- `ToolbarOverflowMenu` is a thin `DropdownMenu` composition (gets `aria-haspopup="menu"` and
  full existing keyboard/dismiss behavior for free); a collapsed item's `label`/`icon`/`onPress`
  render unchanged inside a `DropdownMenuItem`.
- `role="toolbar"` on the container. No new dependencies.

**Scope decision (documented, not silently dropped):** full WAI-ARIA roving-tabindex
arrow-key navigation across toolbar items ("Keyboard and a11y: ... arrow-key roving focus on
web") was **not** implemented. It would require cloning an arbitrary, caller-supplied
`ToolbarItem.children` element to inject a merged ref/`tabIndex` (risky for children that are
not `forwardRef`-compatible) and is not on the explicit acceptance-test list (only
fit/collapse/resize are). Items remain fully keyboard-reachable today via standard Tab order
(each rendered item is a normal focusable `Pressable`/`Button`), and the overflow trigger is
itself a `Button` (`DropdownMenuTrigger`), so it is Tab-reachable and opens/closes with
Enter/Space like any other menu button in this family.

## Gate commands and results (all run from repo root with Node 24.13.1, pnpm 10.15.0)

| Gate | Result |
| --- | --- |
| `pnpm lint` | pass, 0 warnings |
| `pnpm --filter @beemvp/beeui-tokens typecheck` | pass |
| `pnpm tokens:check && pnpm tokens:test && pnpm tokens:consumption-check` | pass — tokens:test 173/173, consumption-check 88 files/0 violations |
| `pnpm --filter @beemvp/beeui-ui typecheck` | pass |
| `pnpm --filter @beemvp/beeui-showcase typecheck` | pass (includes its own `pretypecheck` → `example-registry:check`, 62 public components + 37 pattern sources) |
| `pnpm ui-exports:generate && pnpm ui-exports:check` | pass — 63 public component subpaths (62 + new `toolbar`) |
| `pnpm --filter @beemvp/beeui-showcase test` | pass — **122/122 suites, 1094/1094 tests** (includes the 4 new files above, 33 new tests, zero regressions) |
| `pnpm --filter @beemvp/beeui-showcase example-registry:check` | pass |

Full-repo `pnpm typecheck`/`pnpm test` (root scripts covering `apps/docs`, `registry/registry.json`
consistency, etc.) were **not** run — out of scope per the spec's Gates list and file ownership
(neither `apps/docs` nor `registry/registry.json` is owned by this workstream, and `Toolbar` is
intentionally not yet registered as a "public" Registry component there — see below).

## Deliberately not touched (file-ownership boundary, not an oversight)

- `registry/registry.json`: not in this workstream's owned-file list. `Toolbar` is therefore
  not yet a "public" Registry component — it has no CLI `add` entry and is not required to
  appear in `apps/showcase/example-registry.ts`'s `COMPONENT_FIXTURES` (that check cross-
  references `registry.json`'s public list, which already passed at 62 components,
  unaffected). Whichever workstream owns the Registry/docs site should add a `toolbar` entry
  there when it wires up the public docs page.
- `docs/density.md`: read for design guidance, not edited (not owned; its own text already
  independently describes and endorses the "local style override" pattern implemented here for
  item 3, so no known drift is introduced — but its prose does not yet mention `Table`'s new
  `density` prop as the first concrete use of that plan).
- `scripts/generate-tokens.mjs`, `scripts/__tests__/density-tokens.test.mjs`: not owned; the
  design for item 3 was chosen specifically so neither needed to change.
- `apps/docs`, other components (`input`, `select`, `dialog`, `field`, `toast`, `safe-area`,
  `theme-scope`, `box`): untouched, per the spec's explicit exclusion list.

## Docs text to publish

### Tabs — new props

| Component | Prop | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `TabsList` | `scrollable` | `boolean` | `false` | Renders the strip inside a horizontal scroll container instead of an equal-width flex row; scrolls the selected `TabsTrigger` into view whenever `Tabs`'s `value` changes. |
| `TabsList` | `addon` | `React.ReactNode` | — | Extra content rendered after the strip (e.g. a pinned "+ new order" button). Stays fixed even when `scrollable` is true — never part of the scrolling region. |
| `TabsTrigger` | `closable` | `boolean` | `false` | Renders an accessible close control as a sibling of the tab (never nested inside it). Requires `closeAccessibilityLabel`. |
| `TabsTrigger` | `closeAccessibilityLabel` | `string` | — | Accessible name for the close control, e.g. `` `Close ${label}` ``. Required whenever `closable` is set; dev warning if omitted. |
| `TabsTrigger` | `onClose` | `(value: string) => void` | — | Called with this tab's `value` on close-control press. If this tab is currently selected, `Tabs`'s `onValueChange` also fires with the previous sibling's value (else the next). |

Usage:

```tsx
function OpenOrders() {
  const [orders, setOrders] = useState(['order-1', 'order-2', 'order-3']);
  const [active, setActive] = useState('order-1');

  return (
    <Tabs value={active} onValueChange={setActive}>
      <TabsList scrollable addon={<IconButton accessibilityLabel="New order" onPress={addOrder}>+</IconButton>}>
        {orders.map((id, i) => (
          <TabsTrigger
            key={id}
            value={id}
            closable
            closeAccessibilityLabel={`Close Order ${i + 1}`}
            onClose={(value) => setOrders((current) => current.filter((o) => o !== value))}
          >
            Order {i + 1}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
```

### OTPInput — new prop

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `appearance` | `'joined' \| 'segmented'` | `'joined'` | `'segmented'` renders one visually separate box per character over the same single hidden input — one caret (hidden; the active box shows a focus-ring border instead), one value, one `onChangeText` contract. |

Usage:

```tsx
<OTPInput appearance="segmented" length={4} value={code} onValueChange={setCode} onComplete={verify} />
```

### Table — new prop

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `density` | `'compact' \| 'comfortable' \| 'spacious' \| 'dense48'` | — (inherits ambient global density) | Overrides the row height for this one `Table` only — `compact`/`comfortable`/`spacious` reuse the exact global density-axis values (44/56/64px); `dense48` is a fourth, table-specific 48px step. Ignored in `layout="stacked"`. Omitting it leaves rows exactly as before. |

Usage:

```tsx
<Table density="dense48">
  <TableBody>{rows}</TableBody>
</Table>
```

### Toolbar — new component

| Component | Prop | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `Toolbar` | `overflowAccessibilityLabel` | `string` | — | Accessible name for the overflow menu button. Required once any `ToolbarItem` declares a `priority` (only then can anything collapse); dev warning if missing once the overflow menu actually renders. |
| `ToolbarItem` | `children` | `React.ReactNode` | required | Rendered in the row while this item fits — typically an `IconButton`/`Button`. |
| `ToolbarItem` | `label` | `string` | required | Accessible label and overflow-menu row text. |
| `ToolbarItem` | `icon` | `React.ReactNode` | — | Icon shown next to `label` in the overflow menu. |
| `ToolbarItem` | `onPress` | `() => void` | — | Called on activation, whether the item is in the row or the overflow menu. |
| `ToolbarItem` | `priority` | `number` | — | Lower collapses first when the row doesn't fit. Omitted = never collapses. |
| `ToolbarItem` | `disabled` | `boolean` | `false` | Disables the item everywhere it renders. |

Usage:

```tsx
<Toolbar overflowAccessibilityLabel="More actions">
  <ToolbarItem label="Search" onPress={openSearch}>
    <IconButton accessibilityLabel="Search" onPress={openSearch}><SearchIcon /></IconButton>
  </ToolbarItem>
  <ToolbarItem label="Filter" priority={2} onPress={openFilter}>
    <IconButton accessibilityLabel="Filter" onPress={openFilter}><FilterIcon /></IconButton>
  </ToolbarItem>
  <ToolbarItem label="Export" priority={1} onPress={exportData}>
    <IconButton accessibilityLabel="Export" onPress={exportData}><ExportIcon /></IconButton>
  </ToolbarItem>
</Toolbar>
```

## Files modified/added

- `packages/ui/src/components/tabs.tsx` (rewritten sections: `TabsList`, `TabsTrigger`)
- `packages/ui/src/components/otp-input.tsx` (rewritten)
- `packages/tokens/tokens.json`, `packages/tokens/src/index.ts`, `packages/tokens/src/lifecycle.json` (generated)
- `packages/ui/src/components/table-shared.ts`, `table.tsx`, `table.web.tsx`
- `packages/ui/src/components/toolbar.tsx` (new)
- `packages/ui/src/index.ts`, `packages/ui/package.json` (generated)
- `apps/showcase/__tests__/tabs-closable-scrollable-strip.test.tsx` (new)
- `apps/showcase/__tests__/otp-input-segmented-appearance.test.tsx` (new)
- `apps/showcase/__tests__/table-row-density-override.test.tsx` (new)
- `apps/showcase/__tests__/toolbar-overflow-collapse.test.tsx` (new)

Status: DONE
Branch: ws/f-capabilities @ b40e603
Summary: All four WS-F capability items implemented, tested (33 new tests, 1094/1094 total showcase tests passing), and committed as four conventional-commit-per-item commits; every listed Gate passes.
Concerns: two enhancement sub-bullets (Tabs/Toolbar arrow-key roving focus) were scoped out as documented, lower-risk decisions since they are absent from the explicit test-acceptance lists; Toolbar is not yet registered in registry/registry.json (out of this workstream's file ownership) so it has no CLI `add` entry yet.
