# #584 investigation — Sheet never presents on iOS (real Expo 57 consumer)

## Verdict

Fixed in code (`packages/ui/src/components/sheet.native.tsx`): `BottomSheetModal` now passes
`enableDynamicSizing={false}`. This is a code-level fix with strong supporting evidence, but **real
on-device confirmation remains an owner gate** — this repo's Jest harness mocks `@gorhom/bottom-sheet`
entirely (no native module registry, no Reanimated worklet runtime), so it cannot execute gorhom's own
dynamic-sizing/measurement pipeline and therefore cannot prove the sheet actually becomes visible on a
real iPhone 16 Pro / iOS 18.6 device build. Issue should stay open until that on-device proof lands (per
`plan.md`'s own note: "real-device proof is an owner gate").

## Root cause

`sheet.native.tsx`'s `SheetContent` renders:

```tsx
<BottomSheetModal ... snapPoints={resolvedSnapPoints}>
  <BottomSheetView style={styles.contentFill /* { flex: 1 } */}>
    ...
  </BottomSheetView>
</BottomSheetModal>
```

`resolveSheetSnapPoints` always returns a non-empty array (`['90%']` by default, or the caller's own
`snapPoints`), but `BottomSheetModal` never set `enableDynamicSizing`, so gorhom v5's own default
(`true`) stayed active. With dynamic sizing on, gorhom measures `BottomSheetView`'s own content height
and inserts that measurement as the modal's *first* snap point — but `BottomSheetView` here is given
`flex: 1` with no bounding parent height (`ModalOverlayHost`'s own wrapper), which measures to `0` in an
unbounded container. That produces a zero-height snap point; `index={clampedInitialIndex}` (default `0`)
then targets it. This matches the issue's own reproduction exactly:

- BeeUI's actual behavior: `present()` called on a mounted `BottomSheetModal`, no `onChange` at all, no
  visible sheet, no error.
- The reporter's own raw-gorhom bisection mimicking BeeUI's content shape (`BottomSheetView` with
  `flex: 1`, dynamic sizing default): `onChange 0` fires but the sheet is not visible (content measures
  0, snap point 0).
- Same raw-gorhom mimic with `enableDynamicSizing={false}`: presents at 50% with content visible
  (reporter's screenshot `ios-sheet-fixed.png`).
- The reporter explicitly flags BeeUI's own case as "worse" (no `onChange` at all vs. `onChange 0`),
  suggesting a second contributing factor they could not isolate in their sandbox
  (`keyboardBehavior`/`keyboardBlurBehavior`/`enableDismissOnClose` were called out as unbisected).

## Fix applied

`enableDynamicSizing={false}` added to `BottomSheetModal` in `sheet.native.tsx`. Since
`resolveSheetSnapPoints` always supplies an explicit `snapPoints` array (BeeUI's own sizing contract,
never omitted), always disabling dynamic sizing is unconditionally correct here — there is no code path
where BeeUI wants gorhom's own content-measurement sizing instead of the explicit snap points it already
computes.

## What was NOT reproduced/verified here (owner gate)

- No Simulator/device build was run — the exact second factor the reporter flagged (BeeUI's total
  absence of `onChange`, vs. the raw mimic's `onChange 0`) is not proven fixed or explained by this
  change alone. `keyboardBehavior="interactive"`, `keyboardBlurBehavior="restore"`, and
  `enableDismissOnClose` remain unbisected against the exact reported environment
  (`@gorhom/bottom-sheet` 5.2.14, `react-native-reanimated` 4.5.1, `react-native-worklets` 0.10.1,
  `react-native-gesture-handler` 2.32.0, RN 0.86.3, dev client built with `expo run:ios`).
- The issue's own suggested regression coverage ("a Maestro/simulator case 'controlled Sheet opens from
  a Pressable'") is native-runtime/simulator-level evidence this Jest suite cannot produce; that
  belongs to the native runtime smoke suite (out of WS-B's owned files).

## Regression coverage added (deterministic, this repo's Jest harness)

`apps/showcase/__tests__/issue-158-sheet-native.test.tsx`:
- `always disables gorhom dynamic sizing, since snapPoints is always explicit (#584)` — asserts
  `enableDynamicSizing === false` and the default `snapPoints === ['90%']` reach the mocked
  `BottomSheetModal`.
- `disables dynamic sizing the same way when the caller supplies explicit snapPoints` — same assertion
  with an explicit multi-point `snapPoints` array.

These lock in the deterministic half of the fix (the prop is always passed correctly) but cannot, by
construction, prove the on-device visual outcome — see Verdict above.

## Recommendation

Keep #584 open until a real Expo 57 dev-client build on an iPhone 16 Pro simulator/device confirms the
sheet becomes visible with this change. If it does not, bisect `keyboardBehavior`/`keyboardBlurBehavior`/
`enableDismissOnClose` next, per the reporter's own unfinished bisection list.
