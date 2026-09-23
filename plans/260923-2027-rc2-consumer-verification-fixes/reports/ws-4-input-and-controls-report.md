# WS-4 report: Input and controls (#606, #589, #600, #568, #631 item 3, Input accent colour)

Branch `ws4-input-and-controls` (from `243c4ae`). Worktree:
`/Users/textsoft/workspace/BeeUI/.claude/worktrees/agent-a04b50072f316428b`.

| Commit | Scope |
|---|---|
| `52e28b3` | `input.tsx`: keydown bubbling, native line height, Web placeholder colour + jest/spec |
| `ff17dd2` | `segmented-control.tsx`: content-sized segments with word-boundary floors + jest |
| `c7b66e2` | `icon-button.tsx`: size merge order, `sm` hitSlop + jest |
| `4bd627e` | `button.tsx`: centred wrapped labels + jest |
| `fe12d6e` | visual-regression fixture (`controls-sizing`, extended `keydown-bubble`) + `controls-sizing.spec.ts` |
| (this commit) | this report |

`search-input.tsx` needed no change; it renders `Input`, so it gets every Input fix. Tests
cover it explicitly.

## #606 keydown does not bubble from a focused Input/SearchInput (Web)

**Scope gap in the old spec.** `input-keydown-bubble.spec.ts` was `test.fixme`, so it was
never run ("green" meant skipped). It also covered only `Input`, only `document`, only `a`.

**Who stops propagation.** Not BeeUI. `react-native-web@0.21.0`
`dist/exports/TextInput/index.js:270-273` (`handleKeyDown`) calls `e.stopPropagation()` on
every keydown ("Prevent key events bubbling (see #612)") before `onKeyPress`, whether or
not the field uses the key; line 361 wires it as the input's `onKeyDown`. React runs it
from its listener on the root container (react-dom 19.2.3 `SyntheticEvent.stopPropagation`
forwards to the native event), so the event stops at the root and never reaches `document`
or `window`. Capture listeners and native listeners inside the root already ran, which is
why capture-phase workarounds worked. BeeUI source never calls `stopPropagation` here.

**Fix (BeeUI-side, Web only).** `Input` puts a target-phase `keydown` listener on its own
DOM node. For that one event it swaps in a `stopPropagation` that skips exactly one call:
the first one made while `currentTarget` is a React listening container (react-dom marks
those with an own `_reactListening<random>` expando, verified in react-dom 19.2.3). Because
the field's `onKeyDown` is the innermost React handler, that call is react-native-web's.
What is unchanged:
- React still marks the synthetic event as stopped, so React ancestors (Toolbar/Tabs roving
  focus, Select listbox) still ignore keys typed into a field.
- A caller's own `onKeyPress` `stopPropagation()` still stops the key (second call is real).
- Nothing is re-dispatched, so capture listeners see each key once.
- BeeUI's own Escape handling: overlays use capture-phase `document` listeners that stop
  the event before it reaches the field, so they are unaffected. The Window bubble bridge
  now also sees Escape from a focused field, which is what it was written for.

If a future react-dom renames the marker, the skip stops matching and behaviour falls
back to today's (no bubbling). The spec catches that.

**Tests.** `input-keydown-bubble.spec.ts` rewritten: Input and SearchInput × window/document
× capture/bubble × `a`, `Escape`, `Enter`, `F3`, `Alt+1`, `Control+k`, each exactly once;
a plain `<input>` harness control; typed text still lands; SearchInput Enter reaches
listeners with `defaultPrevented: true` (the field consumed it as submit); an Input whose
`onKeyPress` stops propagation still hides keys from window/document.

Red on `243c4ae` (unfixed components, same spec):
```
✘ a focused Input lets keydown bubble to window and document exactly once
    Error: Input, a
    -   "document-bubble": 1,   +   "document-bubble": 0,
    -   "window-bubble": 1,     +   "window-bubble": 0,
✘ a focused SearchInput lets keydown bubble ... (same, "SearchInput, a")
✘ SearchInput marks the Enter it consumes ... Expected length: 2  Received length: 0
```
Green after the fix (all 7 keydown tests).

