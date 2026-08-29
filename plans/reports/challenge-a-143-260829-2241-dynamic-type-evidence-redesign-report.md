# Challenge A — #143 Dynamic Type native evidence redesign

Branch: `claude/fable5-root-blockers-796be0` (base: main `e19c66b`). No merge; benchmark output.

## Root cause of PR #269's Android red

Old path: home → Component Gallery → `scrollUntilVisible` on
`select-showcase-controlled-trigger`, a target deep inside a very long gallery
(~28s to reach at 1x on the CI emulator). Real font scaling expands every
preceding section; the 180s scroll budget exhausts before the target enters
UIAutomator's visible hierarchy. font_scale itself was applied fine — the
evidence path, not the platform, was the failure.

## Redesign (implemented)

Dedicated runtime fixture screen `DynamicTypeAcceptance`
(`apps/showcase/runtime-smoke/dynamic-type-acceptance.tsx`):

- one tap from Showcase home (`showcase-open-dynamic-type`), targets render at
  the top of the viewport → zero scrolling to the measured targets at every
  audited scale;
- renders `PixelRatio.getFontScale().toFixed(2)` (`dynamic-type-font-scale`) —
  in-app proof the OS scale reached the process, asserted textually per scale
  before any measurement;
- no `AppHeader` → decoupled from #284's large-text collapse;
- growth targets: `dynamic-type-select-trigger`, `dynamic-type-pagination-item-1`
  (the two `h-*`→`min-h-*` fixes); fixed-height exceptions for Web measurement:
  `dynamic-type-save-button`, `dynamic-type-email-input`.

Native harness `scripts/runtime-smoke/android-dynamic-type.sh` (sourceable
segment, invoked at end of `android.sh`; also runnable locally against a booted
emulator): per scale 1.0/1.3/1.5/2.0 → set real `font_scale` → clearState
relaunch → 1 tap → assert scale label → assert targets visible (no scroll) →
single UIAutomator dump → bounds for both targets → screenshot. Final node
check: every scale has usable bounds and 2.0x height > 1.0x height per target.
font_scale reset in cleanup trap.

Web evidence retargeted to the same fixture screen
(`apps/visual-regression/tests/dynamic-type-showcase.spec.ts`): root-font-size
axis + CSS zoom axis, 4 targets, unclipped + growth assertions.

Jest contract suite ported from #269 and re-validated against the new base
(occurrence-exact truncation/fixed-height allowlists, opt-out scan, touch-target
guard, stress-content wrap) + new `dynamic-type-fixture.test.tsx` guarding the
evidence surface itself (testIDs + exact scale-label format the native harness
asserts).

Docs: `docs/dynamic-type.md` rewritten with three honest evidence classes
(deterministic / web / native-Android). Note: PR #269's branch-tip doc still
claimed `Native runtime: SKIPPED` while its own android.sh measured natively —
that inconsistency is fixed here. `docs/components.md` boundary paragraph.
`install-maestro.sh` hardening carried over (banner parse, retried bootstrap).

## Verification

- `pnpm typecheck` — green (hygiene, tokens, 5 workspace typechecks).
- `pnpm test` — green (50 jest suites incl. new fixture + contract suites; token
  + registry node tests).
- Playwright `dynamic-type-showcase.spec.ts` (showcase-integration) — 3/3 green
  against real exported showcase web build.
- Real Android emulator run (local arm64 AVD, API 35, Maestro 2.7.0): **PASS**.
- Final full pipeline on the final tree: `pnpm typecheck` green; `pnpm test`
  green (50 suites / 558 tests); showcase-integration Playwright 29 passed /
  1 skipped-by-design.

## Android evidence results (local emulator, the committed segment verbatim)

Device: local AVD `beeui`, android-35, arm64-v8a, Maestro 2.7.0, real
`settings put system font_scale`, UIAutomator bounds, per-scale in-app
`font scale: X.XX` label asserted before measuring.

| scale | select-trigger h(px) | pagination-item-1 h(px) |
| ----- | -------------------- | ----------------------- |
| 1.0   | 116 (= 44dp floor)   | 105 (= 40dp floor)      |
| 1.3   | 117                  | 109                     |
| 1.5   | 121                  | 116                     |
| 2.0   | **142** (+22%)       | **137** (+30%)          |

`BEEUI_NATIVE_DYNAMIC_TYPE_GROWTH` green for both targets; run repeated —
1.0–1.5 values byte-identical across runs (deterministic). Artifacts (TSV,
4 screenshots, flow logs) in session scratchpad `dt-artifacts/`.

## Findings hit along the way

1. **Live confirmation of #284's blast radius**: at 2.0x the *Showcase home*
   AppHeader (fixed above the ScrollView) consumed the entire viewport → the
   launcher list had zero height → nothing below reachable. Fixed within
   #143's scope by letting home's header scroll with the catalog (comment in
   `showcase-root.tsx`); AppHeader's own defect (#284) untouched/reproducible
   on screens keeping fixed headers.
2. `fontScale` is NOT in the app's `android:configChanges` → font-scale change
   restarts the activity → "navigate first, scale later" evidence designs are
   impossible; per-scale clearState relaunch (as implemented) is the correct
   shape.
3. PR #269 branch-tip inconsistency: `docs/dynamic-type.md` still said
   `Native runtime: SKIPPED` while android.sh on the same branch measured
   natively; PR body also stale. Rewritten coherently here.
4. Local-env only: app dials `10.0.2.2:8081` (emulator host loopback), so
   `adb reverse` cannot redirect it — a stale 2-day-old Metro on host 8081
   (main checkout, broken watcher state) hijacked the first two local runs.
   Killed it; worktree Metro on 8081 = canonical CI mapping. No repo change
   needed (CI always owns 8081).
5. `select-showcase.spec.ts` Escape test + `showcase.spec.ts` gallery matrix
   failed once under heavy parallel load (gradle assembling); 3x isolated
   repeats + full 29-test suite green on idle machine → load flake, not a
   regression from this change.

## Open questions

- CI still runs API 36 x86_64 (unchanged); local evidence used API 35 arm64.
  Same contract asserted — CI run on Mars will produce the canonical artifact.
- Home header now scrolls with content on Showcase home only; if the reviewer
  prefers fixed-at-1x/scroll-at-scale behavior, that belongs to #284's fix.
