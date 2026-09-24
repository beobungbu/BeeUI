# WS2 report — Select pointer picks (#612), Field label (#630), default placeholder (#587)

Branch `ws2-select-picks-and-field-label` (base `243c4ae`), fix commit `ecfb936`.
Worktree: `/Users/textsoft/workspace/BeeUI/.claude/worktrees/agent-a77ee2e0f35b558c1`.

## Files changed

- `packages/ui/src/components/select.tsx`: the fix for all three issues
- `packages/ui/src/components/select-locale.ts` (new): the placeholder dictionary, a select-specific sibling file
- `apps/visual-regression/src/select-fixtures.tsx` (new): `?fixture=select-minimal-route` and `?fixture=select-field`
- `apps/visual-regression/App.tsx`: routes the two fixture ids (1 import, 2 ids, 2 render branches)
- `apps/visual-regression/tests/select-bare-route-pointer-pick.spec.ts` (new)
- `apps/visual-regression/tests/select-field-label.spec.ts` (new)
- `apps/showcase/__tests__/select-trigger-field-context-and-locale.test.tsx` (new)

No shared strings file was touched. There is no shared default-strings file. The existing mechanism for localizing built-in copy is a per-component `locale` prop plus a small dictionary (`date-picker-locale.ts`, ADR-008 explicit-only), and Select now uses the same one.

## #612: why the old specs were green (scope gap)

`select-overflowing-list-mouse-pick.spec.ts` picks only the **last** option of its list, after `scrollIntoViewIfNeeded()`. `select-long-list-showcase.spec.ts` only checks that the selected option is visible when the list opens. Once a list is scrolled to its end, further scrolling is clamped, so the last row stays under the pointer. That makes the last row the one place the defect cannot appear. Every other row was untested. The consumer's case of pressing a visible middle option right after opening was never exercised.

## #612: root cause (reproduced with a probe, then a spec)

Web `SelectContent` had two linked behaviours:
1. `onHoverIn` on an option made it the current option.
2. An effect scrolled the list so the current option sat at the top (`scrollTo(layout.y - 8)`) every time the current option changed.

When the pointer hovered option 5, the list scrolled option 5 to the top. That slid option 9 under the still pointer. Option 9 hovered and scrolled, and so on, until the list stopped at its maximum scroll (480 = 800 − 320). The probe measured scrollTop 0 → 480 on hover alone, with Option 17 under the pointer. A press there commits option 5 + 12. That matches the consumer's 5→17 and 6→18. When the cascade is still moving at the moment of the press, the press selects nothing.

A related defect has the same cause. The browser also reports hover when the list opens under a resting pointer, so the pointer took the current option away from the keyboard, and Enter could commit the option under an idle mouse. This is why `select-showcase.spec.ts › …selects from the keyboard` fails locally on the **base** code: the mouse left over "Open Components" sits where the list opens. It likely passes in CI because the layout differs. The cause was confirmed by moving the mouse away first, which makes it pass on base.

## Fix (`select.tsx`)

- **Reveal only on open or keyboard.** A `revealRef` records which option to reveal. It is set when the list opens (align to start, as before) and on keyboard/typeahead moves (nearest-edge scrolling). A pointer-driven change of the current option clears it. It is cleared once the list is in its final position, so a later re-render does not pull a list the user has scrolled.
- **Measure the DOM directly on Web.** The reveal reads option and container geometry from the DOM (`getBoundingClientRect` + `scrollTop`) instead of stale `onLayout` values. Native keeps its `ScrollView.scrollTo` path, now gated by the same reveal rule.
- **Focus without scrolling for pointer changes.** When the pointer makes an option current, it is focused with `{ preventScroll: true }`. Keyboard and open focus still use the browser's normal focus scroll, as before.
- **Follow real mouse movement on Web.** The current option follows `onMouseMove`, not hover-in, and a consumer `onMouseMove` is still called. Native keeps `onHoverIn`.
- Item registration now carries a stable `node()` getter and a `focus(options)` function.

## #630: fix

Inside a `Field`, `SelectTrigger` now reads `useFieldContext()` the way `Input` does:
- **Name:** `accessibilityLabel` is the field label, plus the caller's `requiredLabel` when one is set.
- **Link:** `accessibilityLabelledBy` points to `labelNativeID`.
- **Hint:** `accessibilityHint` is the description, or the error when the field is invalid.
- **States:** `aria-required` for required fields, `aria-invalid` plus a `border-destructive` border for invalid ones, and the field's disabled state is ORed in (keyboard opening is blocked too).
- **Precedence:** a caller's own `accessibilityLabel` or `accessibilityLabelledBy` wins, and the placeholder names the trigger only outside a Field.

