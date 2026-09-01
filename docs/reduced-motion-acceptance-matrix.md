# Reduced-motion acceptance matrix (#149, R3.11)

This is BeeUI's final, cross-cutting reduced-motion acceptance record for the 1.0
component set. It complements, and does not replace, `docs/motion.md` (the semantic
motion token vocabulary and its reduced-motion policy) and each component's own local
motion contract. Per the issue's sequence rule, component implementations already honor
Theme Tokens v3 motion policy locally; this matrix is the post-component sweep that
verifies, per surface, the three requirements #149 names:

- essential state changes still occur when motion is reduced;
- no mandatory spatial animation for accessibility;
- BeeUI reads the ambient reduced-motion signal (`prefers-reduced-motion` on Web,
  `AccessibilityInfo.isReduceMotionEnabled()` on native) rather than owning a second
  preference store (`docs/motion.md` "Reduced-motion contract").

## How to read this table

- **Motion of its own** states whether the surface runs any enter/exit transition at
  all, verified by source inspection (no `Animated` import, no RN core `Modal`, no CSS
  transition/keyframe class) — not merely asserted. "None" means there is nothing for
  `prefers-reduced-motion` to gate; the evidence below proves that absence does not
  regress under reduced motion, not that a transition was shortened.
- **Evidence** cites the exact spec/test file and, where applicable, the deterministic
  contract test that pins the actual composed-signal behavior.
- **N/A** rows still link the test that proves the actual behavior, so the row is
  falsifiable, not merely asserted, mirroring `docs/keyboard-focus-acceptance-matrix.md`'s
  own convention.

## Matrix

