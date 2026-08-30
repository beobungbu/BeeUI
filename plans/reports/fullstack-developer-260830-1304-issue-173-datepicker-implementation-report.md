# Issue #173 DatePicker Implementation Report

## Executed Phase
- Issue: #173 (R4F.3, ADR-008), parent #114, depends on #172/#171 (merged to main)
- Worktree: /Users/textsoft/workspace/beeui-wt-173, branch feat/173-datepicker
- Base SHA: 3f45783 (exact, as assigned)
- Head SHA: ca6edd7891532bc8dcec746f234e4b59795a31a1
- PR: https://github.com/beobungbu/BeeUI/pull/320 (NOT merged)
- Status: completed, ready for independent review

## Files Modified/Created
New:
- packages/ui/src/components/date-picker-shared.tsx — DatePickerProps type, useDatePickerFieldIntegration, useDatePickerOpenState (Select's exact open/uncontrolled precedence)
- packages/ui/src/components/date-picker-locale.ts — Intl-based formatted-display helper
- packages/ui/src/components/date-picker.web.tsx — Popover+Calendar Web presentation, aria-expanded fix, initial-focus-into-grid effect
- packages/ui/src/components/date-picker.native.tsx — Android imperative DateTimePickerAndroid.open(), iOS Dialog-hosted inline picker
- packages/ui/src/components/date-picker.d.ts — types-only fallback (mirrors overlay-transport.d.ts)
- apps/showcase/__tests__/issue-173-date-picker-web.test.tsx (11 tests)
- apps/showcase/__tests__/issue-173-date-picker-native.test.tsx (10 tests, datetimepicker mocked)
- apps/showcase/component-gallery/date-picker-showcase.tsx — gallery fixture
- apps/visual-regression/tests/date-picker-showcase.spec.ts — real Chromium Playwright spec (4 tests)

Modified:
- packages/ui/src/index.ts — barrel export for DatePicker + re-export of CalendarDate/CalendarWeekStartsOn (previously missing from #172, needed so consumers can type controlled state without reaching into @beeui/core)
- packages/ui/package.json — @react-native-community/datetimepicker devDependency (9.1.0 exact) + optional ranged peerDependency (>=9.1 <10)
- apps/showcase/package.json — same dependency (~9.1.0), needed since gallery fixture bundles into native Showcase builds
- registry/registry.json — new "date-picker" entry
- docs/compatibility-matrix.md — new row for @react-native-community/datetimepicker, honest evidence class stated
- apps/showcase/component-gallery/component-gallery.tsx — wires DatePickerShowcase into gallery
- scripts/__tests__/beeui.test.mjs — updated hard-coded registry list-output fixture
- pnpm-lock.yaml — new dependency

## Key design decisions
- `value: CalendarDate | null` controlled-only (no defaultValue), mirroring Calendar's own shipped contract — ADR-008 says "controlled selected value" only for DatePicker, unlike open state which is explicitly controlled/uncontrolled.
- `open`/`onOpenChange`/`defaultOpen` follow Select's exact precedence (hasOwnProperty-based controlled detection) — computed from the real top-level `props` object in each platform file, then passed into the shared hook (a first version accidentally computed `hasOwnProperty` against a freshly-constructed wrapper object, always true; fixed).
- Clear affordance rendered as a **sibling** Pressable of the trigger (not nested), avoiding any double-toggle/bubbling risk entirely rather than needing stopPropagation.
- readOnly gates the `Popover`'s own `open`/`onOpenChange` wiring (`effectiveOpen`), not `PopoverTrigger`'s onPress (which unconditionally toggles internally) — avoids a double-toggle bug found during self-review.
- Native: Android uses the community-recommended imperative `DateTimePickerAndroid.open()` (avoids Android's known double-dialog mount issue); iOS wraps the inline picker in BeeUI's existing `Dialog` (reuses Android Back/dismiss/focus/portal rather than a new modal authority). `isDateDisabled` is Web-only (native system picker has no such API) — documented as an honest 1.0 limitation.
- `@react-native-community/datetimepicker` peer marked `optional: true` (deviates slightly from ADR-008's literal "exact pattern" wording for react-native-safe-area-context/teleport, since Web-only consumers never need it — same rationale already used for react-dom's optional peer).

## Real bugs found and fixed via the actual Chromium Playwright run
1. `aria-expanded` never reached the DOM on the trigger button — react-native-web's `createDOMProps` silently drops the compound `accessibilityState` object on Web (same class of pre-existing issue already worked around for `Button`'s `aria-busy`, per that file's own comment). Fixed locally in `date-picker.web.tsx` by setting `aria-expanded` as an explicit prop; did NOT patch shared `popover.tsx` (out of file ownership) — flagging as a likely repo-wide pre-existing gap affecting any `PopoverTrigger`/`DropdownMenu` consumer relying on `accessibilityState.expanded`, worth a dedicated follow-up issue.
2. The initial-focus-into-Calendar-grid query (`querySelector('[tabindex="0"]')`) matched the Calendar's "previous month" IconButton instead of the intended day cell (it precedes the grid in document order and is also a real focusable button). Fixed by scoping to `[role="cell"][tabindex="0"]`.

Both were invisible to Jest (react-test-renderer, not real DOM/focus) — only caught because the Playwright browser run was actually executed, not just written.

## Tests Status
- Type check: pass (`pnpm typecheck`, repo-wide)
- Unit tests: pass (`pnpm test`, repo-wide — 706+21 Jest tests, 26 registry CLI tests)
- Release verify: pass (`pnpm release:verify` — packed tarballs, clean-consumer installs, no Expo leakage)
- Web bundle/compile: pass (`expo export --platform web` for apps/showcase)
- Browser interaction (Playwright, real Chromium via `@playwright/test` against the exported Web build): 4/4 passing (keyboard focus into grid + Enter select + close, Escape without value change + focus restoration, clear without opening, PageDown month nav with disabled weekend day)
- Native compile/runtime (iOS Simulator/Android Emulator): **SKIPPED — no Xcode/Android SDK in this sandboxed environment.** Explicitly authorized as deferred scope by the task assignment; documented honestly in docs/compatibility-matrix.md and owed to #176/#177.

## Issues Encountered
- `createNodeMock` for anchor measurement is broken under this exact jest-expo/React 19/@testing-library/react-native combination (documented gotcha, already discovered by the team for Select's own tests) — worked around by reusing the existing `./helpers/select-anchor-seam` prototype-patching seam rather than inventing a new one.
- Playwright's `webServer` config repeatedly left orphaned processes on ports 4173/4174 across invocations in this sandboxed session (background-process lifecycle instability specific to this harness); worked around by manually managing the two static servers via `nohup`/`disown` + curl health-checks before invoking `playwright test` directly.
- No conflicts with parallel/sibling issues; only files needed for #173's own contract were touched.

## Follow-up recommended (not created as a GitHub issue — flagging for the owner)
- `Popover`'s `PopoverTrigger` (and likely `DropdownMenu`) should probably set `aria-expanded` explicitly rather than relying on `accessibilityState.expanded`, matching `Button`'s own `aria-busy` precedent — real, reproducible gap found via this issue's Playwright run, but out of #173's file ownership to fix in `popover.tsx` itself.

## Next Steps
- Independent review per docs/beeui-1.0-review-checklist.md.
- Native runtime acceptance (#176/#177) to produce the deferred Android/iOS compile+simulator evidence for `date-picker.native.tsx`.
- Consider filing the `aria-expanded`/`accessibilityState.expanded` Popover gap as its own issue.

Status: DONE
Summary: DatePicker implemented per ADR-008 with Web (Popover+Calendar) and native (system picker) platform split, full deterministic test coverage, and a real executed Chromium Playwright run proving keyboard/Escape/focus/clear — two real bugs found and fixed via that run. Native compile/runtime evidence explicitly deferred (no toolchain here) per task's own allowance. PR #320 open against main, unmerged.
Concerns: Native (iOS/Android) DatePicker presentation is unverified beyond TypeScript correctness — deferred to #176/#177. Recommend filing a follow-up issue for the discovered Popover aria-expanded gap.
