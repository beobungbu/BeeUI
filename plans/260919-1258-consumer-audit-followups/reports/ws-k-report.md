# WS-K · iOS Simulator evidence for #584 (Sheet) and #609 (setTheme('system'))

Date: 2026-09-19 · Branch: `ws/k-ios-evidence` (from `fix/consumer-audit-followups` @ 944d490)
Evidence folder: `plans/260919-1258-consumer-audit-followups/reports/ios-evidence/`

## Environment

| Item | Value |
| --- | --- |
| Simulator | iPhone 16 Pro (UDID 97DF90D1-E5BC-4725-94D6-42D57AA3976A), iOS 18.6 (22G86) |
| Host | macOS 26.6.2, Xcode 26.6 |
| App | `apps/showcase` debug build, `expo prebuild --clean --platform ios` + `expo run:ios --no-bundler`, bundle `com.beeui.showcase`, New Architecture (`fabric: true` in the RN boot log), Hermes |
| expo | 57.0.15 |
| react-native | 0.86.2 |
| react-native-reanimated | 4.5.1 |
| react-native-worklets | 0.10.1 (680 `__workletHash` occurrences in the served iOS dev bundle, same count the issue reports) |
| @gorhom/bottom-sheet | 5.2.14 |
| react-native-gesture-handler | 2.32.0 |
| uniwind | 1.10.1 |
| @beemvp/beeui-ui | in-repo source (Metro resolves the `source` export condition); `sheet.native.tsx` already carries `enableDynamicSizing={false}` |
| Node / pnpm | 24.13.1 / 10.15.0 |
| Driving tools | iOS Simulator MCP (`attach`/`launch`/`screenshot`/`tap`/`swipe`/`touch_path`; `inspect` was unavailable in this session), `xcrun simctl` (appearance toggle, PNG capture), Maestro 2.x with `/opt/homebrew/opt/openjdk@17` (XCTest taps + accessibility hierarchy), CDP listener on Metro's `/inspector/debug` (JS console with timestamps), Metro terminal log |

Setup notes that cost time and are worth knowing:

- `expo start` inherited `CI=1` from the prebuild shell on the first attempt; Metro then runs in CI mode ("reloads are disabled"), serves a frozen bundle, and prints **no** `LOG` lines. Restarting Metro without `CI` restored watch mode, Fast Refresh, and `LOG` output in the terminal.
- The Simulator MCP `tap` on the BeeUI "Open Sheet" button never registered as a press (five attempts; the list scrolled ~250pt each time and no `onPress` log fired), while the same tool pressed "Theme", "Browse components" and "Open Dialog" fine. Maestro's XCTest tap on the same `testID` pressed it immediately. Every #584 verdict below is from the Maestro tap path; the MCP anomaly is a tooling artefact, not a BeeUI finding.

## Showcase changes (apps/showcase only, committed on this branch)

`apps/showcase/component-gallery/component-gallery.tsx`:

- Sheet demo: `onOpenChange` and `SheetTrigger onPress` now emit dev-only `console.log` lines (`[showcase] SheetTrigger onPress`, `[showcase] Sheet onOpenChange open=…`) so the Metro console shows when BeeUI calls gorhom `present()`.
- `RawGorhomSheetControls` (rendered only when `__DEV__`): two raw gorhom `BottomSheetModal`s under the Sheet demo — a working control (`sheet-raw-gorhom-trigger`) and an `absoluteFill` repro (`sheet-raw-gorhom-absolutefill-trigger`). See the bisect below.

No files under `packages/**` were changed. `apps/showcase/ios/` (prebuild output) is left uncommitted.

## #609 — `Uniwind.setTheme('dark')` then `setTheme('system')` follows the OS again: PASS

The Showcase home already has the toggle (`ShowcaseThemeControl`, cycles `system → light → dark → system` via `Uniwind.setTheme`), so no toggle was added.

Steps (all on the home screen):

