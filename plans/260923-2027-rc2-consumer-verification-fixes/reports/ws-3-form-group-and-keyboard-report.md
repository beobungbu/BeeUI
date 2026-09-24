# WS3 — form-group and keyboard fixes

Branch: `ws3-form-group-and-keyboard` (based on `243c4ae`, `fix/rc2-consumer-verification`)
Worktree: `/Users/textsoft/workspace/BeeUI/.claude/worktrees/agent-a4134efe9f8e0397b`

Note: the task's specified report path
(`.claude/worktrees/beeui-portal-pages-ci-e8e1fc/plans/.../reports/`) is a different
worktree this session's sandbox doesn't have write access to (isolated to
`agent-a4134efe9f8e0397b`). This report is written to the equivalent path inside this
worktree instead; both worktrees share the same repo history at `243c4ae`, so the
`plans/260923-2027-rc2-consumer-verification-fixes/` directory exists identically in
both. The caller should copy this file over if the other worktree's copy is the
canonical one.

Commits:
- `12323b1` fix(keyboard-aware-screen): use non-deprecated focus API and extend shell-safe keyboard inset to iOS
- `f3608fa` fix(form-group): give a Checkbox list real group semantics and drop the English required default

## Issue mapping note

The task brief's item numbers for #631 don't match the live issue body's own numbering
(re-read via `gh issue view 631 --repo beobungbu/BeeUI --comments`, per the plan's
instruction to treat the BeePOS verification comment as the acceptance baseline). Fixed
by content, not by the brief's numbers:
- "deprecated API" = issue's own item 1 (matches).
- "last field under keyboard in a shell" = issue's own **item 6** (the brief called it
  "item 2"), also covered by #588's PARTIAL rc.2 verification comment.
- "requiredAccessibilityLabel defaults to English" = issue's own **item 4** (the brief
  called it "item 5").
- #571's checkbox-list-in-FormGroup gap is its own rc.2 verification comment (PARTIAL):
  Switch-in-Field (item 1) fixed, Checkbox-list-in-FormGroup (item 2) not.

## 1. KeyboardAwareScreen deprecated API (#631 item 1)

