# WS-B — web runtime, theme scope, tokens, input/select/sheet/safe-area, native keyboard

Branch: `ws/b-runtime` @ `08e68e2` (base: `fix/consumer-audit-batch` @ `e437553`)

## Per-issue status

| Issue | Status | Summary |
|---|---|---|
| #563 | Fixed | `SafeArea` forwarded raw `className` (bypassing `cn()`) to a Uniwind-wrapped host; `cn()` itself already normalizes undefined/null/false — see "className undefined, beyond SafeArea" below for the residual scope. |
| #564 | Fixed | Same root cause as #563 — the doc's exact `AppHeader` inside a partial-edge `SafeArea` composition is now covered by a regression test. |
| #598 | Fixed | `SafeArea` excludes exactly the edges where the caller's `className` already sets padding from the library's inset edge list, so that class wins on conflict per the documented `cn()` contract, instead of losing to the library's own inline inset style. |
| #606 | Not fixed — investigated, not reproducible from owned files | See "#606 investigation" below. |
| #614 | Fixed | `Input` tracks its own current text and publishes `accessibilityValue.text` alongside `accessibilityLabel`, only when a label is present. |
| #589 | Fixed (Input/SearchInput/AppHeader) | `Input`'s `sm`/`md`/`lg` size variants switched from fixed `h-control-*` to `min-h-control-*`. `AppHeader`'s own row height (`min-h-16`) and `SearchInput`'s row height (inherited from `Input`) were already growable in current source — see "#589 scope note". |
| #597 item 2 | Fixed | `SearchInput` gained a `trailing` slot; `ref.current.focus()` was already correctly wired end to end (now covered by a regression test). |
| #612 | Fixed (code + structural test) | `SelectContent`'s Web scroll container is now a plain overflow `View` instead of `ScrollView`. See "#612 test-harness caveat" — the underlying browser gesture race cannot be reproduced in this Jest harness. |
| #613 item 2 | Not reproducible against current source — locked in with a regression test | See "#613 item 2" below. |
| #548 | Fixed | `SheetContent` (web)'s backdrop/panel wrapper is `position: fixed; inset: 0`, anchoring it to the viewport regardless of app-root content height. |
| #549 | Fixed | `useBeeToken`/`getBeeToken` normalize a seconds-serialized Uniwind duration (`.2s`/`0.2s`) to the `ms` shape the shared reader expects, before handing it off. Verified in built dist output for both commonjs and module targets. |
| #550 | Not fixed — investigated, no defect found in owned files | See "#550/#552 investigation" below. |
| #552 | Not fixed — investigated, no defect found in owned files | See "#550/#552 investigation" below. |
| #588 | Fixed | `KeyboardAwareScreen`'s existing measure-and-scroll correction now also runs on iOS (previously Android-only), without Android's extra bottom-padding compensation. |
| #597 item 4 | Fixed | `Screen` gained a `scroll` prop (boolean or `ScrollViewProps`) wrapping children in a keyboard-avoiding `ScrollView`. Defaults to `false` — no behavior change for existing consumers. |
| #590 item 5 | Fixed | `Text.numeric` falls back to the default (no `fontVariant`) instead of throwing on an invalid literal, and warns once in dev. |
| #584 | Fixed in code; real-device proof is an owner gate | `enableDynamicSizing={false}` added to `BottomSheetModal`. Full analysis in `ws-b-sheet-584.md`. |

## Files changed