Not covered: `Textarea` and `OtpInput` render `TextInput` directly (not my files) and still
swallow keydown. `PasswordInput` renders `Input`, so it is fixed.

## #589 Input/SearchInput clip descenders at accessibility-large text

**Cause.** `leading-5`/`leading-6` set a fixed native `lineHeight`. RN scales it with the
font, but iOS bottom-aligns a single-line field's glyphs in an explicit paragraph line box,
so at 2.14× the descenders crossed the border (BeePOS: 53 pt box, 34 pt text).

**Fix.** Font size is still `text-[length:var(--text-label|body)]`. Line height is now
`web:leading-[var(--text-*--line-height)]` only. Native fields take their line box from the
font's own metrics, which scale with the glyphs. On Web the token line height is `rem`-based
and tracks the token font size. Computed values are 20px/24px, the same as `leading-5/6`,
so Web 1x visuals and textarea row maths are unchanged. `min-h-*` is kept.

**Tests.**
- jest `input-line-height-follows-font-size.test.tsx`: Input sm/md/lg and SearchInput carry
  no native-effective `leading-*` at any stress font scale, and do carry the Web token
  line height and semantic font size. Red on `243c4ae`: `"utilities": ["leading-6"]`
  (`leading-5` for sm), 8 failures.
- Playwright `controls-sizing.spec.ts`: at 1x the heights are 36/44/48/44 and line heights
  20/24/24/24 (equivalence). Native-like scaling is simulated by scaling only the
  typography tokens ×2.14 and leaving `--spacing-*` alone. A root font-size override
  scales control heights in lockstep and cannot expose this. The spec asserts line box
  ≥ glyph extents (canvas font ascent+descent, including the actual string), content box
  ≥ glyph extents, and line box scale ≈ 2.14. Red on `243c4ae`:
  `sizing-input-sm line box vs glyph extents — Expected: >= 35, Received: 20`.
- `theme-token-consumers-v2.test.ts` updated to the new contract.

**Evidence limit.** The iOS glyph placement itself is native rendering. Chromium cannot
reproduce it, and I did not run the simulator: the booted iPhone 16 Pro was shared with
other workstreams. A native check at `content_size accessibility-large` with "Chuối già
Nam Mỹ" is still needed (controller/BeePOS).

## #600 SegmentedControl breaks labels mid-word in a narrow container

**Cause.** Items were `flex-1` (equal split), with no measurement.

**Fix.**
- Items are `shrink grow basis-auto`, so they start from their label width.
- Each string-labelled item measures its widest word with an invisible, `aria-hidden` copy
  of the label laid out one word per line. The floor is `ceil(widestWord + 2 × labelInset) + 1`,
  where `labelInset` is the label's x-offset inside the item, i.e. padding + border. Both
  terms stay constant as the item width changes, so there is no layout feedback loop.
- The control collects the floors. If they cannot all fit, it scales them down
  proportionally (`resolveMinWidthScale`), so the segments never overflow the control. In
  that case a mid-word break is unavoidable.
- The floor is an inline `minWidth` placed before the caller's `style`.
- On Web, `web:min-w-min` (CSS min-content) gives the right floor on the very first frame,
  before measurement lands. See the DateTimePicker note below.
- Large-text word wrapping (the earlier fix, label `w-full`) is kept.

**Tests.**
- jest (`segmented-control-name-and-label-wrap.test.tsx`, 5 new): no `flex-1`; the
  measurement copy is hidden from a11y; floors = widest word + chrome + 1; floors scale by
  available/required when they cannot fit; caller style wins. All 5 red on `243c4ae`.
