# Localization and long-content stress suite

BeeUI 1.0 issue [#144](https://github.com/beobungbu/BeeUI/issues/144) (R3.6). This is the
final, cross-cutting deterministic acceptance sweep for long/overflowing localized content
across the representative component set the issue enumerates: Tooltip, Sheet, Table/DataTable,
DatePicker/Calendar, forms (`Field`/`Input`/`Textarea`), `SettingsItem`, `Toast`, and navigation
chrome (`Breadcrumb`, `Tabs`).

## Model: five stress profiles, one fixture screen

`apps/showcase/runtime-smoke/l10n-stress-fixtures.ts` exports `L10N_STRESS_PROFILES`, five
representative profiles covering the axes #144's issue body enumerates:

| Profile | Axis |
| --- | --- |
| `long-en` | A long English sentence plus a real long German compound word (the "long words" axis) |
| `cjk` | Real Japanese: no natural word-break opportunities |
| `vi` | Vietnamese: Latin-script diacritics, still space-delimited wrapping |
| `ar-rtl` | Real Arabic: RTL script, Arabic-indic numerals |
| `pseudo` | Mechanical pseudo-localization (`pseudoLocalize()`: accents every vowel, appends `~`-padding proportional to expected translation-length expansion, wraps in brackets) |

Each profile also carries a realistic long person name, email, invoice/reference identifier,
and a large locale-formatted finance amount — the "long names/email/IDs" and "large
numeric/finance values" axes from the issue body.

`apps/showcase/runtime-smoke/l10n-stress-acceptance.tsx` is the runtime fixture screen, one tap
from Showcase home (`showcase-open-l10n-stress`, mirroring #143's Dynamic Type fixture
navigability rule). A profile switcher re-renders the same representative row set — Tooltip,
Sheet (with the primary action under test), a Table/DataTable row, a DatePicker/`Field`
description, a form (`Field` + `Input` + `Textarea`), a `SettingsItem` row, a `Toast` trigger,
and navigation chrome (`Breadcrumb` + `Tabs`) — with that profile's content, all above the fold,
so a single Playwright spec can assert every DoD criterion across every profile without
Component Gallery traversal.

**Fixture module placement, not `__tests__/`.** Unlike #143's `dynamic-type.ts`, the fixture
module lives in `runtime-smoke/`, not `apps/showcase/__tests__/helpers/`: Metro's Web bundler
cannot resolve an app-code import into `__tests__/` (confirmed empirically — the Showcase Web
export failed to resolve the module there), so a module the running app itself imports must sit
outside that tree.

## RTL coordinates with, does not duplicate, #142

The `ar-rtl` profile's real-Chromium RTL exercise
(`apps/visual-regression/tests/l10n-stress-showcase.spec.ts`) reuses the exact
`document.documentElement.dir = 'rtl'` ambient-authority seam
`overlay-rtl-showcase.spec.ts` already established for #140/#141/#142 (ADR-004,
[`004-direction-architecture.md`](./decisions/004-direction-architecture.md)). This suite does
not re-derive direction resolution or claim the systematic RTL component sweep that is #142's
job — it proves the localization-stress fixture itself stays collision-safe and unclipped once
RTL is the ambient direction.

## Truncation policy — reused, not re-derived

The component set this suite exercises carries no `numberOfLines`/ellipsis styling of its own.
The only BeeUI-wide intentional truncation points remain the ones #143 already documented and
tests (`SelectValue`'s `numberOfLines={1}`, `Textarea`'s row-bound growable viewport — see
[`dynamic-type.md`](./dynamic-type.md)). This suite's real-browser assertions (identical string
content reproduced verbatim across every sibling surface rendering the same field: Table cell,
`Tabs` trigger/panel, Breadcrumb, Sheet title/description, `SettingsItem`, Toast) are evidence
that no new, undocumented ellipsis/clip was introduced for the components in scope.

## Two genuine bugs found and fixed

Building this suite's real-Chromium assertions surfaced two pre-existing defects, both fixed in
this issue and covered by regression evidence in
`apps/visual-regression/tests/l10n-stress-showcase.spec.ts`:

### 1. `Table`'s Web implementation silently dropped `testID`