`TextInput.State.currentlyFocusedField()` is deprecated on RN 0.86.2 and logs a LogBox
`console.error` on every focus (confirmed by running the test suite against the
unfixed source — RN's own `TextInputState.js:36` fires the warning). Replaced with
`TextInput.State.currentlyFocusedInput()`, which returns the focused host component's
own ref; `UIManager.measureInWindow(handle, cb)` is replaced with `ref.measureInWindow(cb)`
directly, dropping the `UIManager` import. The focus/keyboard-top dedup key changed
from a numeric field ID to the ref itself (referential equality, same semantics).

**Red-then-green**: `apps/showcase/__tests__/keyboard-aware-screen.test.tsx` — new test
`resolves the focused field through the non-deprecated currentlyFocusedInput API`, plus
every other test in the file now mocks `currentlyFocusedInput`/`ref.measureInWindow`
instead of `currentlyFocusedField`/`UIManager.measureInWindow`. Failing excerpt against
`243c4ae`'s `keyboard-aware-screen.tsx`:

```
console.error
  currentlyFocusedField is deprecated and will be removed in a future release. Use currentlyFocusedInput
    at Object.error [as currentlyFocusedField] (.../TextInputState.js:36:13)
    at currentlyFocusedField (keyboard-aware-screen.tsx:127:44)
...
● resolves the focused field through the non-deprecated currentlyFocusedInput API
  expect(jest.fn()).toHaveBeenCalledTimes(1)
  Expected number of calls: 1
  Received number of calls: 0
```

## 2. Last field stays under the keyboard in a shell layout (#588 PARTIAL, #631 item 6)

`KeyboardAwareScreen` scrolls the focused field above the keyboard via
`UIManager`/ref `measureInWindow` + `scrollTo`, and separately reserves temporary
bottom content-padding (`keyboardInset`, keyboard height + margin) so the ScrollView
always has enough scroll range for the requested `scrollTo` to land instead of being
silently clamped. That padding reservation was Android-only: the doc comment assumed
iOS's own `KeyboardAvoidingView behavior="padding"` — which shrinks its view by the
overlap between *its own frame* and the keyboard — always provides enough headroom.
That assumption only holds when the screen owns the full window. Inside a shell
(header above, tab bar below — BeePOS: screen starts ~83pt below the window top, an
80pt bar under it) the screen's own frame already ends short of the window's bottom
edge, so the scrollable range `KeyboardAvoidingView`'s shrink produces is not
guaranteed to cover a field near the end of a long form. iOS now gets the identical
`keyboardInset` safety net Android already had — the `Platform.OS === 'android'` gate
on `setKeyboardInset` is removed.

**Red-then-green**: new test `reserves temporary bottom content space on iOS too, so a
shell-constrained screen keeps room to scroll the last field clear` asserts
`paddingBottom` goes from `0` to `324` (300px keyboard + 24px default margin) on
`keyboardDidShow` on iOS, and back to `0` on `keyboardDidHide`. Failing excerpt against
`243c4ae`:

```
● reserves temporary bottom content space on iOS too, so a shell-constrained screen keeps room to scroll the last field clear
  expect(received).toBe(expected)
  Expected: 324
  Received: 0
```

The existing `scrolls the focused field above the keyboard on iOS` test (previously
titled "...with no extra bottom padding") is updated to drop its now-incorrect
`paddingBottom === 0` assertion for iOS.

**Still needs simulator proof**: this only asserts the padding/offset *math*. Whether a
real shell-constrained `ScrollView` actually stops clamping the `scrollTo` request on a
physical/simulated iOS device — i.e. that BeePOS's exact repro now scrolls the last
field fully clear — needs an iOS Simulator or device check with a real header+tab-bar
shell and a long form, which this workstream did not have build/run access to verify.
Native iOS accessibility-tree verification is explicitly controller-owned (#614) per
the parent plan; this is the equivalent gap for this fix.

## 3. FormGroup `requiredAccessibilityLabel` English default (#631 item 4)

Searched the codebase for "the same mechanism BeeUI already uses for other default UI
strings" per the task brief. There is no shared i18n/strings dictionary file anywhere
in `packages/*` — the actual, repeatedly-used BeeUI mechanism (already applied to
`Field.requiredAccessibilityLabel`/`requiredLabel`, `Input`, `Checkbox`, `Radio`,
`Switch`, `date-picker-shared.tsx`, `date-time-picker-shared.tsx`) is: **no default
value**; a textual suffix is only ever added when the caller supplies one, and
`required` otherwise reaches assistive tech solely through `aria-required`/
`accessibilityRequired`. The GH issue's own suggested fix says exactly this ("suggest
no default suffix (rely on aria-required) as Field now does"). Applied the same
pattern to `FormGroup.requiredAccessibilityLabel`: default removed, and
`legendAccessibilityLabel` only appends the suffix when both `required` and
`requiredAccessibilityLabel` are truthy (guards against a literal `"Plan, undefined"`
string). No shared strings file was added — none was needed, so there's nothing for
another workstream's Select key to collide with.

**Red-then-green**: existing tests in `issue-15-alert-dialog-form-group.test.tsx` and
`field-label-accessible-name-dedup.test.tsx` asserted `'Plan, required'`/`'Plan, required'`
for a `<FormGroup required>` with no `requiredAccessibilityLabel` supplied — i.e. they
encoded the bug. Updated to assert `'Plan'` (no suffix), plus a new test asserting the
suffix appears **only** when a localized `requiredAccessibilityLabel` is supplied
(`'Kế hoạch, bắt buộc'`, never the English word). Failing excerpt against `243c4ae`:

```
● gives the rendered legend Label no accessibilityLabel, while RadioGroup still resolves its own via FormGroupContext
  expect(received).toBe(expected)
  Expected: "Plan"
  Received: "Plan, required"
```

## 4. Checkbox list inside FormGroup has no group semantics (#571 item 2, PARTIAL)

`FormGroup`'s own root `View` carried zero accessibility semantics — no role, no name
from the legend, no description link to the visible error/description text, no invalid
state — relying entirely on individual children (`RadioGroup`, `Checkbox`) to derive
their own relationships from `FormGroupContext`. That works for `RadioGroup` (which
resolves its *own* name/hint/disabled from context, so the group-as-a-whole still gets
an accessible name via the `RadioGroup` node) but not for a **list** of `Checkbox`
items, each of which keeps its own name (`"Store A"`, `"Store B"`, ...) — nothing
carried the group's own name, description, or invalid state at all, matching BeePOS's
finding verbatim ("no `aria-labelledby`/`aria-describedby` ... no `aria-invalid`, and no
`group` ancestor").

Fixed by giving `FormGroup`'s container real group semantics, mirroring the
`Field`/`Input`/`Switch` pattern already established in this file:
- `role="group"` (RN's cross-platform `role`, not `accessibilityRole` — the type
  already reserved both keys in its `Omit`, so this was clearly intended).
- `accessibilityLabelledBy` → the legend's `nativeID` (same relationship `RadioGroup`
  already uses), merged with any caller-supplied `accessibilityLabelledBy`.
- `accessibilityState.disabled`, merged with caller-supplied `accessibilityState`
  (AGENTS.md: "merge caller-provided accessibility state ... rather than discarding it").
- On Web only (matching this file and `switch.tsx`'s existing pattern for exactly this
  class of gap — RN has no cross-platform `aria-describedby`, and compound
  relationships don't reliably reach the DOM through react-native-web without the
  literal prop): `aria-labelledby`, `aria-describedby` (pointing at a new `nativeID` on
  the rendered description/error `Text`), `aria-invalid`.
- Removed `accessible={false}` from the container — kept in the original code as an
  intentional "don't merge children into one VoiceOver stop" choice (asserted by the
  now-updated `issue-15-alert-dialog-form-group.test.tsx` test), but incompatible with
  giving the group real semantics; matches `RadioGroup`, which never set it. **Native
  VoiceOver/TalkBack behavior for a Checkbox list inside a required/invalid FormGroup —
  whether removing `accessible={false}` changes how iOS/Android announce/merge the
  group — was not verified on a simulator/device** (native a11y tree verification is
  controller-owned, #614); the fix is verified for Web (real Playwright accessible-tree
  check) and for prop-level cross-platform correctness (jest).
- `Checkbox`'s `aria-required` now also reflects `formGroup?.required` (previously only
  `field?.required`), so a required Checkbox list gets `aria-required` the same way a
  required `Field`-wrapped control already does.

Added a Checkbox-list-in-`FormGroup` fixture (`"Assign to stores"`, invalid by default,
required) to the Forms card in the Component Gallery
(`apps/showcase/component-gallery/component-gallery.tsx`), since "showcase-only
fixtures the consumer never hits" don't count per the parent plan — this fixture is the
one exercised by the Playwright spec below, using the same `FormGroup`+`Checkbox`
composition a real consumer would write.

**Red-then-green, jest** (`apps/showcase/__tests__/form-group-checkbox-list-group-semantics.test.tsx`,
new file): asserts `role="group"`, `accessibilityLabelledBy` matching the legend's
`nativeID`, `accessibilityState.disabled`, `aria-required` on a child `Checkbox`
propagated from `formGroup.required`, and the three web-literal `aria-*` props
(`aria-labelledby`/`aria-describedby`/`aria-invalid`) present when invalid and absent
when not. All 4 assertions fail against `243c4ae` (`role`/`accessibilityLabelledBy`
undefined, `aria-required` undefined, `aria-labelledby` not a string). Failing excerpt:

```
● labels the group container by its legend and reflects disabled, cross-platform
  expect(received).toBe(expected)
  Expected: "group"
  Received: undefined
```

**Red-then-green, Playwright** (`apps/visual-regression/tests/form-group-checkbox-list-group-semantics.spec.ts`,
new file): navigates the real Component Gallery, asserts the *browser-computed*
accessible tree — `page.getByRole('group', { name: 'Assign to stores' })` resolves to
exactly one element (proves the `aria-labelledby` relationship actually computes that
accessible name, not just that the attribute string is present), `aria-describedby`
points at an element containing the visible error text, `aria-invalid="true"`, each
`Checkbox` keeps `aria-required="true"` and its own accessible name (`"Store A"`), and
selecting a store clears `aria-invalid`/`aria-describedby` live. Verified failing
against the unfixed `form-group.tsx`/`checkbox.tsx` (rebuilt `@beemvp/beeui-ui`,
re-exported the Component Gallery web build, reran against a locally-served showcase):

```
Error: expect(locator).toHaveCount(expected) failed
Locator:  getByRole('group', { name: 'Assign to stores' })
Expected: 1
Received: 0
```

and green again after restoring the fix and rebuilding.

**Note on how this spec was run**: the repo's `playwright.config.ts` webServer list
always includes the docs site (port 4175) regardless of which project/spec is
selected, and that docs build (`pnpm --filter @beemvp/beeui-docs build`, which also
*regenerates the doc `.md` files under `apps/docs/src/content/docs/components/`* as a
build side effect) took long enough locally to make the default `playwright test
form-group-checkbox-list-group-semantics.spec.ts` invocation time out. Verified
instead by manually starting the two showcase web servers (4173 build via `pnpm
build:web` + `serve:web`, 4174 via the same `expo export --platform web --output-dir
dist-gallery-qa` + `serve-showcase.mjs` command the repo config uses) and running
`playwright test` against them with a scratch-only config (not committed) that omits
the unrelated docs server. The docs-regeneration side effect was caught and reverted
(`git checkout -- apps/docs/src/content/docs/components/`) before committing — no
generated docs content is part of either commit. CI's actual `web-consumer`/
`visual-web-report` jobs use the real `playwright.config.ts` and should run the spec
normally there.

## Expected screenshot-baseline changes (not regenerated)

Adding the Checkbox-list-in-`FormGroup` fixture to the Forms card changes its layout,
so these 8 baselines will need regenerating in a follow-up visual-baseline pass:

```
apps/visual-regression/tests/__screenshots__/forms--light--mobile.png
apps/visual-regression/tests/__screenshots__/forms--light--desktop.png
apps/visual-regression/tests/__screenshots__/forms--dark--mobile.png
apps/visual-regression/tests/__screenshots__/forms--dark--desktop.png
apps/visual-regression/tests/__screenshots__/forms--high-contrast-light--mobile.png
apps/visual-regression/tests/__screenshots__/forms--high-contrast-light--desktop.png
apps/visual-regression/tests/__screenshots__/forms--high-contrast-dark--mobile.png
apps/visual-regression/tests/__screenshots__/forms--high-contrast-dark--desktop.png
```

## Files changed

- `packages/ui/src/components/keyboard-aware-screen.tsx`
- `packages/ui/src/components/form-group.tsx`
- `packages/ui/src/components/checkbox.tsx`
- `apps/showcase/__tests__/keyboard-aware-screen.test.tsx`
- `apps/showcase/__tests__/issue-15-alert-dialog-form-group.test.tsx`
- `apps/showcase/__tests__/field-label-accessible-name-dedup.test.tsx`
- `apps/showcase/__tests__/form-group-checkbox-list-group-semantics.test.tsx` (new)
- `apps/showcase/component-gallery/component-gallery.tsx` (fixture)
- `apps/visual-regression/tests/form-group-checkbox-list-group-semantics.spec.ts` (new)

Not touched: `form-group-context.ts`, `field.tsx`, `field-context.ts` (no changes
needed — `Field`'s required/no-default pattern and `useFieldContext()`'s exports are
unchanged), no shared default-strings file (none exists in the codebase; the
established mechanism is "no default, caller-supplied only").

## Verification

- `packages/ui`: `npx tsc -p tsconfig.json` — clean.
- `pnpm lint` (repo script: `eslint packages/ui/src apps/demo/src --max-warnings=0`) — clean.
- Jest (`apps/showcase`, `npx jest --runInBand <path>`): all 5 touched/added suites
  green — `keyboard-aware-screen.test.tsx`, `form-group-checkbox-list-group-semantics.test.tsx`,
  `issue-15-alert-dialog-form-group.test.tsx`, `field-label-accessible-name-dedup.test.tsx`,
  `checkbox-radio-field-form-group-context.test.tsx` (35 tests, 0 failures).
- Playwright: `form-group-checkbox-list-group-semantics.spec.ts` green against the
  fixed build (see the note above on how it was run).
- Full `pnpm typecheck`/`pnpm test` (repo-wide, docs+portal-pages+release-control-plane
  etc.) were not run — out of scope for this workstream's touched files per the task
  brief's narrower "ui typecheck, pnpm lint, touched jest tests, touched Playwright
  specs" instruction.

Status: DONE_WITH_CONCERNS
Summary: All four W3 fixes (deprecated focus API, shell keyboard inset on iOS, FormGroup Checkbox-list group semantics, localized-only required suffix) are implemented with red-then-green jest and/or Playwright coverage, ui typecheck and lint clean.
Concerns/Blockers: Two behavioral claims still need simulator/device proof rather than automated coverage — (1) that a shell-constrained iOS ScrollView actually stops clamping the scrollTo request end-to-end (only the padding/offset math is asserted), and (2) native VoiceOver/TalkBack behavior after removing FormGroup's `accessible={false}`. Both are the same class of gap the parent plan already marks controller-owned (#614 iOS a11y tree verification). Also: 8 `forms--*.png` visual baselines will need regenerating (fixture added to the Forms card, not committed here).