1. Fresh launch, simulator appearance `light`, app shows `Theme: system`, light UI → `theme-system-initial-light.png`.
2. Tap the theme button twice: `system → light → dark`. App renders dark while the simulator is still `light` (explicit override works) → `theme-dark.png`.
3. Tap once more: `dark → system` (button reads `Theme: system`).
4. `xcrun simctl ui <udid> appearance light` → app renders light → `theme-system-after-toggle-light.png`.
5. `xcrun simctl ui <udid> appearance dark` → app renders dark → `theme-system-after-toggle-dark.png`.

Result: after an explicit `dark` and a subsequent `setTheme('system')`, the app follows the simulator appearance in both directions with no restart. On this branch and this stack the iOS half of #609 does not reproduce. (The web half — `matchMedia` after `setTheme('system')` — was out of WS-K scope and is not covered here.)

## #584 — BeeUI `Sheet` presents on iOS: FAIL (reproduced with `enableDynamicSizing={false}` already applied)

Steps:

1. Home → "Browse components" → scroll to the "Sheet" section (`maestro-sheet-before-present.png`; also `sheet-before-present.png` via `simctl`).
2. Maestro `tapOn: id: sheet-demo-trigger` (13:28:04 local).
3. Wait 5 s for `sheet-demo-content`; screenshot (`maestro-sheet-after-present.png`; `sheet-after-present.png` via `simctl` ~40 s later).
4. Maestro `hierarchy` dump after the tap.

Console around `present()` (CDP listener, UTC timestamps; the same two lines appear as `LOG` in the Metro terminal):

```
06:28:04.313 console.log: [showcase] SheetTrigger onPress
06:28:04.315 console.log: [showcase] Sheet onOpenChange open=true
```