| Component | Motion of its own | Composes ambient signal | Essential state under reduced motion | No mandatory spatial animation | Evidence |
| --- | --- | --- | --- | --- | --- |
| Dialog / AlertDialog | RN core `Modal`'s `fade` transition (opacity only, ~300ms on Web via `react-native-web`'s `ModalAnimation`) | ✅ **fixed by this change** — `DialogContent` now defaults `animationType` to `none` under reduced motion instead of always running `fade` (`react-native-web`'s `ModalAnimation` never itself checks `prefers-reduced-motion`) | ✅ opens/dismisses, moves/restores focus | ✅ `fade` has no spatial component even before this fix; the fix additionally removes it entirely under reduced motion | Deterministic: `issue-149-reduced-motion-acceptance.test.tsx` ("animationType composes the ambient reduced-motion signal"). Browser: `reduced-motion-acceptance-showcase.spec.ts` ("Dialog opens and dismisses...", "AlertDialog opens and its explicit action dismisses...") |
| Sheet | `sheet-enter`/`sheet-exit` semantic motion intents (opacity+translateY on Web via `resolveMotion`/`Animated`; spring/timing or gorhom's own drag physics on native) | ✅ (existing, #157/#158/#160) — Web reads `matchMedia`; native forwards into gorhom's `overrideReduceMotion` seam | ✅ opens/dismisses, backdrop/Escape/gesture dismissal all still work | ✅ `opacity-or-state` removes the panel translate under reduced motion; `sheet-exit` is `immediate` | Deterministic: `issue-160-sheet-runtime-acceptance.test.tsx` ("reduced-motion mapping"). Browser: `sheet-showcase.spec.ts` ("closes under prefers-reduced-motion: reduce...") |
| Popover | None | N/A — nothing to compose | ✅ opens/dismisses, focus restoration | ✅ (no motion at all) | Deterministic: `issue-149-reduced-motion-acceptance.test.tsx` ("Popover content mounts synchronously..."). Browser: `reduced-motion-acceptance-showcase.spec.ts` ("Popover opens and dismisses...") |
| DropdownMenu | None | N/A | ✅ opens/dismisses, focus restoration | ✅ | Deterministic: `issue-149-reduced-motion-acceptance.test.tsx` ("DropdownMenu content mounts synchronously..."). Browser: `reduced-motion-acceptance-showcase.spec.ts` ("DropdownMenu opens and dismisses...") |
| Select | None | N/A | ✅ opens, keyboard selection, value commit | ✅ | Already exhaustively covered without any motion dependency by `wave-2a-select*.test.tsx` (native) and `select-showcase.spec.ts` (browser); this matrix adds real reduced-motion browser evidence: `reduced-motion-acceptance-showcase.spec.ts` ("Select opens and selects from the keyboard...") |
| Tooltip | None (`docs/components.md` "Tooltip contract") | N/A | ✅ opens (hover/focus/long-press), Escape dismisses | ✅ | Deterministic (native): `issue-149-reduced-motion-acceptance.test.tsx` ("Tooltip ... has nothing motion-specific to gate"). Browser (Web): `tooltip-showcase.spec.ts` ("opens and dismisses under prefers-reduced-motion: reduce") |
| Toast | None (`docs/toast.md`) | N/A | ✅ shows essential content; auto-dismiss timer is unrelated to motion | ✅ | Browser: `reduced-motion-acceptance-showcase.spec.ts` ("Toast shows its essential content...") |
| Calendar / DatePicker / DateTimePicker | None of its own beyond the anchored Popover it presents in (`docs/accessibility-contract.md`) | N/A | ✅ opens, keyboard grid navigation, selection commit, focus restoration | ✅ | Browser: `reduced-motion-acceptance-showcase.spec.ts` ("DatePicker opens the Calendar in a Popover and selects a date..."). Native picker delegation to the system control is out of BeeUI's motion contract by ADR-008 design, not a gap. |
| Table (interactive headers/rows) | None (`docs/accessibility-contract.md`) | N/A | N/A — no enter/exit state to gate | ✅ | `docs/accessibility-contract.md` "Table / DataTable" § "Reduced motion" |
| Skeleton | None — no `animate-*` utility class is applied | N/A | N/A | ✅ | Regression guard: `issue-149-reduced-motion-acceptance.test.tsx` ("Skeleton ... ships no animate-* utility class") |
| Spinner (`ActivityIndicator`) | Platform-native indeterminate spinner (iOS `UIActivityIndicatorView` / Android `ProgressBar` / Web CSS) | N/A — BeeUI does not own or gate this animation; it is a platform accessibility-exempt "essential" busy indicator (WCAG 2.3.3 does not require disabling non-parallax, non-flashing indeterminate progress indicators), and no platform accessibility API exists to suppress it | ✅ (unaffected either way — the indicator is not the state change, `aria-busy`/`Button`'s loading state is) | ✅ small-scale, non-parallax, no flashing | Documented rationale only; no dedicated test — nothing in this component reads or could read the reduced-motion signal |
| Production-demo flows | Deferred | Deferred | Deferred | Deferred | No dedicated production-motion-demo surface exists yet in this repo (mirrors `docs/keyboard-focus-acceptance-matrix.md`'s identical deferral) |

## Evidence index

| Component | Spec/test file | Representative test names |
| --- | --- | --- |
| Dialog / AlertDialog (deterministic) | `apps/showcase/__tests__/issue-149-reduced-motion-acceptance.test.tsx` | "defaults to animationType=\"none\" when reduced motion is enabled", "never overrides an explicit modalProps.animationType...", "updates the resolved default live when the ambient signal changes while mounted" |
| Dialog / AlertDialog (browser) | `apps/visual-regression/tests/reduced-motion-acceptance-showcase.spec.ts` | "Dialog opens and dismisses under prefers-reduced-motion: reduce", "AlertDialog opens and its explicit action dismisses it under prefers-reduced-motion: reduce" |
| Sheet | `apps/showcase/__tests__/issue-160-sheet-runtime-acceptance.test.tsx`, `apps/visual-regression/tests/sheet-showcase.spec.ts` | "forwards the ambient reduced-motion signal into overrideReduceMotion, live", "closes under prefers-reduced-motion: reduce without breaking dismissal" |
| Popover / DropdownMenu (deterministic) | `apps/showcase/__tests__/issue-149-reduced-motion-acceptance.test.tsx` | "Popover content mounts synchronously regardless of the reduced-motion signal", "DropdownMenu content mounts synchronously regardless of the reduced-motion signal" |
| Popover / DropdownMenu / Select / DatePicker / Toast (browser) | `apps/visual-regression/tests/reduced-motion-acceptance-showcase.spec.ts` | "Popover opens and dismisses...", "DropdownMenu opens and dismisses...", "Select opens and selects from the keyboard...", "DatePicker opens the Calendar in a Popover and selects a date...", "Toast shows its essential content..." |
| Tooltip (native, deterministic) | `apps/showcase/__tests__/issue-149-reduced-motion-acceptance.test.tsx` | "reveals content synchronously regardless of the reduced-motion signal" |
| Tooltip (Web, browser) | `apps/visual-regression/tests/tooltip-showcase.spec.ts` | "opens and dismisses under prefers-reduced-motion: reduce" |
| Skeleton (regression guard) | `apps/showcase/__tests__/issue-149-reduced-motion-acceptance.test.tsx` | "ships no animate-* utility class (nothing to gate under reduced motion)" |
| Semantic motion CSS (foundation) | `apps/visual-regression/tests/motion-reduced.spec.ts` | "semantic motion CSS responds to prefers-reduced-motion without changing final-state rendering" |

## Findings fixed by this change

`DialogContent`/`AlertDialogContent` always ran RN core `Modal`'s default `fade`
`animationType` regardless of the user's reduced-motion preference. `react-native-web`'s
`ModalAnimation` (the engine `animationType` reaches on Web) applies its `fade`/`slide`
CSS keyframe unconditionally — it never itself reads `prefers-reduced-motion` — so this
was a real, if narrow, gap: `fade` has no spatial component, so it was never a "no
mandatory spatial animation" violation, but it did not honor the ambient preference
either. `DialogContent` now composes BeeUI's own ambient reduced-motion signal
(`AccessibilityInfo.isReduceMotionEnabled()`/`reduceMotionChanged`, cross-platform because
`react-native-web` itself implements that API via `matchMedia`) into its `animationType`
default (`none` instead of `fade`), gated on the Dialog's own `open` state so closed
Dialogs never query the signal. An explicit caller-supplied `modalProps.animationType`
always wins, matching Sheet's own "explicit override always wins" precedent. See
`dialog.tsx`'s `useReducedMotionPreference` docblock for the full rationale.

## Known gaps (honestly tracked, not silently omitted)

- **Native Dialog/Sheet system-chrome transitions** (`presentationStyle="pageSheet"`/
  `"formSheet"` on iOS, or an explicit non-default `animationType="slide"`) are driven by
  the OS's own native presentation controller once requested, independent of this file's
  JS-level default. These are already documented as EXPERIMENTAL
  (`docs/native-verification.md`) for an unrelated reason (rendering completeness, not
  motion) and are out of scope here: they are an explicit caller opt-in, not this
  matrix's default-path claim.
- **Production-demo rows are deferred**, mirroring `docs/keyboard-focus-acceptance-
  matrix.md`'s identical deferral — no dedicated production-motion-demo surface exists
  yet in this repo.
- **No on-device VoiceOver/TalkBack evidence** exists yet for any reduced-motion interaction
  proven here (#147/#148 closed with checklists recorded; real on-device AT execution is
  owner-deferred to the RC AT gate #249, per `docs/accessibility-contract.md` "Native screen
  readers").