- Playwright: 192px container with "chai / lốc 6 / thùng 24" has no word spanning two lines
  and no segment outside the control. Also checked at 1.5× root font (both controls), and
  at 2.14× text-only (the "Sáng / Tối / Theo hệ thống" control wraps between words; the
  narrow control stays inside its bounds). Red on `243c4ae`:
  `{"segment": "sizing-segment-thung", "word": "thùng", "lines": 2}` at 1x and at 1.5×.

Side effect found: on `243c4ae` the Web DateTimePicker's AM/PM control also broke mid-word
("A/M", segments 48×58). With the fix they are single-line, 48×38.

## #568 IconButton size="sm" renders 44px

**Cause.** IconButton passed `Button size="icon"` (`h-control-icon w-control-icon`) and
added its own size classes through `className`. tailwind-merge (plain `twMerge`) does not
see custom token names as conflicting `h-*`/`w-*` values, so both reached the element and
stylesheet order decided the size: `lg` won, `sm` and `md` got the icon size.

**Fix.** IconButton renders `Button size={null}` (no cva size variant) and owns the square
geometry. Exactly one `h-`/`w-` token reaches the element per size.

**Touch-target policy.** `docs/density.md` and `docs/dynamic-type.md` set a native ≥44dp
tappable floor. Web has no floor (`Button size="sm"` is 36px on Web). The old
`ios:/android:min-h/min-w-touch-target` guard on IconButton `sm` grew the *visual* box to
44, which made `sm` look like the default size. `sm` now keeps its 36px visual box and gets
`hitSlop` of `(controlSize.touchTarget − controlSize.compact)/2 = 4` on each side on
iOS/Android. That gives a 44×44 tappable region, with values from `@beemvp/beeui-tokens`.
A caller's `hitSlop` wins. The Web pointer target equals the visual box, like Button `sm`.
The `FIXED_HEIGHT_ALLOWLIST` rationale in `helpers/dynamic-type.ts` is updated to match.
`Button sm` / `Input sm` keep their guard classes. `docs/dynamic-type.md` does not list
IconButton, so no doc is stale, but a docs owner may want to mention the hitSlop pattern.

**Tests.**
- jest: each size carries exactly one height/width token; `sm` has no touch-target class
  and `hitSlop {4,4,4,4}`; md/lg/default have no hitSlop; a caller's hitSlop wins. Red on
  `243c4ae`: sm, md and lg each show a second `control-icon` token; the old guard is present
  and there is no hitSlop.
- Playwright rendered boxes: default 44, sm 36, md 44, lg 48. Red on `243c4ae`:
  `sizing-icon-button-sm: 44×44` (expected 36).

## #631 wrapped ButtonLabel is left-aligned

