# Dynamic Type / font-scaling contract

BeeUI 1.0 issue [#143](https://github.com/beobungbu/BeeUI/issues/143). This document is
the canonical policy for how `@beeui/ui` behaves under OS/browser text-size scaling —
iOS/Android Dynamic Type on native, browser zoom/OS text size on Web — across the current
public component surface (`packages/ui/src/components/*`).

## Model: platform-owned scaling, no BeeUI slider

BeeUI does not implement an in-app font-scale override, slider, or preference store. Text
scaling is entirely owned by the platform, the same way BeeUI already treats reduced-motion
and theme preference persistence as application-owned (see [`motion.md`](./motion.md) and
[`density.md`](./density.md)):

- **Native (iOS/Android).** React Native's `Text`/`TextInput` scale automatically against
  the OS accessibility text-size setting whenever `allowFontScaling` is left at its RN
  default (`true`). BeeUI components never set `allowFontScaling={false}` and never read
  `PixelRatio.getFontScale()` to fork rendering — doing either would silently opt a
  component's text out of the user's chosen OS text size.
- **Web.** Every semantic typography role (`display`/`title`/`heading`/`body`/`label`/
  `caption`) resolves through a generated CSS custom property
  (`text-[length:var(--text-*)]`, see [`data-typography.md`](./data-typography.md) and
  `theme-token-consumers-v2.test.ts`), never a literal pixel/point value. Because the
  generated theme uses `rem`-based sizing, standard browser zoom and OS-level text-size
  settings scale BeeUI text the same way they scale any other `rem`-sized page content.
  BeeUI does not need a separate Web zoom mechanism; it needs to keep not hardcoding pixel
  sizes.

This is a hard rule, not a preference: **no component may globally or conditionally disable
font scaling** (`allowFontScaling={false}`) to protect a screenshot, a fixed layout, or any
other implementation convenience. `apps/showcase/__tests__/dynamic-type-contract.test.tsx`
enforces this by scanning every file in `packages/ui/src/components` for the pattern; adding
`allowFontScaling={false}` anywhere fails that test.

## Audited stress levels

The audit and the reusable fixtures below use four canonical stress levels, exported as
`FONT_SCALE_STRESS_LEVELS` from
`apps/showcase/__tests__/helpers/dynamic-type.ts`:

| Scale | Rough real-world equivalent |
| --- | --- |
| `1` | System default |
| `1.3` | iOS "Large" / early accessibility Dynamic Type steps; Android "Large" font scale |
| `1.5` | A larger iOS Dynamic Type accessibility step; Android "Largest" font scale |
| `2` | Top of BeeUI's audited range — Android's font-scale ceiling on most OEM skins; a representative iOS accessibility size |

BeeUI does not claim coverage above `2x` in this issue.

## Wrapping vs. truncation policy

**Default: text wraps.** No component in `packages/ui/src/components` sets `numberOfLines`
on caller/consumer-supplied text unless that specific control is listed below. `Text`,
`Button`, `Chip`, `Checkbox`/`Radio` labels, `AlertBanner`, `ListItem`/`SettingsItem`, and
every other prose-bearing component wrap by default and were audited by rendering
stress-length content (`stressText()`) at every level in
`FONT_SCALE_STRESS_LEVELS` and asserting the full string is present in the rendered tree
(`dynamic-type-contract.test.tsx`).

**Intentional, documented exceptions** (single-line truncation or a bounded multiline
viewport) — the full list and each rationale live in
`INTENTIONAL_TRUNCATION_POINTS` in the fixtures module, and the contract test fails if the
source and this table drift apart:

| Component | Behavior | Why |
| --- | --- | --- |
| `SelectValue` (`select.tsx`) | `numberOfLines={1}` | Renders the single persisted combobox value, matching native single-line select/picker trigger conventions on iOS/Android/Web. The full value stays reachable by opening `SelectContent`. |
| `Textarea` (`textarea.tsx`) | Forwards a caller-controlled `numberOfLines` (default `4`) | Sizes the multiline **editable** viewport row count, not a single-line clip — this is a growable multiline field (`h-auto min-h-24`), and callers may raise `numberOfLines` for more visible rows. |

Adding a new `numberOfLines` usage anywhere in `packages/ui/src/components` without adding a
matching entry to `INTENTIONAL_TRUNCATION_POINTS` (and this table) is a contract violation.

## Fixed-height controls: corrected or justified

A text-bearing row that uses a fixed `h-*` height (rather than a growable `min-h-*` one)
either clips scaled content or has to be explicitly justified. The audit found two
unjustified fixed-height rows and corrected them in this issue:

- **`SelectTrigger`** (`select.tsx`) — was `h-11`, now `min-h-11`. The row already matched
  the growable pattern every sibling anchored-overlay row uses (`SegmentedControlItem`,
  `TabsTrigger`, `DropdownMenu*Item`, `Chip` all use `min-h-*`); the trigger was the one
  outlier holding a fixed `h-11 flex-row items-center` layout that could vertically clip
  its `SelectValue`/placeholder text at large scale. Default rendered height is unchanged
  (`min-h-11` still floors at 44px); it can now only grow.
- **`PaginationItem`** (`pagination.tsx`) — was `h-10`, now `min-h-10`, for the same reason:
  a numeric page label plus surrounding chrome could clip vertically once Dynamic Type grows
  the label's line height past the fixed 40px row. Default rendered height is unchanged.

Both changes are covered by a regression test
(`fixes SelectTrigger and PaginationItem to grow instead of clipping at scale` in
`dynamic-type-contract.test.tsx`) that fails if either class reverts to a bare `h-11`/`h-10`.

**Explicitly justified fixed-height rows** — a control stays fixed-height when its content is
decorative/glyph-only (never caller prose) or the fixed height mirrors an accepted,
already-documented invariant. The authoritative list (with the exact allowed class per file
and the rationale) lives in `FIXED_HEIGHT_ALLOWLIST` in the fixtures module and is enforced
by `dynamic-type-contract.test.tsx`: any `h-*` (non-`min-h-*`) class appearing in
`packages/ui/src/components` that is not in this allow-list fails the test.

| File | Fixed classes | Rationale |
| --- | --- | --- |
| `button.tsx` | `h-control-compact`, `h-control-default`, `h-control-large`, `h-control-icon` | `Button`'s `controlSize` scale is a documented, density-invariant component-level API ([`density.md`](./density.md) explicitly lists `controlSize` as **not** touched by any runtime axis). The `ios:min-h-touch-target`/`android:min-h-touch-target` guard keeps the tappable region at ≥44px at every scale; `Button` never truncates its label — it wraps within the row instead. |
| `input.tsx` | `h-control-compact`, `h-control-default`, `h-control-large` | `Input` mirrors the native single-line text-field convention (`UITextField`/`EditText`) and shares `Button`'s density-invariant `controlSize` scale. The touch-target guard on the `sm` size keeps the tappable floor at ≥44px regardless of scale; multi-line growth is `Textarea`'s contract, not `Input`'s. |
| `avatar.tsx` | `h-avatar-sm/md/lg/xl`, `h-full` | Avatar geometry (image frame / 1–2 character fallback initials) is a fixed decorative badge on every platform convention BeeUI targets; initials are not reflowable prose. |
| `checkbox.tsx` | `h-5` | The 20×20 box is a decorative checked-state glyph; the accessible hit target is the full label row (`Pressable`), not the glyph box. |
| `radio.tsx` | `h-5`, `h-2` | Decorative selected-state glyph indicators; not reflowable text. |
| `stepper.tsx` | `h-8` | Decorative circular step-index glyph; not reflowable text. |
| `progress.tsx` | `h-1`, `h-2`, `h-3`, `h-full` | Progress bar track/fill geometry; carries no caller text. |
| `skeleton.tsx` | `h-4` | Decorative static loading placeholder; carries no real text. |
| `separator.tsx`, `dropdown-menu.tsx` (`DropdownMenuSeparator`) | `h-px` | Decorative 1px divider line; carries no text. |
| `timeline.tsx` | `h-3` | Decorative status-marker dot; carries no text. |
| `textarea.tsx` | `h-auto` | Not actually a fixed pixel height — `h-auto` grows with content and is paired with `min-h-24`; listed for completeness since the scanner matches the `h-` prefix. |

## Minimum hit targets survive scale

The `ios:min-h-touch-target`/`android:min-h-touch-target` guard (44px / `--spacing-touch-target`,
see [`density.md`](./density.md#native-interactive-hit-target-guarantee)) is a static class,
not a scale-dependent computation, so it cannot regress under font scaling — it is present
on `Button size="sm"`, `Input size="sm"`, `ListItem`/`SettingsItem` regardless of the OS
font-scale value. `dynamic-type-contract.test.tsx` renders each of these under every
`FONT_SCALE_STRESS_LEVELS` value (via the `withFontScale()` seam) and asserts the guard
classes stay present, proving no component conditionally drops the guard based on a reported
font scale.

**Known, pre-existing gap — out of #143's scope.** A standalone `Checkbox`/`Radio` rendered
without a `label` has only its 20×20 glyph box as the `Pressable`, which sits below the 44px
floor at every scale, including `1x`. This is a static baseline gap unrelated to font
scaling (the box does not shrink further as scale increases — it was already undersized),
so it does not violate this issue's "hit targets survive scale" requirement. It is a
legitimate general accessibility follow-up, tracked separately from #143 rather than fixed
here to avoid scope creep into every consumer of bare `Checkbox`/`Radio`.

## Icon/text alignment stays usable

Rows composing an icon/glyph with text either center-align on a single line
(`flex-row items-center`, used by `Button`, `Chip`, `ListItem`) or top-align
(`flex-row items-start`, used by `Toast`) so that when the text wraps to multiple lines at
large scale, the icon stays aligned to the first line rather than being vertically centered
against a now-multi-line block. No audited component top-aligns text against a
center-anchored icon or vice versa.

## Reusable fixtures/helpers

`apps/showcase/__tests__/helpers/dynamic-type.ts` is the shared, non-test fixture module
this contract is built on, so a future component's test file (Tooltip/Sheet/Table/Calendar,
or any Showcase pattern/demo) can assert the same contract instead of re-deriving stress
levels, source-scanning regexes, or allow-lists:

- `FONT_SCALE_STRESS_LEVELS` — the four canonical stress levels above.
- `withFontScale(scale, fn)` — deterministically stubs `PixelRatio.getFontScale()` for the
  duration of `fn`; used to prove a component's rendered props/classes do not fork based on
  the reported font scale (BeeUI components must not read this value to change layout).
- `stressText(label, repeat?)` — a long representative string for wrap-vs-clip assertions.
- `INTENTIONAL_TRUNCATION_POINTS` / `FIXED_HEIGHT_ALLOWLIST` — the authoritative,
  test-enforced tables backing the two sections above; a new component adding a
  `numberOfLines` or a fixed-height text row must add an entry here (and to this doc) or its
  test suite should fail via `findUnlistedFixedHeightClasses`/the truncation-points scan.
- `readAllComponentSources()` / `readComponentSource()` / `UI_COMPONENT_SOURCE_FILES` —
  shared source-scan plumbing so new suites don't reimplement file discovery.
- `containsFontScalingOptOut()` / `countNumberOfLinesUsages()` /
  `findUnlistedFixedHeightClasses()` — the three scanner primitives the contract test uses,
  exported so a future component-specific test can run the same checks scoped to just its
  own file(s) without duplicating the regexes.

## Evidence

This issue's evidence is **deterministic contract evidence**: source-scan assertions plus
`@testing-library/react-native` component-prop assertions in
`apps/showcase/__tests__/dynamic-type-contract.test.tsx`, run under `jest-expo`. It proves:

- no component disables font scaling;
- every `numberOfLines` usage is accounted for and documented;
- every fixed, non-`min-h-*` height class on a text-bearing row is either the two corrected
  controls (verified to now use `min-h-*`) or an explicitly allow-listed decorative/invariant
  control;
- the native touch-target guard classes are present regardless of the font scale a component
  observes;
- representative growable rows (`Checkbox`, `Chip`, `AlertBanner`, `Text`) render their full
  given content, unclipped, at every audited stress level;
- semantic `Text` roles never hardcode a pixel size (Web zoom/rem-scaling stays intact).

**What this evidence does not prove.** `jest-expo`'s React Native mock layer does not run a
real native layout/text-measurement engine, so this suite cannot measure actual rendered
glyph metrics, line-wrap points, or on-device clipping. There is no iOS Simulator/Android
Emulator/device run and no Playwright browser-zoom run backing this issue.

`Native runtime: SKIPPED — foundation/fixtures; deterministic scaling asserted via test
seams (source-scan + rendered prop assertions), not a device claim. No component reads
`PixelRatio.getFontScale()`/`allowFontScaling` differently across the audited range, so a
real device run would exercise the OS's own text-scaling pipeline, not BeeUI-specific
branching — there is no BeeUI-owned scaling logic left to prove on-device beyond what a
future release-candidate device pass already covers.`

`Visual regression: SKIPPED — the two component changes (`SelectTrigger`, `PaginationItem`
switching `h-*` to `min-h-*`) do not change default-scale rendered height/appearance
(`min-h-11`/`min-h-10` still floor at the same 44px/40px), so no `apps/visual-regression`
baseline changes.`
