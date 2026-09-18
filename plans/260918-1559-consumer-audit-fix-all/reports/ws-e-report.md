# WS-E — residuals + real-browser proof — implementation report

Branch: `ws/e-residuals`, based on `fix/consumer-audit-batch` @ `617b3d2` (the commit the spec/report files landed in; the worktree's own checkout had drifted to an unrelated `development`-derived head, so `ws/e-residuals` was created directly from `617b3d2` to match the integration branch the spec describes).

Final commit: `5ef739e2d003e8008a41345a163080072f749bc2`

## Per-item status

| Item | Issue | Status |
|---|---|---|
| 1 | #606 keydown bubble | **Proven — root cause confirmed, not fixable from owned files.** `test.fixme` added. |
| 2 | #601 Field required English copy (residual) | **Fixed.** |
| 3 | #563 Box raw `className` (residual) | **Fixed.** |
| 4 | #586 Toast placement public prop | **Fixed.** |
| 5a | #612 Select 20-option mouse pick | **Proven fixed** (Playwright). |
| 5b | #607 item 1 + #587 dialog/alertdialog role uniqueness | **Found still broken — fixed.** |
| 5c | #548 Sheet backdrop vs. short app root | **Proven fixed** (Playwright). |
| 6 | #550/#552 BeeThemeScope in packed consumer | **Reproduced — root cause identified, not fixable from owned files.** |
| 7 | #609 `setTheme('system')` resume-follow | **Not reproduced** (Web half only — see caveat). |

## 1. #606 — keydown bubble root cause

Read the installed `react-native-web@0.21.0` source directly:

```
node -e "const fs=require('fs'); const p=require.resolve('react-native-web/dist/exports/TextInput/index.js'); console.log(fs.readFileSync(p,'utf8'))"
```

`handleKeyDown` (line ~270) calls `e.stopPropagation()` unconditionally on every keydown, with the literal comment `// Prevent key events bubbling (see #612)`. This is react-native-web's own code, not BeeUI's — `input.tsx`/`search-input.tsx`/`textarea.tsx` were grep'd for `stopPropagation`/`onKeyDown` and contain none (matches WS-B's earlier finding).

A fix that re-dispatches the event from a BeeUI-owned bubble listener would make a capture-phase listener (the documented consumer workaround) see the same logical keydown twice — the spec explicitly forbids this. Left as `test.fixme` per the spec's instruction, with the root cause in the test title:

`apps/visual-regression/tests/input-keydown-bubble.spec.ts`

Fixture: `apps/visual-regression/App.tsx`'s new `keydown-bubble` fixture (`?fixture=keydown-bubble`), a single labelled `Input`.

### Docs text to publish (Input page — not written to apps/docs, another workstream owns it)

> **Bubble-phase keyboard shortcuts and a focused Input (Web)**
>
> On Web, react-native-web's own `TextInput` calls `stopPropagation()` on every `keydown` while it holds focus, regardless of which key was pressed. This means a `document`/`window` `keydown` listener registered in the **bubble phase** (the default for `addEventListener`) never fires while a BeeUI `Input`, `SearchInput`, or `Textarea` is focused.
>
> If your app binds global keyboard shortcuts (function keys, `Alt`/`Cmd` chords, etc.), register them in the **capture phase** instead:
>
> ```ts
> document.addEventListener('keydown', handler, true); // capture phase
> ```
>
> This is a react-native-web behavior, not something BeeUI can opt you out of per-field today.

## 2. #601 — Field required English copy (residual)