Verified in the DOM: `combobox "Cửa hàng nhận": Chọn cửa hàng` (the placeholder is now the value, not the name), `aria-labelledby="field-select-label"`, `aria-required="true"`, and `combobox "Kho xuất" [invalid]`.

**Described-by is not done, and needs a change in files I don't own.** `Field` renders its description and error text with no id and puts no id in its context. React Native Web drops `accessibilityHint`. So on Web, neither `Input` nor `Select` has an accessible description today (checked in the DOM). Wiring `aria-describedby` needs this change in W3-owned files:
- `field-context.ts`: add `descriptionNativeID?: string` to `FieldContextValue`.
- `field.tsx`: generate `helperNativeID` (for example `${resolvedLabelNativeID}-helper`), set `nativeID={helperNativeID}` on both the error `Text` and the description `Text`, and put `descriptionNativeID: (invalid && error) || description ? helperNativeID : undefined` in the context value.
- Then `Input` and `SelectTrigger` add `aria-describedby={field?.descriptionNativeID}`, a one-line change each.

A `test.fixme` in `select-field-label.spec.ts` ("Input and Select inside a Field are described by the field helper text") already asserts the expected descriptions. Enable it after that change.

## #587: fix

`Select` takes a new `locale?: string` prop, explicit-only like DatePicker's. A bare `<SelectValue/>` and the trigger's fallback name use `getSelectDefaultPlaceholder(locale)`: en-US "Select an option", vi-VN "Chọn một mục", and English for unknown locales. A caller's `placeholder` always wins, including an explicit `null`.

Without `locale`, the copy is still English. This is the same contract DatePicker has, and ADR-008 forbids reading the locale from the device or browser.

## Evidence

Red run: the committed specs against base `select.tsx` from `243c4ae`, same fixtures, desktop 1280×800. **10 failed, 3 passed, 1 fixme.**

| Test | Base result |
|---|---|
| hover leaves list in place | fail: option not focused, the list moved |
| press visible option 1 | pass (the top row is stable) |
| press visible option 5 | fail: the list is still open, so the first press selected nothing |
| press option 6 | fail: `Option 18` |
| press option 8 | fail: `Option 20` |
| press a middle option after wheel scroll | fail: scrollTop 192 ≠ 200 (the cascade fought the wheel) |
| reopen, then press option 6 | fail: `Option 18` |
| keyboard ArrowDown, list stays in view | pass |
| list opens under a resting pointer | fail: keyboard lost the current option |
| 5-option Select | pass (control) |
| `getByLabel('Cửa hàng nhận')` | fail: count 0 |
| required / invalid | fail: `aria-invalid` missing |
| bare SelectValue in vi-VN | fail: shows "Select an option" |

Green runs on the fix (`ecfb936`):
- Both new specs with `--repeat-each=10`: **130 passed, 0 failed, 0 flaky** (the 10 skipped are the described-by fixme). Run twice: once before the commit and once from the committed source after the red run.
- All pre-existing `select-*.spec.ts` (`select-showcase`, `select-long-list-showcase`, `select-overflowing-list-mouse-pick`) with `--repeat-each=3`: **39 passed**. This includes the keyboard test that fails locally on base.
- One full pass of every `select-*` spec across the desktop, mobile, and showcase-integration projects: 27 passed.
- Jest, `apps/showcase` `select|field` suites: 97/97 passed, including the 10 new tests for the native-facing props (hint, labelledBy, required label suffix, disabled, caller precedence, locale).
- `packages/ui` typecheck and `pnpm lint` are clean. The visual-regression and showcase typechecks are clean after building ui.
- These checks pass: `ui-exports:check`, `llms:check`, `compat:check`, `ai-contract:check`, `docs:contract:check`, `docs:reference:check`, `docs:surface:check`, `hygiene:check`.
- `docs:portal-pages:check` **fails as expected**: "select.md is stale" because of the new `locale` prop and the changed placeholder docs. Regenerating it is controller-owned (`pnpm docs:portal-pages:generate`).

Local runs used a private config (not committed) that serves this worktree's build on its own port, because other workstreams were listening on 4273 and 4391. They were Chromium runs with the light theme only. The new specs skip every project except light-desktop by design.

## Screenshot baselines

I expect none to change. No visual scenario or showcase screen renders a Select inside a `Field` or an open overflowing Select. The trigger's border class was only reordered (`border-border-strong` became conditional), so the default computed style is identical. An invalid-Field Select now gets a destructive border; no baseline shows one.

## Concerns

- `aria-describedby` needs the W3 change in `field-context.ts`/`field.tsx` described above; there is a fixme test ready for it.
- `App.tsx` is shared. My change is a small additive block that may conflict textually with other workstreams' fixtures.
- On Web, the current option now follows `mousemove` rather than hover-in. Touch input is unaffected: presses still commit through `onPress`/focus.
