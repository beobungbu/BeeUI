# TalkBack release matrix (#148, R3.10)

This is BeeUI's reusable Android TalkBack release checklist, required after native 1.0
component work (#153 Tooltip, #160 Sheet, #167 Table/DataTable, #176 Calendar/date) has
established each component's own local accessibility semantics. It complements, and does
not replace, `docs/accessibility-contract.md` (#150, the consolidated per-component
contract), `docs/voiceover-release-matrix.md` (#147, the iOS counterpart), and
`docs/keyboard-focus-acceptance-matrix.md` (#146, the Web keyboard/focus matrix this
document's structure mirrors).

Per #148's own sequence rule, this matrix is post-component acceptance and does not block
initial R4 implementation.

## Evidence-honesty rule for this document

Per `docs/agent-execution-contract.md` and `docs/beeui-1.0-evidence-classes.md`, this
document states the strongest evidence class actually obtained, never the strongest
evidence class desired. As `docs/accessibility-contract.md` § "Native screen readers"
already records, **BeeUI has zero recorded assistive-technology evidence-class entries**
for any component as of this writing:

- No BrowserStack (or equivalent) TalkBack-automation infrastructure exists in this
  repository. `plans/reports/researcher-260830-2346-real-device-cloud-testing-options.md`
  surveyed the available real-device/screen-reader-automation cloud services for BeeUI's
  Maestro-based runtime harness; **BrowserStack App Automate is the only service that
  documents VoiceOver/TalkBack automation on real devices**, and adopting it (OSS-program
  application, EAS build wiring, a new CI job) was **not adopted** for 1.0 — it remains a
  documented, deferred option, not a rejected one.
- BeeUI already runs a real Android emulator harness for a different axis
  (`scripts/runtime-smoke/android-dynamic-type.sh`, cited in `docs/accessibility-contract.md`
  for Dynamic Type font-scale evidence). That harness exercises `font_scale` only — it is
  not a TalkBack driver, and does not currently provide screen-reader traversal or
  announcement evidence.
- #349 (headless iOS Simulator Fabric blank-render after mid-gesture overlay unmount)
  is iOS-specific and does not block Android runtime evidence — `docs/native-runtime-
  smoke.md`'s own Android leg already runs green in CI. TalkBack acceptance's gap is not a
  CI infrastructure bug parallel to #349; it is simply that no screen-reader-automation
  layer exists on top of the working Android runtime harness.

This document therefore does not, and does not claim to, provide assistive-technology
evidence itself. It provides two things instead:

1. **Part A** — the exact deterministic-contract evidence (RN accessibility props/roles/
   labels, asserted in Jest/RNTL) that already exists for every TalkBack-relevant surface
   #148 enumerates. This is the automatable half: it proves each component *requests* the
   right semantics, not that TalkBack announces them correctly.
2. **Part B** — a repeatable, human-run TalkBack manual release-gate checklist: what a
   tester runs on a real Android device or emulator, with TalkBack on, before a release
   candidate freezes, including the Android-specific proof #148 names (hardware Back
   interaction, traversal order, modal child-first dismissal, keyboard/input flows not
   hiding focused controls).

Do not describe a component as "TalkBack-verified" on the strength of Part A alone. Part A
backs the accessible-name/role/state contract; only a completed Part B run for the exact
release-candidate build produces assistive-technology evidence per
`docs/beeui-1.0-evidence-classes.md`.

## Part A — Deterministic accessibility-props contract (automated, already evidenced)

This table cites the exact test files/names that assert the RN accessibility props
TalkBack depends on for each surface #148's "Coverage" section names. It does not repeat
the full per-component contract — see `docs/accessibility-contract.md` for that — it
extracts only the props relevant to what a TalkBack user would hear or navigate.

| Surface | Accessible name / role source | State / relationship props asserted | Evidence |
| --- | --- | --- | --- |
| Forms | `Field`/`Label` centralize label linkage; `Field disabled` maps to `editable={false}` (a real Tab/focus stop that is read-only, matching Android's own read-only-field convention — no separate non-focusable concept) | `accessibilityState.disabled`/`accessibilityHint` for error text | `apps/showcase/__tests__/component-contracts.test.tsx` "propagates Field label, error, and state into Input", "keeps disabled inputs non-editable while preserving accessibility state" |
| Modal overlays (Dialog/AlertDialog) | `DialogTitle`/`DialogDescription` register `accessibilityLabel`/`accessibilityHint`; `accessibilityViewIsModal` boundary | `AlertDialogAction`/`AlertDialogCancel` accessible names; AlertDialog never dismisses via backdrop (by design — matters for Back-button parity, see Part B row 3) | `apps/showcase/__tests__/component-contracts.test.tsx` "opens and closes an uncontrolled Dialog...", "dismisses Dialog from its semantic backdrop and reports state changes"; `issue-15-alert-dialog-form-group.test.tsx` "keeps AlertDialog open when its backdrop is pressed" |
| Anchored overlays (Popover, DropdownMenu, Select) | trigger/item accessibility state and labels via RN semantics (no native listbox/menu container role — RN has none) | `accessibilityState.expanded` on trigger; nested child-first dismissal | `issue-21-popover.test.tsx` "preserves caller trigger state while adding expanded and controls semantics", "dismisses nested Popovers child-first for outside presses"; `issue-36-dropdown-menu.test.tsx` (`accessibilityState.expanded` assertions) |
| Tooltip (native long-press policy) | content text merged into trigger `accessibilityHint` unconditionally; bubble hidden from the accessibility tree | accessibility-escape dismissal | `issue-153-tooltip-native.test.tsx` "merges tooltip content text into the trigger accessibilityHint unconditionally, before any reveal", "hides the visual bubble from the accessibility tree unconditionally", "dismisses on accessibility-escape without any touch or focus movement" |
| Toast | Android live-region behavior (`AlertBanner`'s `accessibilityLiveRegion="polite"`) shared by Toast's own announcement runtime | de-duplicated announcement per mount | `apps/showcase/__tests__/toast.test.tsx` "exposes polite live-region semantics without hiding actions"; `component-contracts.test.tsx` "maps AlertBanner variant content to a polite live region by default" |
| Sheet | `SheetTitle`/`SheetDescription` register the same accessibility relationship as Dialog; Android hardware back is consumed while open and routes through the same `onRequestClose` contract as backdrop/gesture dismissal | `dismissOnRequestClose` gates whether Back actually closes vs. only notifies | `issue-158-sheet-native.test.tsx` "registers SheetTitle/SheetDescription into the content accessibility relationship", "consumes Android hardware back while open and closes the Sheet", "notifies onRequestClose without closing on Android back when dismissOnRequestClose is false" |
| Table / DataTable | row/column context folded directly into each native cell's `accessibilityLabel` (RN has no table/row/cell role) | explicit `accessibilityLabel` override never clobbered; 44dp touch-target floor kept | `table.test.tsx` "folds column context into a plain-text cell native accessible name", "does not override an explicit accessibilityLabel on TableCell", "keeps the native touch-target floor guard on the sort trigger and on every row (#167)" |
| Calendar / date-time controls | grid `accessibilityLabel` defaults to visible month/year; day cell names include date + today/selected/disabled state | polite live-region month/year-change announcement; AM/PM control fully omitted for 24h locales | `issue-176-calendar-date-a11y.test.tsx` "exposes grid/row/cell roles, with each cell genuinely nested inside a row inside the grid", "announces the visible month/year change via a polite live region as navigation happens", "omits the AM/PM control (and its accessibility label) entirely for a 24h locale, not merely hiding it visually" |
| Settings/list rows | `ListItem`/`SettingsItem` gain `listitem` role only when owned by a `ListGroup` (never an orphan claim); inferred button label composition | ownership-scoped role (load-bearing regression) | `issue-276-structural-status-a11y.test.tsx` "gains the listitem role only once owned by a ListGroup wrapper...", "wraps an interactive SettingsItem row the same way as ListItem" |

An audit of the above (and the full file list in `docs/accessibility-contract.md`'s
"Evidence index") found no genuinely missing, cheap deterministic-a11y-props test to add
for #148's coverage list — every surface #148 names already has at least one load-bearing
Jest/RNTL assertion for its accessible name, role, or state props, including the
Android-specific hardware-back contract (`issue-158-sheet-native.test.tsx`). The gap #148
exists to close is entirely in Part B below, not in this deterministic layer.

## Part B — Manual TalkBack release-gate checklist (real device/emulator, before RC freeze)

Run this checklist with TalkBack **on** (Settings → Accessibility → TalkBack) against the
exact release-candidate build/SHA, on a real Android device where possible (an emulator is
acceptable but must be labeled as such in the log — see "What each checklist run must
record"). Record results in the "Evidence record log" below.

| # | Flow | TalkBack steps | Expected behavior | Verifies |
| --- | --- | --- | --- | --- |
| 1 | Forms | Swipe to an `Input` inside an invalid `Field`; listen | TalkBack announces the field's label, then its error text, in one coherent utterance | Row "Forms" |
| 2 | Modal overlay — Dialog | Activate a `Dialog` trigger | TalkBack focus moves into the dialog; the title is announced; swiping does not escape into background content | Row "Modal overlays" |
| 3 | Modal overlay — AlertDialog + hardware Back | Activate a destructive-confirmation trigger, then press the **hardware Back button** | The AlertDialog does **not** dismiss on Back (matches its documented "never dismisses via backdrop/Escape" contract — Back must not be a silent bypass of that contract); an explicit Cancel/Action does dismiss it | Row "Modal overlays" — **Android-specific proof** |
| 4 | Anchored overlays / Select | Open a `Select`; navigate options with swipe | Each option announces its selected state in traversal order; a two-finger "back" gesture or hardware Back closes without changing selection | Row "Anchored overlays" — **Android-specific proof (traversal order)** |
| 5 | Tooltip | Long-press (or external-keyboard/Switch Access focus) a `Tooltip` trigger | TalkBack announces the trigger's label plus the tooltip hint in the same utterance; the bubble is never separately swipe-reachable | Row "Tooltip" |
| 6 | Toast | Trigger an action that shows a `Toast` | TalkBack announces the toast content once via the live region, without a duplicate or interrupted announcement | Row "Toast" |
| 7 | Sheet — modal child-first dismissal | Open a `Sheet` from inside another already-open overlay (e.g. a `Sheet` opened from a `Dialog`); press hardware Back | Back dismisses the **topmost** (child) surface first, never both at once and never the wrong one | Row "Sheet" — **Android-specific proof (modal child-first dismissal)** |
| 8 | Sheet — focused input stays visible | Open a `Sheet` containing a text `Input`; focus the input to raise the soft keyboard | The focused input remains visible above the keyboard (not hidden behind it); TalkBack focus is not silently lost when the keyboard raises | Row "Sheet" — **Android-specific proof (keyboard/input flows do not hide focused controls)**; see `docs/accessibility-contract.md`'s documented `avoidKeyboard={false}` gorhom-upstream limitation for the one known exception |
| 9 | Table / DataTable | Swipe through table rows; activate a sort-header trigger | Each cell announces its composed "`<column>`: `<value>`" label in row-then-column traversal order; the sort trigger announces its updated state after activation | Row "Table / DataTable" — **Android-specific proof (traversal order)** |
| 10 | Calendar / date-time controls | Open a date/time control; swipe through day cells; navigate months | Each day cell announces the full date plus today/selected/disabled state; month navigation triggers a spoken announcement without an extra swipe | Row "Calendar / date-time controls" |
| 11 | Settings/list rows | Swipe through a `ListGroup`/`SettingsItem` list | Each row announces its full composed label; list traversal order matches visual order | Row "Settings/list rows" — **Android-specific proof (traversal order)** |
| 12 | Production-demo navigation | *(deferred — the production demo (`apps/demo`, #258–#263) now exists, but on-device TalkBack acceptance of its flows is owner-gated RC (#248/#249), not run here)* | — | Deferred |

### What each checklist run must record

Per #148's evidence policy, every completed run of the table above must record, in the
evidence log:

- exact device or emulator model and Android/TalkBack version;
- exact app build identifier and the release-candidate git SHA under test;
- whether TalkBack was run on physical hardware or an emulator — state which, and do not
  conflate the two (emulator accessibility-service behavior can diverge from real
  hardware, particularly for gesture timing and Back-button semantics);
- pass/fail per row, with a one-line note on any deviation;
- explicit confirmation for rows 3, 4, 7, 8, 9, and 11 (the Android-specific proof rows
  #148 names by name) — these must never be silently skipped even when time-constrained.

### Evidence record log

| Date | RC SHA | Device/emulator + Android/TalkBack version | Method | Rows passed | Rows failed / notes | Tester |
| --- | --- | --- | --- | --- | --- | --- |
| _(none recorded yet)_ | — | — | — | — | — | — |

## Known limitations (honest, not silently omitted)

- **No TalkBack automation infrastructure exists in this repository.** Part B above is,
  by design, a human-run checklist, not a CI gate. See "Evidence-honesty rule" above.
- **Emulator TalkBack behavior can diverge from physical-device TalkBack behavior**,
  particularly for gesture timing, Back-button semantics, and soft-keyboard interaction —
  an emulator-only pass is weaker evidence than a physical-device pass and must be labeled
  as such in the log.
- **Production-demo rows are deferred** until a production-demo surface exists, per #148's
  own sequence rule — the same deferral `docs/keyboard-focus-acceptance-matrix.md` already
  applies for #146.
- This document does not certify BeeUI as meeting any formal accessibility standard
  (WCAG conformance level, VPAT, etc.); it documents the strongest evidence actually
  obtained for the flows #148 enumerates, per `docs/beeui-1.0-evidence-classes.md`.

## Cross-references

- `docs/accessibility-contract.md` § "Native screen readers" — the consolidated statement
  that no component has assistive-technology evidence yet.
- `docs/voiceover-release-matrix.md` (#147) — the iOS counterpart to this document.
- `docs/keyboard-focus-acceptance-matrix.md` (#146) — the structural model this document
  follows.
- `plans/reports/researcher-260830-2346-real-device-cloud-testing-options.md` — the
  device-cloud/AT-automation research this document's evidence-honesty section summarizes.