`packages/ui/src/components/table.web.tsx` renders plain HTML elements (`<table>`/`<td>`/`<th>`
— the ADR-007 platform split; native has no equivalent host elements), unlike every other BeeUI
Web component, which renders through react-native-web and gets `testID` → `data-testid`
DOM-attribute mapping automatically. `table.web.tsx` never had that mapping: a `testID` prop
fell through to `{...props}` as a literal, unrecognized DOM attribute (rendered lowercased,
e.g. `testid="..."`, never `data-testid="..."`), so `page.getByTestId()` could never resolve a
`Table`/`TableRow`/`TableCell`/etc. target on Web even though the element was present with the
right content — real evidence from this suite's first run (`getByTestId('l10n-stress-table-name')`
timing out against a cell visibly containing the exact expected text).

**Fix:** every exported component in `table.web.tsx` (`Table`, `TableCaption`, `TableHeader`,
`TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`) now accepts the same `testID`
prop its native (`table.tsx`) counterpart does and forwards it as `data-testid`, restoring
Web/native testability parity. This is a testability fix only — it does not change any
rendered class, layout, or accessibility attribute.

### 2. A very long, unbroken `Button` label could push the button off-screen

React Native's flex model defaults `flexShrink` to `0` (Web CSS defaults to `1`), and
react-native-web preserves that default for parity. `Button` had no width constraint of its
own, so an unusually long caller-supplied label (e.g. a long localized identifier) sized the
button to its full single-line intrinsic width regardless of its flex container's available
space. Real evidence: a `SheetFooter` (`flex-row flex-wrap justify-end`) primary-action button
with a ~54-character label rendered ~540px wide inside a 348px-wide footer and, anchored by
`justify-end`, extended ~170px past the left edge of a 390px viewport — the exact
"clipped/off-screen primary action" #144's DoD forbids.

**Fix:** `packages/ui/src/components/button.tsx`'s `buttonVariants` base class gained
`max-w-full`, capping the button at its containing block's width so it shrinks — and its label
wraps — instead of overflowing. Verified by hand (screenshot + bounding-rect measurement): the
wrapped two-line label stays fully inside the button's existing `h-control-default` height, with
no `overflow: hidden` anywhere in the chain, so no text is ever visually clipped or removed from
the accessibility tree; at every previously-audited (shorter) label length this is a no-op,
since normal labels already render narrower than their container. `Button`'s documented,
density-invariant `controlSize` height contract ([`dynamic-type.md`](./dynamic-type.md)) is
unchanged.

## Evidence

`apps/visual-regression/tests/l10n-stress-showcase.spec.ts`, run as part of the existing
`apps/visual-regression` Playwright harness (`showcase-integration` project, real Chromium)
against the live Showcase Web build. For each of the five stress profiles it asserts:

- **No viewport-level horizontal overflow** (`document.documentElement.scrollWidth` never
  exceeds `clientWidth`) on the fixture screen;
- **Table/DataTable row content** (name/email/identifier/amount) is reproduced verbatim by
  every sibling surface rendering the same field (`Tabs` trigger, `Breadcrumb`, `SettingsItem`)
  — cross-component consistency proof that nothing truncates/alters a value relative to its
  siblings;
- **Tooltip** reveals its full sentence content on focus, fully inside the viewport (a `.poll`
  waits past `TooltipContent`'s intermediate off-screen "measuring" frame — `tooltip.web.tsx`'s
  `left/top: -10000` pre-placement style — before measuring the real, collision-resolved
  position);
- **Sheet** opens with full title/description, and its primary action stays fully inside the
  viewport, unclipped, for every profile, including the two profiles whose label previously
  triggered the off-screen `Button` bug above;
- **Toast** shows the full title/description without viewport clipping;
- **Short-height/landscape window** (844×390): the Sheet primary action stays reachable and
  unclipped;
- **RTL** (Arabic profile): no viewport overflow and no clipped primary action once
  `document.dir` flips to `rtl` via the shared ADR-004 seam.

22/22 tests pass. A 2px bounding-box tolerance accounts for observed sub-pixel layout rounding
on a two-line-wrapped button at the bottom of the viewport; it is not a masked overflow (the
underlying bug above was fixed at the source, not tolerance-papered over).

**What this evidence does not prove**, stated honestly: this is Web/Chromium evidence only — it
does not exercise native iOS/Android text-rendering or line-breaking, which differ from
Chromium's Unicode line-breaking implementation. It also does not attempt the systematic,
component-by-component RTL sweep #142 owns; the `ar-rtl` profile here is one stress axis among
five, not a substitute for that issue's acceptance.