Numbering note: in the issue body this is item **2** ("Wrapped ButtonLabel is
left-aligned"). Item 3 is Stepper contrast, which belongs to W5. I followed the brief's
description.

**Fix.** `text-center` added to the `buttonLabelVariants` base. It applies to string
labels, cloned `ButtonLabel` children and standalone `ButtonLabel`. It does nothing on a
single line. `labelClassName="text-left"` still overrides it.

**Tests.**
- jest: 4 tests (3 red on `243c4ae`).
- Playwright: in a 160px column, "Thêm thanh toán · 13.200 đ" wraps to ≥2 lines, and every
  line centre is within 3px of the button centre. The 3px covers half a trailing space,
  because react-native-web text is `pre-wrap`. Red on `243c4ae`: `Received: 33.33` (both the
  string label and the ButtonLabel child).

## Input accent colour on Web (coordinator follow-up, same root cause as #592)

On Web, Uniwind's `TextInput` resolves only `placeholderTextColorClassName`, through
`useUniwindAccent` (a first-render stylesheet lookup: `uniwind@1.10.1`
`src/components/web/TextInput.tsx`). On a cold load that logs the `accent-*` warning and
leaves the browser-default placeholder colour. This follows eb269d9 (Spinner/Switch):
- Web passes `placeholderTextColor = var(--color-muted-foreground)` via
  `semanticColorVariable`. A caller's `placeholderTextColor` wins.
- Web passes no accent classes. Cursor, selection and underline colours have no
  react-native-web TextInput equivalent.
- Native keeps all five accent classes unchanged.

**Tests.**
- jest `input-placeholder-colour-web-theme-variable.test.tsx` (Input, SearchInput, caller
  override, native bridge). Red on `243c4ae`: `Expected: "var(--color-muted-foreground)"
  Received: undefined` (2 failures).
- Playwright checks that the computed `::placeholder` colour equals the resolved theme
  variable. This is a runtime guard: it passes on a warm load either way, and the cold-load
  race itself is not reproduced.

## Verification (final code)

- `packages/ui` typecheck ✅. `pnpm lint` ✅. `apps/showcase` `tsc` ✅. visual-regression
  typecheck ✅ (after `pnpm --filter @beemvp/beeui-ui build`).
- Touched + related jest suites: 13 suites, 142 tests ✅. Full showcase jest on final code:
  138 suites, 1216 tests ✅. An earlier full run had 2 failures that were 5s timeouts
  under host load and passed in isolation (`overlay-scope` passed with `--testTimeout=30000`).
- Playwright (local Chromium, private port):
  - `input-keydown-bubble.spec.ts` + `controls-sizing.spec.ts`: 15/15 ✅.
  - Fixture specs (keyboard-roving-focus, select-overflowing-list-mouse-pick,
    sheet-backdrop, table-row-interactive-descendants, tooltip-fixture, dialog role
    uniqueness, motion-reduced, data-typography, theme-scope-tokens, tooltip-high-contrast):
    ✅.
  - Showcase-integration specs, 19 files: 131/132 ✅. `select-showcase.spec.ts` "Select
    opens, navigates, and selects from the keyboard" fails identically on unmodified
    `243c4ae`, so it is pre-existing and not caused by this workstream (Select is W2).
- `docs:reference/surface/contract/examples`, `llms`, `ai-contract`, `compat`,
  `tokens:consumption`, `ui-exports`, `hygiene` checks ✅. **`docs:portal-pages:check` is
  stale** for button.md, icon-button.md, input.md, search-input.md and segmented-control.md.
  These are generated pages (controller-owned). Run `pnpm docs:portal-pages:generate` at
  integration.

## Expected visual changes (baselines not updated)

These were found by recording the 8 canonical projects from the unfixed build as a local
reference, then comparing the fixed build (`visual`, `density`, `high-contrast-focus`,
`scoped-preview`, `dataviz-brands`, `date-production`, `table-production`):
- `visual.spec.ts` › `forms` and `pattern-sign-in`, all 8 theme × viewport projects (16
  PNGs), about 200 px each. The PasswordInput "Show password" toggle label wraps to two
  lines and is now centred.
- `date-production.spec.ts` › "DateTimePicker opens its bounded Calendar and time controls
  in a Popover" (desktop-light) fails its geometry assertion (`gap ≤ 24`, got 34), and its
  PNG will change.

**Concern: the DateTimePicker gap is a positioning issue, not a SegmentedControl issue.**
- The popover content is 20px shorter now that AM/PM no longer break mid-word (468 vs 488px).
- In both builds the content's top sits at the same document offset (clamped to the
  viewport top, then the page scrolls by 498px). A shorter popover therefore ends 20px
  further above the trigger.
- The old test passed only because the mid-word-broken AM/PM made the content tall enough.
- The popover's position is independent of its height here, which points at
  anchor-vs-scroll timing in the overlay/DatePicker code (not in W4 ownership).
- The controller should decide: re-baseline and relax/re-anchor this check, or fix the
  popover's anchoring (pre-existing).

## Not done / out of scope

- Native (iOS/Android) runtime evidence for #589 and the IconButton hitSlop; simulator not
  used (shared).
- Textarea/OtpInput keydown bubbling, which would need the same listener in files outside
  W4.
- `descriptionNativeID` / `aria-describedby` on Input is left to the other workstream, as
  instructed.
