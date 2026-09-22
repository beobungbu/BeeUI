# WS-L · fix #584: BeeUI `Sheet` presents on iOS

Date: 2026-09-19 · Branch: `ws/l-sheet-ios-fix` (from `fix/consumer-audit-followups` @ 251ac8f)
Evidence folder: `plans/260919-1258-consumer-audit-followups/reports/ios-evidence/` (files prefixed `fix-`)

## Root cause

Two independent defects in `packages/ui/src/components/sheet.native.tsx` had to be true at once for "present() is called, no error, no onChange, nothing renders", and the absolute-fill boundary WS-K blamed was neither of them (its own table shows raw variants C–E failing with no absolute-fill wrapper at all). First, `SheetContent`'s `open` effect ran `sheetRef.current?.dismiss()` on mount for a sheet that had never been presented; in gorhom 5.2.14 `BottomSheetModal.dismiss()` on a modal whose status is still `CLOSED` takes the early exit that calls `unmount()` — `unmountSheet(key)` and `unmountPortal(key)` for a sheet and portal that never mounted — after which the later `present()` mounted nothing (proven on device: with the mount-time `dismiss()` skipped and nothing else changed, the modal mounted and immediately surfaced the second defect). Second, `BottomSheetModal` does not mount its children where it is rendered: it hands them to gorhom's own store-backed `@gorhom/portal`, which mounts them under `BottomSheetModalProvider`, so React context declared below that provider is invisible to the sheet content — the `Sheet` root context first of all, and every `BeeUIProvider` context when the consumer follows the documented wiring with `BeeUIProvider` inside the gorhom provider (the #584 reporter's layout). The first render inside the mounted modal therefore threw `Error: Sheet components must be used inside Sheet.` from `SheetClose` (captured through Metro's Hermes inspector, `07:36:26.137`), and React tore the subtree down. Two smaller defects were found once the sheet drew: `BottomSheetView` is absolutely positioned and content-sized by gorhom (it exists for `enableDynamicSizing`, which BeeUI turns off), so the content sat as a short card at the top of a 90% sheet with nothing below it; and gorhom's content container defaults to `accessible` with its own "Bottom Sheet" label, which iOS folds into one accessibility element so neither VoiceOver nor XCTest (Maestro) could reach the dialog content — the reason WS-K's a11y assertions and screenshots disagreed.

## The fix (`packages/ui`)

`sheet.native.tsx`:

- `dismiss()` is only sent for a sheet BeeUI presented and gorhom has not yet reported dismissed (`presentedRef`): never on mount, never after gorhom's own `onDismiss` (swipe, backdrop), and re-armed when `dismissOnRequestClose={false}` re-presents.
- `SheetPortalContextBridge` captures, in place, the `Sheet` root context, `SafeAreaInsetsContext`/`SafeAreaFrameContext`, and the overlay runtime (`useOverlayRuntimeSnapshot()` → `OverlayRuntimeBridge`, new in `overlay-runtime.tsx`) and re-provides them as the first thing inside `BottomSheetModal`, so `SheetClose`, `useSafeAreaInsets`, `ModalOverlayHost`, and nested BeeUI overlays inside the sheet resolve what they would have resolved in place. Consumer context declared below `BeeUIProvider` is not bridged (declare it above `BottomSheetModalProvider` or pass values as props — docs text below).
- Layout: the content now lives in a plain in-flow `View style={{ flex: 1 }}` directly under `BottomSheetModal` — the same box gorhom's own scrollables use — instead of `BottomSheetView`. gorhom's `BottomSheetContent` has an explicit animated height (snap point minus handle, keyboard-adjusted), so an in-flow `flex: 1` child fills exactly the content area gorhom computed; `BottomSheetView` (`position: absolute; top/left/right: 0`, no height) can only ever be content-sized. `ModalOverlayHost` is unchanged and keeps its absolute-fill boundary; inside a definite-height flex box that boundary fills as intended, so the a11y-modal boundary, portal outlet, host geometry, and dismiss scope keep the exact `sheet.tsx`/`DialogContent` shape. `styles.contentFill` stays.
- `accessible={false}` on `BottomSheetModal` so BeeUI's `role="dialog"` content `View` owns the modal semantics, as on the other two platforms.

`overlay-runtime.tsx`: adds `OverlayRuntimeSnapshot`, `useOverlayRuntimeSnapshot()` and `OverlayRuntimeBridge` (internal; not re-exported from the package barrel, so `ui-exports:check` is unaffected). A `layout` prop for `ModalOverlayHost` was tried and removed once the device proved the default boundary works inside the flex box.

## Evidence (iPhone 16 Pro, iOS 18.6, same app build as WS-K)

Toolchain: Node 24.13.1 / pnpm 10.15.0, `expo start --localhost --port 8081` without `CI`, the WS-K-installed `com.beeui.showcase` debug build reused (native config unchanged: `app.json`, `package.json`, lockfile identical to the WS-K base), `@beemvp/beeui-ui` resolved from source by Metro, Maestro via `/opt/homebrew/opt/openjdk@17`, JS console through Metro's `/inspector/debug` (Expo 57 Metro printed no `LOG` lines; only `iOS Bundled 1748ms apps/showcase/index.ts (1740 modules)` and the Fast Refresh rebundles).

| File | What it shows |
| --- | --- |
| `fix-baseline-unfixed-after-present.png` | Unfixed branch on this worktree, gallery Sheet demo after three Maestro taps on `sheet-demo-trigger`: nothing presented (matches WS-K). |
| `fix-sheet-before-present.png` | Fixed build, gallery scrolled to the Sheet demo just before the tap (Maestro screenshot). |
| `fix-sheet-after-present.png` | Fixed build after the tap (`simctl`): backdrop, handle, 90% sheet surface, "Filters", description, Search input, Close — the #584 acceptance shot. |
| `fix-maestro-sheet-after-present.png` | Same moment from Maestro's own screenshot step, after `sheet-demo-content` and the description text were asserted visible. |

Console lines around the tap (UTC, via the inspector):

```
07:32:38.615 console.log: [beeui-debug] open effect true true        # unfixed: present() reached, then silence — no onChange, no layout
07:36:26.137 console.error: Error: Sheet components must be used inside Sheet.   # dismiss() skipped only: modal mounts, SheetClose throws (context)
07:48:14.498 console.log: Running "main" ...                         # full fix: no errors; a11y assertions pass (below)
```

Lifecycle proven on the runtime fixture (`runtime-sheet-*`, 50% snap point) in one Maestro run, every step `COMPLETED`: present → `SheetClose` → not visible; present → swipe down → not visible; present → backdrop tap → not visible; present again → visible. The wired `ios-sheets.yaml` then passed twice end to end (53 commands). The Simulator MCP `tap` was not used for verdicts (WS-K's finding stands); the MCP panel was attached for viewing and `screenshot`.

## Files changed

- `packages/ui/src/components/sheet.native.tsx` — fix (above).
- `packages/ui/src/components/overlay-runtime.tsx` — `useOverlayRuntimeSnapshot` / `OverlayRuntimeBridge`.
- `apps/showcase/runtime-smoke/runtime-acceptance.tsx` — root `Sheet` fixture (`runtime-sheet-trigger/content/close/overlay`, `snapPoints={['50%']}` so the backdrop is tappable).
- `apps/showcase/runtime-smoke/maestro/ios-sheets.yaml` — #584 block: present, `SheetClose`, backdrop, re-present, screenshot `.artifacts/runtime-smoke/ios/sheet-present`; runs through the existing `scripts/runtime-smoke/ios.sh` wiring, label gating untouched. The gallery was not used for the smoke: its sticky header overlays the list and Maestro's centered `sheet-demo-trigger` can land underneath it.
- `apps/showcase/component-gallery/component-gallery.tsx` — WS-K's `RawGorhomSheetControls` and dev console anchors removed; the file is byte-identical to the pre-WS-K base, which is what made the `sheet` excerpt citation whole again.
- `apps/showcase/__tests__/issue-158-sheet-native.test.tsx` — see Tests.
- `apps/showcase/__tests__/{issue-149-reduced-motion-acceptance,issue-160-sheet-runtime-acceptance,runtime-stress-fixture,showcase-root}.test.tsx` — their `react-native-safe-area-context` mocks gain `SafeAreaInsetsContext`, `SafeAreaFrameContext`, `useSafeAreaFrame` (the bridge re-provides them).
- `apps/docs/src/content/docs/components/{sheet,date-time-picker,icon-button,tabs,toolbar}.md`, `docs/component-reference.md` — generator output (`docs:portal-pages:generate`, `docs:contract:generate`); `sheet` gains the runtime fixture, the rest is drift already on the branch.
- Not committed: `apps/showcase/ios/` (prebuild copied from the WS-K worktree), Expo's rewrite of `apps/showcase/tsconfig.json`/`expo-env.d.ts` (restored).

## Tests

`issue-158-sheet-native.test.tsx`, new `describe('BeeUI issue #584 ...')`:

1. `sends dismiss() only for a sheet it presented, never on mount and never after gorhom dismissed it` — the first defect.
2. `keeps the Sheet root, safe-area, and overlay runtime contexts reachable when the engine mounts the content elsewhere` — the gorhom mock now publishes its children to a store that a `MockDetachedHost` rendered outside `Sheet` mounts (the real portal's shape); asserts the content mounted there, `SheetClose` still closes, and a probe inside reads the insets declared above the Sheet (44, not the mock default) plus the `BeeUIProvider` overlay runtime.
3. `renders the content in an in-flow flex box directly under the modal, with the modal not claiming accessibility for it` — `BottomSheetView` never renders; the chain modal → `flex: 1` in-flow View → single absolute-fill a11y boundary → content; `accessible={false}` reaches `BottomSheetModal`. This is the spec's "structural test", updated to the shape the fix ended with.

Updated to the new contract (stated per the brief): `presents on open and dismisses on close ...` expected one `dismiss()` on mount; it now expects none before the first `present()` and one after `SheetClose`.

## Gates

| Command | Result |
| --- | --- |
| `corepack pnpm lint` | pass |
| `corepack pnpm --filter @beemvp/beeui-ui typecheck` | pass |
| `corepack pnpm --filter @beemvp/beeui-showcase typecheck` | pass |
| `corepack pnpm --filter @beemvp/beeui-showcase test` | 126 suites, 1132 tests pass |
| `corepack pnpm ui-exports:check` | pass (63 subpaths, unchanged) |
| `corepack pnpm --filter @beemvp/beeui-visual-regression build:web` then `... exec playwright test tests/sheet-showcase.spec.ts tests/sheet-backdrop-covers-viewport-with-short-root.spec.ts` | 15 passed |
| `corepack pnpm docs:portal-pages:generate && corepack pnpm docs:portal-pages:check` | pass (the `sheet` excerpt citation error is gone) |
| `corepack pnpm docs:contract:check` | failed on stale `docs/component-reference.md`; regenerated with `docs:contract:generate`, then pass |
| iOS simulator | above; `ios-sheets.yaml` passes locally twice |

## Docs text for apps/docs (not edited here)

Sheet page, native section: "On native the sheet content is rendered by `@gorhom/bottom-sheet`'s own portal under `BottomSheetModalProvider`. BeeUI re-provides its own contexts (Sheet, safe area, overlay runtime) inside the sheet, so `SheetClose`, nested Popover/Menu/Select and safe-area hooks work regardless of whether `BeeUIProvider` sits above or below `BottomSheetModalProvider`. Your own React context is only visible inside `SheetContent` if its provider is above `BottomSheetModalProvider`; otherwise pass values as props." Recommended wiring: `GestureHandlerRootView` > `BeeUIProvider` > `BottomSheetModalProvider` > app (the Showcase's order), which also keeps `useToast` reachable inside a Sheet.

Status: DONE_WITH_CONCERNS
Branch: ws/l-sheet-ios-fix @ 3c67413 (this report and the four `fix-*.png` files are the commit on top)
Summary: #584 is fixed at the cause — no mount-time `dismiss()` on a never-presented gorhom modal, and BeeUI's contexts bridged across gorhom's portal — with the sheet now filling its snap point and reachable by VoiceOver/XCTest; proven on iPhone 16 Pro / iOS 18.6 by screenshot and a Maestro lifecycle flow, and pinned by Jest and the wired iOS smoke.
Concerns: `useToast` inside a Sheet still throws when `BeeUIProvider` is rendered inside `BottomSheetModalProvider` (`ToastContext` lives in `toast.tsx`, outside WS-L's files; the Showcase's provider order avoids it); the legacy (non-teleport) overlay transport store is likewise not bridged; Android was not run, so the smoke is wired to the iOS flow only; the Simulator MCP `inspect` action was unavailable, so a11y reachability is evidenced by Maestro's XCTest hierarchy.