`Field.requiredAccessibilityLabel`'s default changed from the literal `'required'` to no default (`field-context.ts`, `field.tsx`). `input.tsx`, `date-picker-shared.tsx`, `date-time-picker-shared.tsx` now:
- Prefer `field.requiredLabel` (WS-A's localized opt-in) over the deprecated `field.requiredAccessibilityLabel`, and only append either when non-empty — no more injected English default.
- Add a literal `aria-required`/equivalent — `Input` gets a new `'aria-required'` prop set to `field?.required || undefined` (mirroring WS-A's Checkbox/Radio/Switch pattern exactly).
- `date-picker-shared.tsx`/`date-time-picker-shared.tsx`'s `ResolvedDatePickerField`/`ResolvedDateTimePickerField` gained a `required: boolean` field for the same purpose — **residual noted below**: the platform files that actually render the trigger DOM node (`date-picker.web.tsx`, `date-time-picker.web.tsx`) are not owned by WS-E, so they do not yet consume this new field to stamp a literal `aria-required` attribute on the trigger. The accessible-name fix (no more injected "required" text) is complete and verified; wiring the new `required` field into the trigger's `aria-required` prop is a small follow-up for whichever workstream owns those two platform files.

Tests updated to the new contract (assert `accessibilityLabel` without the English suffix + `aria-required`/`'aria-required'` truthy, plus a new test proving `requiredLabel` still appends when the caller opts in): `accessibility-readonly.test.tsx`, `field-label-accessible-name-dedup.test.tsx`, `issue-173-date-picker-web.test.tsx`, `issue-173-date-picker-native.test.tsx`, `issue-174-date-time-picker-web.test.tsx`, `issue-174-date-time-picker-native.test.tsx`.

`FormGroup`'s own separate `requiredAccessibilityLabel` prop (not routed through `FieldContext`, `form-group.tsx` not owned by WS-E) is unrelated and untouched — its own `"Plan, required"`-style test still passes unchanged.

## 3. #563 — Box raw `className` (residual)

`box.tsx` now routes `className` through `cn()` instead of forwarding it raw. Added Box coverage to the existing invariant suite (`class-name-merge-safety.test.tsx`): explicit-`undefined` className normalizes to `''`, no-className mounts fine, and conflicting classes still merge last-wins the same way every other `cn()`-routed component does.

## 4. #586 — Toast placement public prop

`BeeUIProvider` (`safe-area.tsx`) gained a public `toastPlacement?: ToastPlacement` prop, forwarded to the internal `ToastRuntimeProvider`'s `placement` prop. Omitting it preserves the existing platform default (`bottom` native / `top` web) unchanged — `placement={toastPlacement}` with `toastPlacement` `undefined` still hits `ToastRuntimeProvider`'s own default-parameter fallback. New test in `toast.test.tsx` proves `toastPlacement="top"` overrides the native default.

## 5. Browser proof (`apps/visual-regression`)

### 5a. #612 — Select 20-option mouse pick

Reused the existing 120-item overflowing-list fixture already in `apps/showcase/component-gallery/select-showcase.tsx` (`select-showcase-long-*` testIDs, not owned by WS-E, not modified) from a new spec: `tests/select-overflowing-list-mouse-pick.spec.ts`. A real Chromium mouse click on the last option (`Workspace 120`) correctly closes the dropdown and updates the trigger value — passes on every canonical viewport/theme project. This corroborates WS-B's structural fix (ScrollView → plain overflow `View` on Web).

### 5b. #607 item 1 + #587 — Dialog/AlertDialog role uniqueness

**Found still broken.** WS-C's fix moved `role`/`aria-modal` to react-native-web's forced `<Modal>` owner for `Dialog` (correct — exactly one `role="dialog"` node), but for `AlertDialog` the *panel* additionally stamped `role="alertdialog"` while the *outer* Modal owner is unconditionally forced by react-native-web to `role="dialog"` (verified directly against the installed `ModalContent.js`: `role: active ? 'dialog' : null`, applied after all component props are spread — no prop can override it). An open `AlertDialog` therefore rendered **two** role-carrying nodes: one `role="dialog"` and one `role="alertdialog"` — violating "zero `role="dialog"`" even though the two values differ.

Fix (`dialog.tsx`, owned): a `MutationObserver` (`watchAlertDialogRole`, new named export, not in `packages/ui/src/index.ts`'s public surface) attached to the `<Modal>` owner's real DOM node corrects its forced `role` to `'alertdialog'` whenever react-native-web (re)writes it — this has to be a `MutationObserver`, not a fixed-delay timer, because react-native-web only flips its internal `active` flag (and therefore the DOM `role` write) on the `animationend` DOM event for every animated `animationType`, i.e. ~300ms after mount for the default `fade`, not synchronously. The panel itself no longer restates any role on Web for either `dialog` or `alertdialog` — the single owner node is authoritative for both cases now.

Verified:
- **Real-browser proof** (the actual claim): `tests/dialog-alert-dialog-role-uniqueness.spec.ts` — `[role="dialog"]`/`[role="alertdialog"]` counted directly against `page.locator(...)` on the existing `dialog-open`/`alert-dialog-open` scenarios. **Manually confirmed the test is meaningful**, not vacuous: temporarily disabled the `MutationObserver` effect, rebuilt, reran — the AlertDialog test failed exactly as expected (`Expected: 1, Received: 0` for `[role="alertdialog"]`); restored the fix, rebuilt, reran — passes again (see gate results below for the final green run).
- **Unit-level wiring proof** (no jsdom in this repo): new `alert-dialog-role-mutation-correction.test.ts` exercises `watchAlertDialogRole` directly against a plain mock node + mock `MutationObserver`, proving the enforcement logic (immediate correction, re-correction on any external overwrite, no redundant writes, clean disconnect) independent of React/DOM.
- **Existing jest suite updated to the new contract**: `dialog-web-modal-owner.test.tsx`'s two AlertDialog tests previously asserted the *old* contract (`panel.props.role === 'alertdialog'`, `countHostViewsWithRole(..., 'alertdialog') === 1`). Since the real fix now happens via a real-DOM `MutationObserver` this Jest harness cannot simulate (no jsdom, confirmed — `jest-expo`/`react-test-renderer` only), both tests were updated to assert the new contract: the panel itself carries **no** role on Web for either case, with a comment pointing at the Playwright spec as the real proof.

### 5c. #548 — Sheet backdrop vs. short app root

New fixture `sheet-short-root` in `App.tsx` (a short, un-stretched app root — one line of text and a trigger button, deliberately shorter than the viewport, exactly matching the maintained `global.css` contract: `html, body, #root { min-height: 100% }`, which does **not** by itself establish a definite viewport-height containing block for a short route). New spec `tests/sheet-backdrop-covers-viewport-with-short-root.spec.ts` confirms the precondition (app root shorter than viewport) and then asserts the opened Sheet's backdrop bounding box is exactly `(0, 0, viewportWidth, viewportHeight)`. Passes — corroborates WS-B's `position: fixed; inset: 0` fix in `sheet.web.tsx` (not owned by WS-E, not touched).

## 6. #550/#552 — BeeThemeScope in a packed Web consumer

**Reproduced**, with a precise root cause — outside any file WS-E (or `packages/ui`) owns.

### Repro commands

```
cd examples/web-consumer
bash ./setup.sh            # packs core/tokens/ui tarballs, npm install
npm run build               # vite build
npx vite preview --port 4321 --strictPort &
```

Temporary scaffolding added to `examples/web-consumer/src/App.tsx` (reverted after recording results, per file ownership — `git checkout -- examples/web-consumer/`): a `BeeThemeScope brand="violet" appearance="dark"` wrapping a probe reading both `useBeeToken('colors.background')` and the real computed `background-color` of a `bg-primary` `Box`, inside and outside the scope.

### Observed values (real Chromium, via a throwaway Playwright script against the built+served consumer)

```
globalToken: global colors.background: #ffffff
scopedToken: scoped (violet/dark) colors.background: #ffffff        <- should differ
globalSwatchColor (bg-primary, getComputedStyle): rgb(245, 158, 11)
scopedSwatchColor (bg-primary, getComputedStyle): rgb(245, 158, 11) <- should be violet-dark's primary
```

The scoped subtree **does** get wrapped in a `<div class="violet-dark">` (`BeeThemeScope`/Uniwind's `ScopedTheme` correctly apply the class) — confirmed by walking the ancestor chain in the same script. The values are still wrong.

### Root cause

`packages/tokens/src/theme.css` (generated by `scripts/generate-tokens.mjs` from `tokens.json` — **neither file is in WS-E's owned-file list**) defines every brand/appearance block inside a single top-level wrapper:

```css
@layer theme {
  :root {
    @variant light { --color-primary: #f59e0b; ... }
    @variant dark { ... }
    @variant violet-light { --color-primary: #7c3aed; ... }
    @variant violet-dark { --color-primary: #a78bfa; ... }
    ...
  }
}
```

Tailwind v4's `@variant` at-rule substitutes `&` (the enclosing selector) into the matching `@custom-variant` definition (`@custom-variant violet-dark (&:where(.violet-dark, .violet-dark *));`). Since the enclosing selector here is literally `:root`, the compiled CSS (verified directly in the built bundle) is:

```css
:root:where(.violet-dark, .violet-dark *) { --color-primary: #a78bfa; ... }
```

`:root` can **only ever** match the document's actual `<html>` element. This selector can therefore only ever take effect when `.violet-dark` is applied to `<html>` itself (the global whole-page theme case, which works fine — confirmed separately, `Uniwind.setTheme`/global brand switching is unaffected). A `BeeThemeScope`-applied `.violet-dark` class on a *nested* `<div>` deep in the tree can never satisfy `:root:where(...)`, no matter where it lives in the DOM — so none of these CSS variable overrides are ever set anywhere inside that subtree, and every descendant (including `useBeeToken`'s own underlying CSS-variable read, and any `bg-primary` utility) keeps inheriting whatever value was set at the real `:root` (i.e. the global theme).

This is a byproduct of `theme.css`'s selector strategy being written for *global* (whole-document) theming only; `BeeThemeScope`'s scoped-subtree contract needs its per-brand/appearance blocks compiled as a plain `:where(.brand-appearance, .brand-appearance *)` (or equivalent) selector, **without** the `:root` anchor, so it can match a class applied at any depth.

### Why this is not fixed here

The spec scopes item 6's fix to `theme-scope.tsx` / `use-bee-token.ts` / packages/ui build config — all three are thin, verified-correct pass-throughs (this matches WS-B's own prior investigation exactly: both files just forward to Uniwind's own `ScopedTheme`/`useCSSVariable`, no BeeUI-owned state to fix). The actual defect is in `packages/tokens/src/theme.css`'s generated selector shape / `scripts/generate-tokens.mjs`'s template, neither of which is in WS-E's owned-file list (`packages/tokens/src/**` is not `packages/core/src/**`). Introducing a second, parallel scoped-CSS-variable mechanism from inside `theme-scope.tsx` to paper over this would violate the issue's own explicit acceptance criteria (no second theme store) and this repo's "brand changes happen in tokens/themes, not component implementation" rule.

**Recommendation for the tokens owner:** restructure `scripts/generate-tokens.mjs`'s per-brand/appearance emission so scoped variants don't nest inside a shared `:root { }` block (e.g. emit each brand/appearance's `@variant` block at the top level, or use a selector strategy that doesn't require the matched element to itself be `:root`), then regenerate `theme.css` and re-run this exact repro to confirm.

## 7. #609 — `Uniwind.setTheme('system')` resume-follow

**Not reproduced** (Web half). Read the installed `uniwind@1.10.1` source directly (`config.common.js`, `config.js`, `useUniwind.js`, `rnw.js`) to understand the mechanism, then reproduced the exact reported sequence twice against the packed Web consumer with real Chromium `page.emulateMedia({ colorScheme })` toggling:

**Sequence A** (OS starts light, explicit `setTheme('dark')`, then `setTheme('system')`, then OS flips to dark and back):
```
initial html class (OS=light): light
after setTheme('dark'): dark
after setTheme('system') (OS still light): light
after OS flips to dark (post system): dark
after OS flips back to light (post system): light
```

**Sequence B** (the specific edge case where the explicit theme already matches the OS, which Uniwind's own code path skips a `Theme` notification for internally — `#hasAdaptiveThemes` still flips correctly):
```
initial html class (OS=dark): dark
after setTheme('dark') (matches OS): dark
after setTheme('system') (OS still dark, theme unchanged): dark
after OS flips to light (post system): light
```

Both sequences resume following the OS correctly. Temporary scaffolding (two buttons calling `Uniwind.setTheme('dark')`/`Uniwind.setTheme('system')`) was added to `examples/web-consumer/src/App.tsx` for this and reverted along with item 6's scaffolding.

**Caveat:** this only tests the **Web** half of #609. The issue also claims iOS Simulator breakage (`Appearance.setColorScheme('unspecified')` "does nothing" natively) — untestable in this environment (no simulator/device). Per the spec's own instruction ("record the finding... if it does not [work], add a helper... otherwise record for docs"), since the Web half does not reproduce and no defect was found in the traced code path, no `followSystemTheme()` helper was added — it would have no defect to fix and would risk becoming exactly the kind of unverifiable workaround this repo's rules discourage. The native half remains an open question for whoever has simulator/device access; recommend re-testing there specifically, isolated from the Web mechanism (which is proven fine).

## Files changed

**Owned components:**
- `packages/ui/src/components/field-context.ts`, `field.tsx`, `input.tsx`, `date-picker-shared.tsx`, `date-time-picker-shared.tsx` — item 2
- `packages/ui/src/components/box.tsx` — item 3
- `packages/ui/src/components/safe-area.tsx` — item 4
- `packages/ui/src/components/dialog.tsx` — item 5b

**Tests (`apps/showcase/__tests__/`):**
- Updated: `accessibility-readonly.test.tsx`, `field-label-accessible-name-dedup.test.tsx`, `issue-173-date-picker-{web,native}.test.tsx`, `issue-174-date-time-picker-{web,native}.test.tsx`, `class-name-merge-safety.test.tsx`, `toast.test.tsx`, `dialog-web-modal-owner.test.tsx`
- New: `alert-dialog-role-mutation-correction.test.ts`

**`apps/visual-regression/`:**
- `App.tsx` — new fixtures: `sheet-short-root`, `keydown-bubble` (and the `Sheet`/`SheetContent`/`SheetTitle`/`SheetTrigger` imports they need)
- New specs: `tests/dialog-alert-dialog-role-uniqueness.spec.ts`, `tests/sheet-backdrop-covers-viewport-with-short-root.spec.ts`, `tests/select-overflowing-list-mouse-pick.spec.ts`, `tests/input-keydown-bubble.spec.ts`

**`examples/web-consumer/`:** temporary repro scaffolding added and reverted (`git checkout --` before finishing) — no net diff in the final commit.

**`apps/docs/`:** untouched by design. Two separate `apps/docs/src/content/docs/components/*.md` diffs appeared twice during this session as a side effect of Playwright's global `webServer` list always building `@beemvp/beeui-docs` (which regenerates those pages from current source) even when only unrelated projects were selected — both were reverted immediately via `git checkout -- apps/docs/` before committing anything, confirmed clean in the final `git status`.

## Gate results (exact commands)

| Command | Result |
|---|---|
| `pnpm lint` | pass (`eslint packages/ui/src apps/demo/src --max-warnings=0`, 0 warnings) |
| `pnpm --filter @beemvp/beeui-ui typecheck` | pass |
| `pnpm --filter @beemvp/beeui-showcase typecheck` | pass |
| `pnpm ui-exports:check` | pass — 62 public component subpaths, unchanged (no new top-level exports; `BeeUIProvider.toastPlacement` and `Input`'s `aria-required` are new optional props on already-exported components, `watchAlertDialogRole` is a named-but-not-re-exported internal helper) |
| `pnpm --filter @beemvp/beeui-showcase test` (full suite) | pass — **119 suites / 1075 tests** |
| `pnpm --filter @beemvp/beeui-visual-regression typecheck` | pass |
| `pnpm exec playwright install chromium` (via `npx playwright install chromium` in `apps/visual-regression`) | already installed, no-op |
| `pnpm --filter @beemvp/beeui-visual-regression build:web` then `npx playwright test tests/{sheet-backdrop-covers-viewport-with-short-root,dialog-alert-dialog-role-uniqueness,input-keydown-bubble,select-overflowing-list-mouse-pick}.spec.ts` (full project matrix, no `--project` filter) | pass — **32 passed, 8 skipped** (the 8 skips are the single `test.fixme` × 8 viewport/theme projects) |

Regression check for the dialog fix specifically: temporarily neutralized the `MutationObserver` effect in `dialog.tsx`, rebuilt `packages/ui` + `apps/visual-regression`'s web bundle, reran `dialog-alert-dialog-role-uniqueness.spec.ts` — the AlertDialog assertion failed exactly as predicted (`[role="alertdialog"]` count 0 instead of 1, 10s timeout). Restored the fix, rebuilt, reran — green again. This is the evidence the new test is not vacuous.

## Docs text to publish

**Input page** — see item 1's block above (capture-phase keyboard-shortcut guidance).

**Field / Input / DatePicker / DateTimePicker pages** — new contract for `required`:

> `Field required` no longer injects the English word "required" into any control's accessible name by default. `required` state now reaches assistive tech through `aria-required`/`accessibilityRequired` on the field-consuming control. To append localized copy to the accessible name (e.g. `"Email, Bắt buộc"`), pass `Field.requiredLabel` — this always requires an explicit value; there is no built-in English (or any other language) default. The older `Field.requiredAccessibilityLabel` prop still works if you set it explicitly, but is deprecated in favor of `requiredLabel`.

**Toast / BeeUIProvider page** — new public prop:

> `BeeUIProvider` accepts a `toastPlacement?: 'top' | 'bottom'` prop, forwarded to the `useToast()` runtime. Omit it to keep the platform default (`bottom` on iOS/Android, `top` on Web).

## Unresolved / follow-ups for other workstreams or owners

1. **#601 residual for DatePicker/DateTimePicker trigger `aria-required`**: `date-picker-shared.tsx`/`date-time-picker-shared.tsx` now expose a `required: boolean` field on their resolved-field hooks, but `date-picker.web.tsx`/`date-time-picker.web.tsx` (not owned by WS-E) don't yet consume it to stamp a literal `aria-required` on the trigger `PopoverTrigger`. Small, mechanical follow-up.
2. **#550/#552**: real root cause identified in `packages/tokens/src/theme.css`/`scripts/generate-tokens.mjs` (see item 6) — needs the tokens-generator owner to restructure the per-brand/appearance selector emission so it doesn't require a `:root`-anchored class.
3. **#609**: Web half verified correct; native (iOS Simulator/device) half still needs someone with device access to re-test in isolation.
4. **#606**: needs either an upstream react-native-web fix or a documented, opt-in BeeUI escape hatch design (out of scope here per the spec's explicit constraint against double-firing capture listeners).

Status: DONE_WITH_CONCERNS
Branch: ws/e-residuals @ 5ef739e2d003e8008a41345a163080072f749bc2
Summary: Fixed items 2/3/4 and a newly-found AlertDialog role-duplication bug (5b) with full test coverage; browser-proved items 1/5a/5c/7 (1 and 7 not reproducible/fixable from owned files, documented); reproduced item 6 with an exact root cause outside WS-E's owned files. All required gates green.
Concerns: item 6's real fix needs `packages/tokens` ownership; item 2 has a small residual in unowned DatePicker/DateTimePicker platform files; item 7's native half is untested.