Nothing else was logged after that — no warning, no error, and no `[showcase] Sheet onOpenChange open=false` (which BeeUI emits from gorhom's `onDismiss`), so gorhom did not self-dismiss. The next line only arrived four minutes later, when a Fast Refresh remounted the gallery:

```
06:32:17.555 console.log: [showcase] Sheet onOpenChange open=false
```

That line matters: BeeUI's `handleDismiss` only runs from gorhom's `onDismiss`, which only fires for a modal gorhom considers mounted/presented. So `present()` did reach gorhom and the modal was live in gorhom's bookkeeping — it just rendered nothing.

Observed:

- Screenshot after present: identical to before — no backdrop, no handle, no sheet surface (`maestro-sheet-after-present.png`, `sheet-after-present.png`).
- Accessibility hierarchy after present contains none of `sheet-demo-content`, `sheet-demo-overlay`, `sheet-demo-input`, `sheet-demo-close`, nor the "Refine results…" text — the content is not in the tree at all (unmounted or zero-sized).
- Matches the issue's description exactly: `present()` called on a mounted `BottomSheetModal`, no error, nothing visible. The `enableDynamicSizing={false}` change from WS-B is in the served bundle (`enableDynamicSizing: false` present in the bundle text) and does not fix it.

### Bisect with raw gorhom modals in the Showcase (no library code changed)

Each variant is a raw `BottomSheetModal` with `snapPoints={['90%']}` and `enableDynamicSizing={false}`, presented from a plain Button via Maestro from a fresh app launch. "Visible" is judged from the screenshot, not the a11y assertion (they disagreed in variant A).

| Variant | Modal props | Content shape | `onChange` | Visible |
| --- | --- | --- | --- | --- |
| A | defaults | `BottomSheetView style={{flex:1}}` > `View absoluteFill` > BeeUI `Text` | `index=0` | container (white bg + handle) yes, content **no** — `raw-gorhom-variant-a-after-present.png` |
| B | BeeUI's exact `SheetContent` prop set (`backgroundComponent={null}`, `enableDismissOnClose`, `enablePanDownToClose`, `index={0}`, `keyboardBehavior="interactive"`, `keyboardBlurBehavior="restore"`, `overrideReduceMotion`, `android_keyboardInputMode`) | same as A | `index=0` | **nothing** — `raw-gorhom-variant-b-after-present.png` (this is the BeeUI symptom, reproduced raw) |
| C | as B | no absoluteFill, padded View | `index=0` | nothing |
| D | B minus keyboard*/overrideReduceMotion | no absoluteFill | `index=0` | nothing |
| E | as D | no absoluteFill, **no `flex:1`** on BottomSheetView | `index=0` | nothing |
| F | defaults | `BottomSheetView` (no style) > red 200pt View + RN `Text` | `index=0` | **nothing** — `raw-gorhom-variant-f-after-present.png` |
| G | defaults | `BottomSheetView style={{flex:1}}` > red 200pt View + RN `Text` | `index=0` | **yes, fully** (90% sheet, red box, text) — `raw-gorhom-variant-g-after-present.png` |
| H | defaults | G plus a `StyleSheet.absoluteFill` View wrapping the red box | `index=0` | **nothing** — `raw-gorhom-variant-h-after-present.png` |

Reading:

1. G proves the environment: `GestureHandlerRootView` + `BottomSheetModalProvider` wiring, reanimated 4.5.1, worklets 0.10.1 and gorhom 5.2.14 present a modal correctly in this exact app on this exact simulator. The defect is in what BeeUI puts inside the modal, not in the consumer wiring or the toolchain.
2. G → H is a single change — wrapping the content in a `StyleSheet.absoluteFill` View — and it goes from fully visible to nothing. That wrapper is precisely what `ModalOverlayHost` (`packages/ui/src/components/overlay-runtime.tsx`, the `boundary` View with `style={StyleSheet.absoluteFill}`) puts between `BottomSheetView` and BeeUI's content in `sheet.native.tsx`. With `backgroundComponent={null}` BeeUI paints its surface on the content View that lives inside that wrapper, so when the wrapper collapses there is no fallback background either — hence "nothing renders" rather than "an empty sheet".
3. F → G shows the other constraint: with dynamic sizing off, `BottomSheetView` needs `flex: 1` to be visible on this stack. BeeUI already passes `styles.contentFill = { flex: 1 }`, so keep it; do not remove it as part of a fix.
4. `onChange` fired `index=0` in every raw variant, visible or not, so a consumer-side `onChange` is not a usable health signal for this failure. (The issue's "no onChange at all" from BeeUI is expected: `sheet.native.tsx` does not pass `onChange`.)
5. Not bisected: BeeUI's custom `backdropComponent`/`handleComponent` and the `ModalOverlayHost` outlet/measurement Views. They are downstream of the absoluteFill boundary and were not needed to reproduce.

Recommendation for the fix owner (not applied here — WS-K does not touch `packages/**`): give `ModalOverlayHost`'s boundary a non-absolute layout when it is hosting a gorhom `BottomSheetView` (e.g. `flex: 1` in normal flow, or move the modal-local host outlet outside the sheet's content wrapper), then re-run the Maestro flow used here (`scrollUntilVisible` → `tapOn id: sheet-demo-trigger` → assert `sheet-demo-content` visible) as the native runtime smoke the issue asks for. The two dev-only buttons under the Sheet demo (`sheet-raw-gorhom-trigger`, `sheet-raw-gorhom-absolutefill-trigger`) reproduce G and H on demand.

## Files

- `ios-evidence/theme-system-initial-light.png`, `theme-dark.png`, `theme-system-after-toggle-light.png`, `theme-system-after-toggle-dark.png` — #609.
- `ios-evidence/maestro-sheet-before-present.png`, `maestro-sheet-after-present.png`, `sheet-before-present.png`, `sheet-after-present.png` — #584 BeeUI Sheet.
- `ios-evidence/raw-gorhom-variant-{a,b,f,g,h}-after-present.png` — bisect.

Status: DONE_WITH_CONCERNS
Branch: ws/k-ios-evidence @ 70ad505 (showcase controls) + the evidence commit on top
Summary: #609 passes on iOS (system-follow resumes after an explicit theme); #584 still reproduces with the WS-B fix in place, and a raw-gorhom bisect in the Showcase isolates the `StyleSheet.absoluteFill` boundary that `ModalOverlayHost` wraps around the sheet content as the single change that makes a presenting `BottomSheetModal` render nothing.
Concerns: #584 needs a `packages/ui` change (out of WS-K scope) and a native smoke test; the Simulator MCP `tap` did not press the Sheet trigger (Maestro did), so the MCP alone is not a reliable driver for this button; container visibility in variant A vs H differed with the same wrapper, so the fix should be verified visually, not via a11y assertions or `onChange`.
