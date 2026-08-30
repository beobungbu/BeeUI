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
  `theme-token-consumers-v2.test.ts`), never a literal pixel/point value. This is what makes
  BeeUI text respond to the browser's/OS's **default text-size preference** — the setting
  (e.g. a browser's "Font size" option, or an OS-level accessibility text-size control) that
  changes what one `rem` resolves to: because the generated theme is `rem`-based, that
  preference scales BeeUI text the same way it scales any other `rem`-sized page content.

  This is a **separate mechanism from browser page zoom** (Cmd/Ctrl `+`/`-`, or pinch-zoom).
  Page zoom is a browser-level rendering scale that affects the whole rendered page —
  `rem`-sized text, `px`-sized borders/padding, images, everything — not something `rem`
  "makes work." `rem`-based sizing is necessary for BeeUI to respond correctly to the
  default-text-size preference; it is not why page zoom scales BeeUI content, and BeeUI does
  not need a separate zoom-specific mechanism for either: both are browser-owned scaling
  paths that a correctly `rem`-based, non-pixel-hardcoded component surface passes through
  by construction.

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

| Component | Behavior | Occurrences | Why |
| --- | --- | --- | --- |
| `SelectValue` (`select.tsx`) | `numberOfLines={1}` | 1 | Renders the single persisted combobox value, matching native single-line select/picker trigger conventions on iOS/Android/Web. The full value stays reachable by opening `SelectContent`. |
| `Textarea` (`textarea.tsx`) | Forwards a caller-controlled `numberOfLines` (default `4`) | 2 | Sizes the multiline **editable** viewport row count, not a single-line clip — this is a growable multiline field (`h-auto min-h-24`), and callers may raise `numberOfLines` for more visible rows. (2 counts the destructured default and the forwarded JSX prop — one caller-facing behavior, two textual matches.) |

The guard is **occurrence-specific, not just filename-specific**: each row above documents an
exact expected occurrence count, and the contract test compares that count against the real
number of `numberOfLines=` matches in the file. Adding a *new* `numberOfLines` usage anywhere
in `packages/ui/src/components` — including a second occurrence in a file that already has one
documented — without updating the matching count in `INTENTIONAL_TRUNCATION_POINTS` (and this
table) is a contract violation. A presence-only ("this file already has a documented
truncation point") check cannot see a second, different occurrence in the same file; the exact
count can.

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

Real-browser evidence (see [Evidence](#evidence) below) confirmed this fix's benefit is
primarily **native**-relevant: on Web, every BeeUI sizing token — fixed `h-*` and growable
`min-h-*` alike — resolves through the same `rem`-based theme, so under the browser's
default-text-size preference and under page zoom, a fixed-height row's own height grows in
lockstep with its text (both scale by the same factor). React Native layout heights on native
are static `dp`/`pt` values that do **not** themselves grow with OS Dynamic Type the way `rem`
grows with root font-size on Web — only `min-height` lets a native row's flex layout grow past
its floor to fit larger OS-scaled text. `min-h-*` is still the correct, platform-consistent
choice (and costs nothing at default scale), but its clipping-prevention value shows up on
native, not as a Web rendering difference for this specific short, non-wrapping content.

**Explicitly justified fixed-height rows** — a control stays fixed-height when its content is
decorative/glyph-only (never caller prose) or the fixed height mirrors an accepted,
already-documented invariant. The authoritative list (with the exact allowed class **and its
exact expected occurrence count** per file, plus the rationale) lives in
`FIXED_HEIGHT_ALLOWLIST` in the fixtures module and is enforced by
`dynamic-type-contract.test.tsx`: any `h-*` (non-`min-h-*`) class appearing in
`packages/ui/src/components` that is not in this allow-list fails the test — and so does any
allow-listed class whose **actual occurrence count in that file no longer matches the
documented count** (occurrence-specific, not just file+class-specific: a *new*, unreviewed
occurrence of an already-allow-listed class in the same file — e.g. a second `h-5` row added
to `checkbox.tsx` for an unrelated element — bumps the actual count without changing which
file/class pairs are "known," so a presence-only check would miss it; comparing the exact
count catches it).

| File | Fixed classes (occurrence count) | Rationale |
| --- | --- | --- |
| `button.tsx` | `h-control-compact` (1), `h-control-default` (1), `h-control-large` (1), `h-control-icon` (1) | `Button`'s `controlSize` scale is a documented, density-invariant component-level API ([`density.md`](./density.md) explicitly lists `controlSize` as **not** touched by any runtime axis). The `ios:min-h-touch-target`/`android:min-h-touch-target` guard keeps the tappable region at ≥44px at every scale; `Button` never truncates its label — it wraps within the row instead. |
| `input.tsx` | `h-control-compact` (1), `h-control-default` (1), `h-control-large` (1) | `Input` mirrors the native single-line text-field convention (`UITextField`/`EditText`) and shares `Button`'s density-invariant `controlSize` scale. The touch-target guard on the `sm` size keeps the tappable floor at ≥44px regardless of scale; multi-line growth is `Textarea`'s contract, not `Input`'s. |
| `avatar.tsx` | `h-avatar-sm/md/lg/xl` (1 each), `h-full` (1) | Avatar geometry (image frame / 1–2 character fallback initials) is a fixed decorative badge on every platform convention BeeUI targets; initials are not reflowable prose. |
| `checkbox.tsx` | `h-5` (1) | The 20×20 box is a decorative checked-state glyph; the accessible hit target is the full label row (`Pressable`), not the glyph box. |
| `radio.tsx` | `h-5` (1), `h-2` (1) | Decorative selected-state glyph indicators; not reflowable text. |
| `stepper.tsx` | `h-8` (1) | Decorative circular step-index glyph; not reflowable text. |
| `progress.tsx` | `h-1` (1), `h-2` (1), `h-3` (1), `h-full` (1) | Progress bar track/fill geometry; carries no caller text. |
| `skeleton.tsx` | `h-4` (1) | Decorative static loading placeholder; carries no real text. |
| `separator.tsx`, `dropdown-menu.tsx` (`DropdownMenuSeparator`) | `h-px` (1 each) | Decorative 1px divider line; carries no text. |
| `timeline.tsx` | `h-3` (1) | Decorative status-marker dot; carries no text. |
| `textarea.tsx` | `h-auto` (1) | Not actually a fixed pixel height — `h-auto` grows with content and is paired with `min-h-24`; listed for completeness since the scanner matches the `h-` prefix. |

## Minimum hit targets survive scale

The `ios:min-h-touch-target`/`android:min-h-touch-target` guard (44px / `--spacing-touch-target`,
see [`density.md`](./density.md#native-interactive-hit-target-guarantee)) is a static class,
not a scale-dependent computation, so it cannot regress under font scaling — it is present
on `Button size="sm"`, `Input size="sm"`, `ListItem`/`SettingsItem`, and native `Table`'s
`TableRow` and `TableHead` sort trigger (`table.tsx`, #167) regardless of the OS
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
  test-enforced, **occurrence-specific** tables backing the two sections above. Each entry
  records the exact expected occurrence count (not just "this file/class is known"), so a new
  component adding a `numberOfLines` usage or a fixed-height text row — including a *second*,
  different occurrence in an already-listed file — must add or bump an entry here (and in this
  doc) or its test suite fails via `findFixedHeightClassViolations()`/the occurrence-count
  comparison in the truncation-points scan.
- `readAllComponentSources()` / `readComponentSource()` / `UI_COMPONENT_SOURCE_FILES` —
  shared source-scan plumbing so new suites don't reimplement file discovery.
- `containsFontScalingOptOut()` / `countNumberOfLinesUsages()` /
  `findFixedHeightClassViolations()` — the scanner primitives the contract test uses, exported
  so a future component-specific test can run the same occurrence-specific checks scoped to
  just its own file(s) without duplicating the regexes.
  `findFixedHeightClassViolations(fileName, source)` returns every violation for a file —
  `{ type: 'unlisted', className, actual }` for a class token not allow-listed at all, or
  `{ type: 'occurrence-count-mismatch', className, expected, actual }` for an allow-listed
  class whose real occurrence count no longer matches the documented one.


### Runtime fixture screen

`apps/showcase/runtime-smoke/dynamic-type-acceptance.tsx` is the executable, cross-platform
fixture surface for this contract, reachable from Showcase home with a single tap
(`showcase-open-dynamic-type`). It renders, at the top of the viewport:

- `dynamic-type-font-scale` — a label rendering `PixelRatio.getFontScale().toFixed(2)`, the
  in-app proof that the OS-level font scale reached the running process;
- `dynamic-type-select-trigger` / `dynamic-type-pagination-item-1` — the two rows this issue
  corrected to growable `min-h-*` heights (the native growth-measurement targets);
- `dynamic-type-save-button` / `dynamic-type-email-input` — two representative
  `FIXED_HEIGHT_ALLOWLIST` exceptions (measured by the Web evidence).

Design constraints that make it usable as evidence:

- **One tap from home, targets at the top.** Native font-scale evidence must not depend on
  traversing the Component Gallery: real OS scaling expands every section preceding a deep
  scroll target, so no fixed scroll budget can guarantee reaching it at `2x`. On this screen,
  no audited scale requires scrolling to the measured targets at all.
- **No `AppHeader`.** A measurement surface must not couple to an unrelated component's
  failure; AppHeader has a separate large-text defect (#284) that could otherwise consume the
  scaled viewport above the targets.
- **Home stays navigable at scale.** Showcase home's own header scrolls with the launcher
  catalog instead of sitting above it as fixed chrome — at `2x` a fixed header that tall
  would leave the scrollable launcher list zero usable height and make every surface below
  (this fixture included) unreachable. This is a Showcase layout decision, not a fix or a
  mask for #284's AppHeader defect, which remains open and reproducible on the screens that
  keep fixed headers.
- **Real public components only** — the same `Select`/`Pagination`/`Button`/`Input` instances
  a consumer would render; nothing on the screen forks on the reported font scale.

Future component acceptance work (Tooltip #153, Sheet #158, Table #167) can extend this screen
with its own top-anchored, testID-stable rows and reuse the same per-scale harness.

## Evidence

This issue has **three distinct evidence classes**, kept honestly separate because they prove
different things and none substitutes for another.

### 1. Deterministic contract evidence (policy/guard proof)

Source-scan assertions plus `@testing-library/react-native` component-prop assertions in
`apps/showcase/__tests__/dynamic-type-contract.test.tsx`, run under `jest-expo`. It proves:

- no component disables font scaling;
- every `numberOfLines` usage is accounted for, documented, and **occurrence-exact** — a new,
  unreviewed usage in an already-documented file fails the guard, proven revert-proof by a
  dedicated synthetic-source test;
- every fixed, non-`min-h-*` height class on a text-bearing row is either the two corrected
  controls (verified to now use `min-h-*`) or an explicitly allow-listed decorative/invariant
  control, **occurrence-exact per class per file** — a new, unreviewed occurrence of an
  already-allow-listed class fails the guard, also proven revert-proof by a dedicated
  synthetic-source test;
- the native touch-target guard classes are present regardless of the font scale a component
  observes;
- representative growable rows (`Checkbox`, `Chip`, `AlertBanner`, `Text`) render their full
  given content, unclipped, at every audited stress level;
- semantic `Text` roles never hardcode a pixel size.

**What this evidence does not prove**, and never claims to: `jest-expo`'s React Native mock
layer does not run a real native or Web layout/text-measurement engine, so a stubbed-but-unread
`PixelRatio.getFontScale()` value renders an identical tree at every stress level in this
suite. This class of evidence is a **policy/guard** proof (no opt-outs, every exception is
documented and occurrence-tracked) — it is not, and cannot be, evidence that rendered text
metrics actually change under scale. That gap is closed by the two real-rendering classes
below.

### 2. Real-browser evidence (Web, Chromium)

`apps/visual-regression/tests/dynamic-type-showcase.spec.ts`, run as part of the existing
`apps/visual-regression` Playwright harness against the live Showcase Web build
(`serve-showcase.mjs`), measuring the runtime fixture screen described above. This runs a real
Chromium layout engine — not a stub — and measures actual rendered bounding boxes for the two
corrected components (`SelectTrigger`, `PaginationItem`) and two representative
`FIXED_HEIGHT_ALLOWLIST` exceptions (`Button size="sm"`, `Input`), across two **separately
exercised, honestly distinguished** scaling axes:

- **Root font-size override** — a stand-in for the browser's/OS's default text-size
  preference, which changes what `rem` resolves to (see the Model section above).
- **CSS `zoom`** — Chromium's implementation of real browser page zoom, which scales the whole
  box model (borders/padding included), not only `rem`-sized text — this is what makes it
  page-zoom evidence distinct from the root-font-size run.

It proves, with real measured pixel values: rendered height grows relative to the unscaled
baseline at `1.3x`/`1.5x`/`2x` on both axes; no element's own content ever exceeds its visible
box (`scrollHeight`/`scrollWidth` never exceed `clientHeight`/`clientWidth`); full label text
stays present and unmodified; `SelectValue`'s single-line truncation holds under real layout at
the top of the audited range.

**What this evidence does not prove**, stated honestly: it is Web/Chromium evidence only. It
also does **not**, by itself, distinguish `min-h-*` from a reverted bare `h-*` on Web:
verified by hand on the original evidence run (temporarily reverting both classes and
rerunning the spec against the rebuilt showcase), every BeeUI Web sizing token is `rem`-based,
so a fixed-height row's own height scales in lockstep with its `rem`-based text under both
axes, and `SelectValue`'s content never needs a second line by design — so a fixed-height row
never gets a chance to fall short here. That lockstep property is itself genuine evidence that
Web scaling is safe by construction as long as sizing stays `rem`-based (see "Fixed-height
controls" above); the `min-h-*` vs `h-*` **class-level** regression proof stays the
deterministic contract test's job (§1), and the *behavioral* native proof is §3's job.

### 3. Real native evidence (Android emulator)

`scripts/runtime-smoke/android-dynamic-type.sh`, a sourceable segment executed at the end of
`scripts/runtime-smoke/android.sh` (the `native-runtime-smoke` workflow's Android job). For
each audited scale `1.0` / `1.3` / `1.5` / `2.0` it:

1. sets Android's real system font scale (`settings put system font_scale`) — no
   `PixelRatio` mocks anywhere in the path;
2. cold-relaunches the Showcase app (`clearState`) so the fresh process reads the scale;
3. navigates one tap from home to the runtime fixture screen;
4. asserts the fixture's `dynamic-type-font-scale` label shows the exact expected value —
   in-app proof the OS setting reached the process before anything is measured;
5. asserts both measured targets visible **without scrolling** (they render at the top of the
   fixture screen);
6. takes a single UIAutomator dump and extracts the real rendered accessibility-node bounds
   (`width`/`height` in device pixels) for `dynamic-type-select-trigger` and
   `dynamic-type-pagination-item-1`, appending them to `dynamic-type-metrics.tsv`;
7. captures a full-screen screenshot per scale.

After all four scales, the harness asserts each target produced usable bounds at every scale
and that the `2.0x` rendered height is strictly greater than the `1.0x` height for both
targets — real OS-rendered proof that the corrected `min-h-*` rows grow with Android's actual
font scale (the exact property that is invisible on Web per §2, because native layout heights
are static `dp` values that only `min-height` lets grow). The font scale is restored to `1.0`
afterwards and by the harness cleanup trap on any failure.

**What this evidence does not prove**, stated honestly: it covers Android (emulator), the
representative supported native path for this issue, not iOS — no BeeUI component branches on
platform for text scaling, and no component reads the font scale, so the platform-specific
remainder is the OS text pipeline itself, which iOS release-candidate device passes cover
separately. It measures the two corrected rows, not every component on the audited surface —
per-component native acceptance for the R4 components stays in their own issues
(#153/#158/#167) per this issue's sequence rule.

### Visual regression (canonical snapshot suite)

SKIPPED — the two component changes (`SelectTrigger`, `PaginationItem` switching `h-*` to
`min-h-*`) do not change default-scale (`1x`) rendered height/appearance (`min-h-11`/
`min-h-10` still floor at the same 44px/40px), so no canonical snapshot baseline changes. This
is separate from, and does not substitute for, the real-rendering evidence in §2/§3 above.
