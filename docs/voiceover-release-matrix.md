# VoiceOver release matrix (#147, R3.9)

This is BeeUI's reusable iOS VoiceOver release checklist, required after native 1.0
component work (#153 Tooltip, #160 Sheet, #167 Table/DataTable, #176 Calendar/date) has
established each component's own local accessibility semantics. It complements, and does
not replace, `docs/accessibility-contract.md` (#150, the consolidated per-component
contract) or `docs/keyboard-focus-acceptance-matrix.md` (#146, the Web keyboard/focus
matrix this document's structure mirrors).

Per #147's own sequence rule, this matrix is post-component acceptance and does not block
initial R4 implementation.

## Evidence-honesty rule for this document

Per `docs/agent-execution-contract.md` and `docs/beeui-1.0-evidence-classes.md`, this
document states the strongest evidence class actually obtained, never the strongest
evidence class desired. As `docs/accessibility-contract.md` § "Native screen readers"
already records, **BeeUI has zero recorded assistive-technology evidence-class entries**
for any component as of this writing:

- No BrowserStack (or equivalent) VoiceOver-automation infrastructure exists in this
  repository. `plans/reports/researcher-260830-2346-real-device-cloud-testing-options.md`
  surveyed the available real-device/screen-reader-automation cloud services for BeeUI's
  Maestro-based runtime harness; **BrowserStack App Automate is the only service that
  documents VoiceOver/TalkBack automation on real devices**, and adopting it (OSS-program
  application, EAS build wiring, a new CI job) was **not adopted** for 1.0 — it remains a
  documented, deferred option, not a rejected one.
- Independently, #349 (headless iOS Simulator Fabric blank-render after mid-gesture
  overlay unmount) already blocks reliable *unattended* native runtime evidence on CI for
  overlay-heavy iOS flows, which compounds the case for keeping VoiceOver acceptance a
  human-run, real-device/simulator gate rather than something this repository can
  currently automate end-to-end.

This document therefore does not, and does not claim to, provide assistive-technology
evidence itself. It provides two things instead:

1. **Part A** — the exact deterministic-contract evidence (RN accessibility props/roles/
   labels/hints, asserted in Jest/RNTL) that already exists for every VoiceOver-relevant
   surface #147 enumerates. This is the automatable half: it proves each component
   *requests* the right semantics, not that VoiceOver announces them correctly.
2. **Part B** — a repeatable, human-run VoiceOver manual release-gate checklist: what a
   tester runs on a real iOS Simulator or physical device, with VoiceOver on, before a
   release candidate freezes. This is the currently-unautomatable half, made concrete and
   falsifiable rather than left as a hand-wave.

Do not describe a component as "VoiceOver-verified" on the strength of Part A alone. Part
A backs the accessible-name/role/state contract; only a completed Part B run for the exact
release-candidate build produces assistive-technology evidence per
`docs/beeui-1.0-evidence-classes.md`.

## Part A — Deterministic accessibility-props contract (automated, already evidenced)

This table cites the exact test files/names that assert the RN accessibility props
VoiceOver depends on for each surface #147's "Coverage" section names. It does not repeat
the full per-component contract — see `docs/accessibility-contract.md` for that — it
extracts only the props relevant to what a VoiceOver user would hear.

| Surface | Accessible name / role source | State / relationship props asserted | Evidence |
| --- | --- | --- | --- |
| Form entry/error | `Field`/`Label` centralize label linkage; `Input`/`Textarea` inherit `accessibilityLabel` via `nativeID`; `Field error` maps to `accessibilityHint` | disabled state via `editable={false}` + `accessibilityState.disabled` | `apps/showcase/__tests__/component-contracts.test.tsx` "propagates Field label, error, and state into Input"; `accessibility-readonly.test.tsx` "links Field labels to Input and propagates readable required semantics" |
| Dialog / AlertDialog | `DialogTitle`/`DialogDescription` register `accessibilityLabel`/`accessibilityHint` on the dialog content; role `dialog` (AlertDialog reuses the same kernel, no separate `alertdialog` role) | `accessibilityViewIsModal` boundary; `AlertDialogAction`/`AlertDialogCancel` accessible names | `apps/showcase/__tests__/component-contracts.test.tsx` "opens and closes an uncontrolled Dialog..."; `issue-7-runtime-a11y.test.tsx` "links Dialog content to primitive title and description semantics"; `issue-15-alert-dialog-form-group.test.tsx` "inherits AlertDialog title and description accessibility metadata from the dialog kernel", "defaults AlertDialog action to destructive styling and closes after its handler" |
| Popover | trigger/content accessibility fallbacks; `accessibilityState.expanded` | nested child-first dismissal | `issue-21-popover.test.tsx` "derives non-modal title and description accessibility fallbacks", "preserves caller trigger state while adding expanded and controls semantics", "dismisses nested Popovers child-first for outside presses" |
| Select | trigger/item accessibility state and labels via RN semantics (no native listbox container role — RN has none) | disabled item skip; persistent selected state | `wave-2a-select.test.tsx` "keeps a disabled Select inert and conveys disabled state", "exposes persistent selected option state" |
| DropdownMenu | item accessibility state and labels | `accessibilityState.expanded` on trigger; disabled/checked item state | `issue-36-dropdown-menu.test.tsx` (`accessibilityState.expanded` assertions), "skips a disabled item" |
| Tooltip (native long-press policy) | content text merged into trigger `accessibilityHint` unconditionally; bubble hidden from the accessibility tree | accessibility-escape dismissal; never a Tab/focus stop change on native | `issue-153-tooltip-native.test.tsx` "merges tooltip content text into the trigger accessibilityHint unconditionally, before any reveal", "never overwrites an explicit consumer-provided accessibilityHint", "hides the visual bubble from the accessibility tree unconditionally", "dismisses on accessibility-escape without any touch or focus movement" |
| Toast announcement | `AccessibilityInfo` announcement on iOS; polite live-region semantics on the toast surface | de-duplicated announcement per mount | `apps/showcase/__tests__/toast.test.tsx` "announces each mounted toast only once on iOS", "exposes polite live-region semantics without hiding actions" |
| Settings/list rows | `ListItem`/`SettingsItem` gain `listitem` role only when owned by a `ListGroup` (never an orphan claim); inferred button label composition (`"Title, Description"`) | ownership-scoped role (load-bearing regression) | `issue-276-structural-status-a11y.test.tsx` "gains the listitem role only once owned by a ListGroup wrapper...", "wraps an interactive SettingsItem row the same way as ListItem"; `component-contracts.test.tsx` "forwards ListItem presses with inferred button labeling" |
| Sheet | `SheetTitle`/`SheetDescription` register the same accessibility relationship as Dialog | modal dismissal via backdrop/gesture/Android back all route through one `onRequestClose` contract | `issue-158-sheet-native.test.tsx` "registers SheetTitle/SheetDescription into the content accessibility relationship" |
| Table / DataTable | row/column context folded directly into each native cell's `accessibilityLabel` (RN has no table/row/cell role) | explicit `accessibilityLabel` override never clobbered; 44dp touch-target floor kept on sort trigger/rows | `table.test.tsx` "folds column context into a plain-text cell native accessible name", "does not override an explicit accessibilityLabel on TableCell", "keeps the native touch-target floor guard on the sort trigger and on every row (#167)" |
| Calendar / DatePicker / DateTimePicker | grid `accessibilityLabel` defaults to visible month/year; day cell names include date + today/selected/disabled state | polite live-region month/year-change announcement; AM/PM control fully omitted (not hidden) for 24h locales | `issue-176-calendar-date-a11y.test.tsx` "exposes grid/row/cell roles, with each cell genuinely nested inside a row inside the grid", "announces the visible month/year change via a polite live region as navigation happens", "omits the AM/PM control (and its accessibility label) entirely for a 24h locale, not merely hiding it visually" |

An audit of the above (and the full file list in `docs/accessibility-contract.md`'s
"Evidence index") found no genuinely missing, cheap deterministic-a11y-props test to add
for #147's coverage list — every surface #147 names already has at least one load-bearing
Jest/RNTL assertion for its accessible name, role, or state props. The gap #147 exists to
close is entirely in Part B below, not in this deterministic layer.

## Part B — Manual VoiceOver release-gate checklist (real device/simulator, before RC freeze)

Run this checklist with VoiceOver **on** (Settings → Accessibility → VoiceOver, or
Simulator → Accessibility Inspector for a driven approximation — see "Known limitations")
against the exact release-candidate build/SHA. Record results in the "Evidence record log"
below; do not report this checklist as passed without a filled-in log row for the exact
head being released.

| # | Flow | VoiceOver steps | Expected behavior | Verifies |
| --- | --- | --- | --- | --- |
| 1 | Form entry/error | Swipe to an `Input` inside an invalid `Field`; listen | VoiceOver announces the field's label, then its error text as a hint, in one coherent utterance — not two disconnected announcements | Row "Form entry/error" |
| 2 | Dialog | Activate a `Dialog` trigger | VoiceOver's focus moves into the dialog; the title is announced; swiping does not escape the dialog's modal boundary into background content | Row "Dialog / AlertDialog" |
| 3 | AlertDialog | Activate a destructive-confirmation trigger | VoiceOver announces the title/description; the Cancel/Action buttons are separately reachable and named; a two-finger-scrub ("Escape" gesture) does **not** dismiss it (by design) | Row "Dialog / AlertDialog" |
| 4 | Popover / Select | Open a `Select`; navigate options | Each option is announced with its selected state; a two-finger-scrub closes without changing selection | Row "Popover", "Select" |
| 5 | Tooltip | Long-press (or external-keyboard focus) a `Tooltip` trigger | VoiceOver announces the trigger's own label plus the tooltip's hint text in the same utterance; the tooltip bubble itself is never separately swipe-reachable | Row "Tooltip" |
| 6 | Toast | Trigger an action that shows a `Toast` | VoiceOver announces the toast content once, without interrupting or being interrupted mid-utterance by an unrelated announcement | Row "Toast announcement" |
| 7 | Settings/list rows | Swipe through a `ListGroup`/`SettingsItem` list | Each row is announced with its full composed label (title + description where present); VoiceOver's rotor "Headings"/list navigation reflects real row boundaries | Row "Settings/list rows" |
| 8 | Sheet | Open a `Sheet`; swipe through its content; dismiss via swipe-down gesture | VoiceOver focus moves into the sheet on open and returns to the trigger on close; the drag handle (if visible) does not produce a confusing double announcement | Row "Sheet" |
| 9 | Table / DataTable | Swipe through table rows; activate a sort-header trigger | Each cell announces its composed "`<column>`: `<value>`" label; the sort trigger announces its action name and updated state after activation | Row "Table / DataTable" |
| 10 | Calendar / DatePicker | Open a `DatePicker`; swipe through day cells; navigate months | Each day cell announces the full date plus today/selected/disabled state (never color alone); navigating months triggers a spoken month/year announcement without requiring an extra swipe | Row "Calendar / DatePicker / DateTimePicker" |
| 11 | DateTimePicker | Open a `DateTimePicker` in a 24h locale | The AM/PM control is not reachable by swipe at all (fully absent, not merely silent) | Row "Calendar / DatePicker / DateTimePicker" |
| 12 | Production-demo navigation | *(deferred — no production-demo surface exists yet in this repo; add rows here once one exists, before RC freeze, per #147's DoD)* | — | Deferred |

### What each checklist run must record

Per #147's evidence policy, every completed run of the table above must record, in the
evidence log:

- exact device or Simulator model and iOS version;
- exact app build identifier and the release-candidate git SHA under test;
- whether VoiceOver was run on physical hardware or Simulator + Accessibility Inspector
  (state which — do not conflate the two);
- pass/fail per row, with a one-line note on any deviation;
- do not describe a Simulator-only pass as a physical-device certification.

### Evidence record log

| Date | RC SHA | Device/Simulator + iOS version | Method | Rows passed | Rows failed / notes | Tester |
| --- | --- | --- | --- | --- | --- | --- |
| _(none recorded yet)_ | — | — | — | — | — | — |

## Known limitations (honest, not silently omitted)

- **No VoiceOver automation infrastructure exists in this repository.** Part B above is,
  by design, a human-run checklist, not a CI gate. See "Evidence-honesty rule" above.
- **Simulator VoiceOver behavior is not identical to physical-device VoiceOver behavior**
  for gesture timing and some announcement queueing; a Simulator-only pass is weaker
  evidence than a physical-device pass and must be labeled as such in the log.
- **#349** (headless iOS Simulator Fabric blank-render after mid-gesture overlay unmount)
  is a separate, already-tracked CI runtime limitation; it affects unattended Maestro
  smoke runs, not this manual checklist directly, but it is further evidence that iOS
  overlay-heavy flows in this repository currently require human-driven verification
  rather than unattended automation.
- **Production-demo rows are deferred** until a production-demo surface exists, per #147's
  own sequence rule — the same deferral `docs/keyboard-focus-acceptance-matrix.md` already
  applies for #146.
- This document does not certify BeeUI as meeting any formal accessibility standard
  (WCAG conformance level, VPAT, etc.); it documents the strongest evidence actually
  obtained for the flows #147 enumerates, per `docs/beeui-1.0-evidence-classes.md`.

## Cross-references

- `docs/accessibility-contract.md` § "Native screen readers" — the consolidated statement
  that no component has assistive-technology evidence yet.
- `docs/talkback-release-matrix.md` (#148) — the Android counterpart to this document.
- `docs/keyboard-focus-acceptance-matrix.md` (#146) — the structural model this document
  follows.
- `plans/reports/researcher-260830-2346-real-device-cloud-testing-options.md` — the
  device-cloud/AT-automation research this document's evidence-honesty section summarizes.
- #349 — the related iOS headless-Simulator runtime limitation.