- `packages/ui/src/components/safe-area.tsx`
- `packages/ui/src/components/input.tsx`
- `packages/ui/src/components/search-input.tsx`
- `packages/ui/src/components/select.tsx`
- `packages/ui/src/components/use-bee-token.ts`
- `packages/ui/src/components/sheet.web.tsx`
- `packages/ui/src/components/sheet.native.tsx`
- `packages/ui/src/components/keyboard-aware-screen.tsx`
- `packages/ui/src/components/screen.tsx`
- `packages/ui/src/components/text.tsx`
- `apps/showcase/__tests__/helpers/dynamic-type.ts` (removed `input.tsx`'s now-stale `FIXED_HEIGHT_ALLOWLIST` entry — see "Reversing a prior verified decision" below)
- `apps/showcase/__tests__/dynamic-type-contract.test.tsx` (updated doc comment + added an Input-specific regression test)
- `apps/showcase/__tests__/safe-area.test.tsx` (extended)
- `apps/showcase/__tests__/keyboard-aware-screen.test.tsx` (extended)
- `apps/showcase/__tests__/issue-158-sheet-native.test.tsx` (extended)
- New: `apps/showcase/__tests__/class-name-merge-safety.test.tsx`
- New: `apps/showcase/__tests__/input-value-accessibility-and-search-slot.test.tsx`
- New: `apps/showcase/__tests__/select-content-web-scroll-container.test.tsx`
- New: `apps/showcase/__tests__/select-value-empty-string.test.tsx`
- New: `apps/showcase/__tests__/sheet-web-viewport-geometry.test.tsx`
- New: `apps/showcase/__tests__/use-bee-token-motion-duration-seconds.test.tsx`
- New: `apps/showcase/__tests__/screen-scroll-prop.test.tsx`
- New: `apps/showcase/__tests__/text-numeric-invalid-literal.test.tsx`
- New: `plans/260918-1559-consumer-audit-fix-all/reports/ws-b-sheet-584.md`

`packages/core/src/**` and `packages/ui/src/index.ts` were not modified — no new top-level exports were
added (only new optional props on already-exported components), confirmed by `pnpm ui-exports:check`.

## Gate results

| Command | Result |
|---|---|
| `pnpm lint` | pass (`eslint packages/ui/src apps/demo/src --max-warnings=0`) |
| `pnpm --filter @beemvp/beeui-core typecheck` | pass |
| `pnpm --filter @beemvp/beeui-ui typecheck` | pass |
| `pnpm --filter @beemvp/beeui-showcase typecheck` | pass |
| `pnpm --filter @beemvp/beeui-showcase test` (full suite) | pass — 93 suites, 951 tests |
| `pnpm ui-exports:check` | pass — 62 public component subpaths, no drift |
| `pnpm --filter @beemvp/beeui-ui build` | pass (used to verify #549's dist output) |

No existing test was weakened. The full showcase suite (not just the files I touched) was green before
committing, so the fixes above introduce no regression elsewhere in the repo.

## Detailed notes

### className undefined, beyond SafeArea

`cn()` (`packages/core/src/utils/cn.ts`, `twMerge(clsx(inputs))`) already normalizes `undefined`/`null`/
`false` to a plain string in every case — this is verified with a dedicated invariant test
(`class-name-merge-safety.test.tsx`). The actual #563/#564 crash site was components that bypass `cn()`
entirely and forward `className` raw to a host element. Within WS-B's owned files, that pattern existed
only in `safe-area.tsx` (fixed). The same raw-forward pattern also exists in `packages/ui/src/components/
box.tsx` (not owned by WS-B) — `<RNView ref={ref} className={className} {...props} />` — which is the
more likely source of the issue's own `ListItem` repro (a `Box` internal to that component's row, or a
similarly-shaped component elsewhere). Recommend a follow-up sweep of `packages/ui/src/components/*.tsx`
for `className={className}` (no `cn()` call) outside WS-B's ownership boundary.

### #606 investigation

Searched `input.tsx`, `search-input.tsx`, and `textarea.tsx` for any `onKeyDown`/`stopPropagation` call —
there is none. BeeUI's own component source does not call `stopPropagation` on `keydown` anywhere in
these files. The swallow the issue describes therefore happens either in `react-native-web`'s own
`TextInput` implementation or in Uniwind's runtime wrapper, both external dependencies outside
`packages/core`/`packages/ui`'s owned surface. It is also not reproducible in this repo's Jest harness:
`apps/showcase` uses the `jest-expo` preset (React Native / `react-test-renderer`), which has no real
browser DOM — there is no `jsdom` environment anywhere in this repo (verified: `grep -r jsdom` matches
only the two `uniwind` mocks), so a real `document`-level `keydown` bubble/capture race cannot be set up
or asserted on here. Fixing or regression-testing this requires either an upstream `react-native-web`/
Uniwind patch, or a real-browser (Playwright, `apps/visual-regression`) case — both outside WS-B's owned
files and this harness's capability. Left as-is; documented rather than attempting an unverifiable
runtime patch (e.g. capture-phase event re-dispatch), which risks double-firing other listeners with no
way to prove it correct here.

### #589 scope note

The issue's own quoted evidence cites `h-16 + py-3 in app-header.js` for `AppHeader`. Current source
(`app-header.tsx`) already uses `min-h-16`, not a fixed `h-16` — this is already growable and was not
touched. `Input`/`SearchInput`'s `h-control-*` sizes were genuinely still fixed and are the fix in this
PR. `Select` trigger value and `Field` labels clipping (also mentioned in the issue) are outside WS-B's
owned files (`select.tsx`'s `SelectTrigger` itself already uses `min-h-11` per the existing #143 contract
test; `Field` is explicitly excluded from WS-B's ownership).

### Reversing a prior verified decision (input.tsx's dynamic-type allowlist)

`apps/showcase/__tests__/helpers/dynamic-type.ts`'s `FIXED_HEIGHT_ALLOWLIST` had an explicit, reviewed,
documented exemption for `input.tsx`'s fixed height, rationale: "Input mirrors the native single-line
text-field convention... the touch-target guard... keeps the tappable region floor at >=44px regardless
of scale." That rationale conflates the touch-target *floor* (a minimum, satisfied either way) with
whether *visible text clips inside a fixed-height row at large scale* (a different, disprovable claim).
#589's real iOS Dynamic Type evidence (`ios-largetext-*.png` screenshots, `findings-13-...md`) directly
disproves it for Input specifically. This is new evidence changing the context, not an abstract audit
concern, per this repo's own decision-reversal rule — the allowlist entry is removed (input.tsx no longer
has any fixed-height class to allowlist) and the `#143` contract's own doc comment updated to explain why,
rather than silently leaving a technically-still-passing-by-substring-coincidence stale entry in place.

### #612 test-harness caveat

The reported failure is a real-browser gesture/responder race: a mouse press on an option inside an
overflowing `ScrollView`-based listbox getting swallowed by RN's touch-responder negotiation. This repo's
Jest harness (`jest-expo`, `react-test-renderer`, `@testing-library/react-native`'s `fireEvent.press`)
dispatches synthetic presses directly and bypasses any responder negotiation entirely — it cannot
reproduce or disprove the original browser race either before or after the fix. What is proven
deterministically: (1) on Web, the scroll container is now a plain overflow `View`, not `ScrollView`
(structurally eliminating RN's responder involvement, which is the documented root cause of this class of
RNW bug); (2) pressing every option, including the last one in a 20-item overflowing list, still fires
`onValueChange` on both Web and native, with no regression. Real verification requires the Playwright
case the issue itself asks for (`apps/visual-regression`, owned by another workstream).

### #613 item 2

Reproduced the exact scenario from the issue (`value=""` bound to a `SelectItem value="">All</SelectItem>`,
both controlled and uncontrolled via `defaultValue`, and the no-matching-item placeholder-fallback case)
against current `select.tsx` source. In every case `SelectValue` renders correctly — the matching item's
label for a real `''` selection, the placeholder when nothing matches. `Select`'s `resolvedValue`/
`selectedItem` computation uses an explicit `=== undefined` check, never a falsy check, so `''` is never
treated as "no selection." Not reproducible; a regression test locks the correct behavior in as
`select-value-empty-string.test.tsx` (new coverage — this exact scenario was not previously tested).

### #550/#552 investigation (theme-scope in a packed npm consumer)

Both issues report `BeeThemeScope`/`useBeeToken` failing to apply/read scoped semantic CSS in a real
external Vite + React Native Web consumer, while working in this repo's Uniwind-mock-backed Jest tests
(`issue-68-theme-scope.test.tsx`, `issue-72-token-reader.test.tsx`). Investigation:

- `theme-scope.tsx` is a razor-thin, stateless pass-through: it resolves a `{brand, appearance}` (or
  `theme`) selection through a `@beemvp/beeui-tokens` registry and renders Uniwind's own `<ScopedTheme
  theme={...}>` unchanged. There is no BeeUI-owned state, context, or caching to defect in.
- `use-bee-token.ts`'s `useBeeToken`/`getBeeToken` are equally thin: they resolve a CSS variable name via
  `beeTokenReader` and delegate the actual read to Uniwind's own `useCSSVariable`/`Uniwind.getCSSVariable`.
- Built the package (`pnpm --filter @beemvp/beeui-ui build`) and inspected both `dist/commonjs/components/
  theme-scope.js` and `dist/module/components/theme-scope.js`: both are a faithful, unmodified compile of
  the source — `ScopedTheme`/`useCSSVariable`/`Uniwind` remain plain named imports from `'uniwind'` in
  both the CJS and ESM targets, with no bundling, no wrapping, no interop shim that could silently break
  named-export resolution or create a duplicate module instance.
- `packages/ui/package.json` already declares `uniwind` as a `peerDependency` (`>=1.10.1 <2`), not a
  regular `dependency` — the standard, correct way to avoid a duplicate-package-instance React Context
  bug (a scoped-theme Context set by one copy of `uniwind` never reaching a `useContext` call in a
  different copy) in a packed consumer.
- The package's `exports` map (per-component subpaths, generated) correctly branches `import`/`require`/
  `react-native`/`browser`/`default` to consistent dist locations for every entry, including `theme-scope`
  and `use-bee-token` — no anomaly there either.

No defect was found in any file WS-B owns, in the compiled dist output, or in the package's dependency/
export configuration. The acceptance criteria for both issues explicitly forbid introducing a second
theme store/context as a workaround, which rules out the only kind of fix that could paper over an
external-library or external-bundler behavior from inside these files. The most likely remaining
explanations are outside this workstream's file ownership: (a) a genuine `uniwind@1.10.1` runtime
behavior difference under Vite's CSR bundling vs. Metro, or (b) a Tailwind/Uniwind content-scanning
configuration gap in the external consumer's own build (e.g. missing an `@source` glob covering the
packed `node_modules/@beemvp/beeui-ui` dist path for scope-selector generation) — neither reachable from
`packages/ui`/`packages/core` source. Recommend keeping both issues open and, if pursued further,
reproducing with an actual external Vite + RNW harness (out of scope/time for this pass) rather than
guessing further from source inspection alone.

## Unresolved / follow-ups for other workstreams or owners

- `#606`: needs either an upstream `react-native-web`/Uniwind fix or a Playwright regression in
  `apps/visual-regression` (not owned by WS-B).
- `#550`/`#552`: needs a real external Vite/RNW consumer reproduction environment to pinpoint further; see
  investigation above.
- `#584`: code fix applied; real-device confirmation is an explicit owner gate per `plan.md`.
- The `className={className}` raw-forward pattern also exists in `packages/ui/src/components/box.tsx`
  (not owned by WS-B) — worth a follow-up fix by whichever workstream owns it.
- `docs/dynamic-type.md` references `input.tsx`'s (now-removed) fixed-height allowlist entry indirectly
  via the general policy it documents; WS-D should confirm no page explicitly claims Input clips at
  Dynamic Type scale.
