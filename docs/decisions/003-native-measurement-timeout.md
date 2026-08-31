# ADR-003: Completion budget for unresponsive native measurement callbacks

Status: Accepted

## Context

BeeUI's anchored-overlay runtime resolves both the destination host rectangle and the trigger/anchor rectangle through React Native's asynchronous `measureInWindow` API, guarded by a latest-request-wins generation counter (ADR-002, "Measurement concurrency decision"; `docs/anchored-overlays.md#measurement-contract`).

Two call sites schedule `measureInWindow` and currently treat a scheduled-but-never-resolved callback as **eternally pending**:

- `useMeasuredOverlayHost.measureLatest()` — `packages/ui/src/components/overlay-runtime.tsx:267-284`. The layout-event fallback rect is only applied on the synchronous `!scheduled` branch (`overlay-runtime.tsx:278`); if `measureOverlayNodeInWindow` returns `scheduled === true` (`overlay-runtime.tsx:231-244`, specifically the truthy branch at line 243) and the native callback never fires, `hostRect` never receives even the fallback value.
- `useAnchoredOverlayPosition.remeasure()` — `overlay-runtime.tsx:692-727`. `onAnchorUnavailable` only fires on the synchronous `!scheduled` branch (`overlay-runtime.tsx:718-726`). If `scheduled === true` and the callback never fires, `anchorMeasurement` stays whatever it was (often `null` on first open), the overlay renders in its unresolved/offscreen placeholder state (`pointerEvents="none"`, off-screen coordinates — see the placeholder assertions in `apps/showcase/__tests__/anchor-measurement-seam-proof.test.tsx:92`), and no consumer-visible signal ever fires.

Issue #59 (`gap: overlay measurement can hang silently when the scheduled callback never returns`) documents this as the root cause of PR #54's 27 Jest failures (auto-mocked native instances never invoke their callback) and as a real, non-test-only risk: any environment that drops the native callback (detached view, view recycling, native module/bridge failure) produces a non-interactive, invisible overlay with no error and no diagnostic.

The existing deterministic coverage (`apps/showcase/__tests__/overlay-host-measurement-race.test.tsx`, `anchor-measurement-seam-proof.test.tsx`, `overlay-host-revision-gap.test.tsx`) proves the **generation guard rejects a stale successful callback**. None of it proves what happens when a callback **never arrives at all** — that gap is exactly what this ADR closes.

This ADR governs the architecture-level decision only. Runtime implementation is explicitly out of scope and deferred to `docs/roadmap.md` R1.2–R1.9 (#121–#128).

## Constraints

- **Platform**: must hold identically for React Native (iOS/Android, New Architecture) and React Native Web; the two `measureInWindow` call sites are platform-agnostic source, so the contract cannot fork by `Platform.OS` inside `@beemvp/beeui-ui` beyond documenting expected-frequency differences.
- **Compatibility**: must not change the public `Popover`/`DropdownMenu`/`DialogContent` component APIs. The only public extensibility point already in the anchor path, `onAnchorUnavailable`, must remain the sole consumer-facing signal — no new required prop.
- **Accessibility**: an overlay stuck in the unresolved placeholder state is itself an accessibility defect (invisible, non-interactive, but still mounted and potentially still exposed to assistive tech via `accessibilityElementsHidden`/`aria-hidden` timing). Resolving the hang is an accessibility-relevant fix, not cosmetic.
- **Source ownership / dependency**: no new npm dependency. The mechanism must live in `@beemvp/beeui-ui`'s existing runtime layer (`overlay-runtime.tsx`), not in `@beemvp/beeui-core`'s pure geometry kernel, which by contract (`docs/anchored-overlays.md` Layer 1) has no React/React Native/DOM/timer dependency.
- **Performance / non-goal**: no polling loop. `docs/anchored-overlays.md:127` already states "BeeUI does not poll at 60fps" for remeasurement; the budget mechanism must not introduce continuous polling, only a single bounded wait per scheduled measurement.
- **Determinism (explicit issue constraint)**: "Do not replace the silent hang with arbitrary flaky wall-clock behavior." The completion budget must be provable by a deterministic test seam (`#125`'s regression matrix), not by real `sleep`/`setTimeout` durations racing CI scheduling variance.
- **Invariant preservation (explicit issue constraint)**: "Preserve latest-request-wins and scope semantics." The unresponsive-callback path must reuse the existing generation-ref and host-revision guards (`overlay-runtime.tsx:254`, `:274`, `:683`, `:701-704`) rather than introduce a second, parallel supersession mechanism.
- **Non-goal**: this ADR does not implement runtime code, does not tune the final numeric budget constant (that is #121's job, informed by #126's real-device stress evidence), and does not address the unrelated `pageSheet`/`formSheet` overlay tap-swallow issue (#62/#128).

## Options considered

### Option A — Injectable tick-based watchdog reusing the existing generation guard (chosen)

Arm a cancellable "watchdog" alongside every `scheduled === true` measurement request, keyed to the same generation value already held in `measurementGenerationRef` (host) / `anchorMeasurementGenerationRef` (anchor). The watchdog's timing primitive is an injectable `MeasurementScheduler` seam — production wires it to `requestAnimationFrame` tick-counting (available identically on RN and RN Web); tests inject a manual/fake scheduler requiring explicit `tick()` calls, exactly like the existing internal `hostRectOverride`/`transport` seams (`overlay-runtime.tsx:302-308`).

If the watchdog's tick budget elapses before the real callback invokes, the request is retired exactly like a synchronous `scheduled === false` result: the generation ref is advanced (so a late-arriving real callback is dropped by the *existing* `generation !== ref.current` check with no new special-case code), and the platform-appropriate terminal action runs (anchor: `onAnchorUnavailable()`; host: fallback-rect-or-retain, see Decision below).

- **Benefits**: reuses 100% of the existing supersession machinery (no new race surface); budget is frame-based, not wall-clock, so it scales with actual device frame delivery instead of a guessed millisecond constant; fully deterministic under test via the injectable scheduler; minimal new public surface (no new component prop).
- **Risks/tradeoffs**: adds one more piece of internal state (watchdog handle) that must be cancelled on every existing retirement path (success, supersession, close/unmount) — enumerated exhaustively in Decision below to close that risk.
- **Web/iOS/Android implications**: identical mechanism; expected-frequency differs (see Decision, Web/native differences).
- **Dependency/package/registry impact**: none; uses RN's already-relied-upon global `requestAnimationFrame`.
- **Accessibility/RTL/large-text/reduced-motion impact**: none directly; indirectly resolves the invisible/non-interactive stuck-overlay defect described in Context.
- **Migration/semver impact**: none; internal runtime change only.
- **Testing/runtime evidence required**: deterministic tests per Verification plan (this ADR); real iOS/Android runtime stress at #126 to validate the default tick budget against genuine device frame timing.

### Option B — Wall-clock `setTimeout(ms)` budget

Race the callback against a fixed-millisecond timer.

- **Rejected.** Directly conflicts with the explicit issue constraint against "arbitrary flaky wall-clock behavior": a millisecond constant is either too short (false-positive unresponsive detection under real, legitimate device jank/load) or too long (reintroduces a perceptible hang) with no principled way to pick it, and tests would need real timers or `jest.useFakeTimers()` racing against React's own scheduling, which has historically been a source of flakiness in this codebase's overlay suites (the exact class of problem #59 itself grew out of).

### Option C — Dev-only assertion/warning with no functional completion budget (issue #59 proposal 2)

Document that callbacks MUST fire exactly once and add a `__DEV__`-only warning when they do not, but leave the functional hang unresolved.

- **Rejected as the primary/sole mechanism.** It satisfies the "dev diagnostics" DoD item but not "completion budget," "host fallback," "anchor-unavailable policy," or "late-callback handling" — the overlay would still be permanently stuck for the end user, which is precisely what #59 reports as unacceptable. Retained as a **complementary** requirement (see Decision, Dev diagnostics) layered on top of Option A, not as a replacement for it.

### Option D — Fix the Jest test seam only, assume real native environments always deliver the callback (issue #59 proposal 3)

- **Rejected.** #59 explicitly conditions this option on "maintainers confirm real native environments guarantee callback delivery," and no such guarantee exists: detached/recycled native views, Fabric/TurboModule failures, and view-manager errors are real, documented ways for a scheduled native callback to never resolve. Fixing only the test seam would leave the production risk in place while removing the only signal (failing tests) that currently makes it visible.

### Option E — Promise-wrapped `measureInWindow` raced via `Promise.race`

Wrap `measureInWindow` in a `Promise` and race it against a timeout `Promise`.

- **Rejected as a distinct mechanism.** The underlying `measureInWindow` call still never resolves or rejects on its own when the callback is dropped, so a `Promise.race` timeout still requires exactly the same scheduler/timer primitive underneath Option A — this is a plumbing change, not an alternative mechanism. Promise cancellation also does not compose cleanly with the codebase's existing synchronous `generation !== ref.current` invalidation idiom used throughout `overlay-runtime.tsx`, which would need to be duplicated or bridged rather than reused. Option A's plain callback/ref shape is kept for consistency with the rest of the file.

## Decision

Adopt **Option A**. The following contract is binding for #121–#125's implementation.

### Completion budget

- Every `measureOverlayNodeInWindow` call that returns `scheduled === true` (host: `overlay-runtime.tsx:272`; anchor: `overlay-runtime.tsx:698`) arms a watchdog for the **same generation value** already incremented immediately before scheduling.
- The watchdog's timing primitive is expressed in **schedulable ticks, not milliseconds**, via an injectable `MeasurementScheduler`:

  ```ts
  export type MeasurementScheduler = {
    /** Returns a cancel function. Calling cancel after the tick already fired is a no-op. */
    scheduleTick: (onTick: () => void) => () => void;
  };
  ```

  - **Production default**: `requestAnimationFrame`-based tick counting (identical primitive on RN and RN Web), with a default budget of **2 ticks** before a scheduled measurement is declared unresponsive. This is a starting default, not a final tuned constant — #121 owns tuning it against #126's real-device evidence, provided any revised value remains tick-based and injectable per this contract.
  - **Test seam**: an internal `measurementScheduler` prop threaded through `OverlayRuntimeProviderProps` (alongside the existing internal `hostRectOverride`/`transport` seams, `overlay-runtime.tsx:302-308`), documented as an internal deterministic test seam, not a public API. Tests supply a manual scheduler whose `scheduleTick` only fires when the test explicitly advances it (e.g. inside `act()`), so "budget elapsed with no callback" is provable without real timers, `jest.useFakeTimers()`, or sleep-based races.
- Frame-tick budgeting (not wall-clock) is the load-bearing property that satisfies the "no arbitrary flaky wall-clock behavior" constraint: the budget scales with actual scheduling/frame delivery on the runtime it executes on, and is fully substitutable in tests.

### Late-callback handling

- When the watchdog's tick budget elapses first, the generation ref is advanced exactly as it already is on every other retirement path. No new comparison logic is introduced.
- If the real native callback later fires for a generation that the watchdog already retired, it is dropped by the **existing** `generation !== ref.current` guard (`overlay-runtime.tsx:274`, `:701`) — this is the same code path that already rejects a stale successful callback today (proven by `overlay-host-measurement-race.test.tsx` and `overlay-host-revision-gap.test.tsx`). A late callback after a declared-unresponsive timeout produces **no additional state change and no additional dev diagnostic** — the diagnostic already fired at timeout (see Dev diagnostics).

### Anchor-unavailable policy

- On watchdog timeout for the anchor path, the request is treated identically to a synchronous `scheduled === false` result at `overlay-runtime.tsx:707-711`: `setAnchorMeasurement(null)` and `onAnchorUnavailable?.()` fire exactly once.
- This reuses the only existing public extensibility point in the anchor path; no new callback prop is introduced.
- The existing host-revision guard (`requestedHostRevision !== hostRevisionRef.current`, `overlay-runtime.tsx:702`) and open-state guard (`!openRef.current`, `overlay-runtime.tsx:703`) apply identically to the timeout resolution path as they do to the success/failure callback path — a host geometry change or a close that happens between scheduling and timeout must suppress the timeout's `onAnchorUnavailable` call exactly as it already suppresses a late real callback (extends the exact scenario proven by `overlay-host-revision-gap.test.tsx` to the timeout trigger, not just the stale-callback trigger).

### Host fallback

- On watchdog timeout for the host path, apply the same fallback resolution `measureLatest` already performs on the synchronous `!scheduled` branch (`overlay-runtime.tsx:278-280`): if a layout-event-derived fallback rect is available (from the most recent `onLayout`), commit it via `setRectIfChanged(setHostRect, fallback)`.
- If no fallback rect is available (for example, the very first measurement of the runtime's lifetime times out before any `onLayout` has fired), `hostRect` remains `null`. This is not a new state — it is the pre-existing "host not yet measured" state that already gates dependent anchor positioning (`viewportRect`/`windowPosition` in `useAnchoredOverlayPosition` are `null` while `hostRect` is `null`, `overlay-runtime.tsx:750-758`) — so downstream consumers do not need a new state to handle.
- The host path has no consumer-facing `onHostUnavailable` callback and this ADR does not add one: retaining the last good rect (or the pre-existing `null` state) is a strictly safer default than forcing every host consumer to newly handle an explicit failure signal, and keeps this ADR's public-API surface at zero.

### Close/unmount invalidation

- Every existing generation-retiring cleanup path (`useMeasuredOverlayHost`'s layout-effect cleanup at `overlay-runtime.tsx:262-264`; `useAnchoredOverlayPosition`'s unmount effect at `overlay-runtime.tsx:685-690`; its close-triggered reset at `overlay-runtime.tsx:730-735`) must, in addition to advancing the generation ref, explicitly cancel any outstanding watchdog `scheduleTick` cancel-handle for that generation.
- A watchdog that fires after its owning hook has unmounted, or after `open` has gone `false`, must be a guaranteed no-op: it must not call `setState` on an unmounted component, must not invoke `onAnchorUnavailable`, and must not emit a dev diagnostic (see Dev diagnostics — unmount/close is normal retirement, not "unresponsive").

### Dev diagnostics

- Genuine watchdog timeout (budget elapsed, generation still current, overlay still open/mounted, host revision unchanged) emits exactly **one** `__DEV__`-only `console.warn` per occurrence, following the existing precedent in `packages/ui/src/components/overlay-host-mode.ts:43-53` and `packages/ui/src/components/use-required-callback-warning.ts:9-21` (guarded by `typeof __DEV__ !== 'undefined' && __DEV__`, stripped from production builds, never thrown).
- The warning identifies which measurement (host vs. anchor), and references this ADR (`docs/decisions/003-native-measurement-timeout.md`) for remediation guidance, matching the existing `docs/anchored-overlays.md` cross-reference convention in `overlay-host-mode.ts:51`.
- Retirement paths that are **not** genuine unresponsiveness — supersession by a newer request, close/unmount, or a host-revision change mid-flight — must **not** emit this warning; they are normal operation, not a defect signal. Only the terminal "budget elapsed with no resolution and no superseding cause" state is diagnostic-worthy.
- Production (`__DEV__` false) builds never warn and never throw; the functional fallback/unavailable behavior above is unconditional and identical in dev and production.

### Web/native differences

- The mechanism (tick-based injectable watchdog, generation-guard reuse) is identical on Web and native — no `Platform.OS` fork inside the watchdog itself.
- **Expected frequency differs by platform**, and this ADR records that difference for #124/#126 to act on:
  - **Web** (`react-native-web`'s `measureInWindow`, backed by `getBoundingClientRect`): resolution is effectively synchronous/microtask-scoped. The watchdog is a defensive backstop; in practice it is expected to almost never fire. A Web-side watchdog firing is a stronger signal of a genuine bug (e.g., a foreign ref that does not actually support measurement) than of ordinary asynchrony, and #124's diagnostic copy should reflect that.
  - **Native** (iOS/Android via Fabric/the bridge): asynchronous resolution is the norm, and non-delivery is a documented real risk (#59's root cause: detached/recycled native views, TurboModule/bridge failures). The watchdog's unresponsive path is the expected, load-bearing recovery mechanism on native, not an edge case.
- The default tick budget starts identical on both platforms (see Completion budget); #121/#126 may justify a platform-specific value later with real-device evidence, but the *mechanism* stays the single shared abstraction defined here — this ADR does not authorize a second, platform-forked watchdog implementation.

### Terminal-state summary

| # | Terminal state | Trigger | Anchor path result | Host path result | Dev diagnostic |
| --- | --- | --- | --- | --- | --- |
| 1 | Success | callback fires within budget | commit measured rect | commit measured rect | none |
| 2 | Immediate unavailable | `measureInWindow` missing/not a function (`scheduled === false`) | `onAnchorUnavailable()`, rect `null` | apply layout fallback if present, else unchanged | none (pre-existing, unchanged by this ADR) |
| 3 | Unresponsive timeout — anchor | scheduled, budget elapses, no callback, generation/host-revision/open still current | `onAnchorUnavailable()`, rect `null`, generation retired | n/a | exactly one |
| 4 | Unresponsive timeout — host | scheduled, budget elapses, no callback, generation still current | n/a | apply layout fallback if present, else retain previous rect, generation retired | exactly one |
| 5 | Late callback after timeout | real callback fires after its generation was retired by timeout | dropped by existing generation guard | dropped by existing generation guard | none |
| 6 | Superseded by newer request | a new remeasure starts before resolution/timeout | old watchdog cancelled, old callback dropped by generation guard | old watchdog cancelled, old callback dropped by generation guard | none |
| 7 | Close/unmount while pending | overlay closes or component unmounts before resolution/timeout | watchdog cancelled, no commit, no callback fires | watchdog cancelled, no commit, no callback fires | none |
| 8 | Host revision changes mid-flight (anchor) | host geometry changes between anchor schedule and resolution/timeout | stale result (success or timeout) dropped by host-revision guard | n/a | none |
| 9 | Web transport | any of the above, Web `measureInWindow` | same contract; timeout expected to be rare | same contract; timeout expected to be rare | same triggers; a Web timeout is a stronger bug signal |
| 10 | Native transport | any of the above, native `measureInWindow` | same contract; timeout is the expected recovery path for dropped bridge callbacks | same contract; timeout is the expected recovery path for dropped bridge callbacks | same triggers |

## Rejected alternatives

See Options considered above for the full reasoning on Options B–E. Summary:

- **Wall-clock millisecond timeout** (Option B) — rejected: violates the explicit "no arbitrary flaky wall-clock behavior" constraint and cannot be made deterministic under test without fighting React's own scheduler.
- **Dev-warning-only, no functional resolution** (Option C) — rejected as a standalone fix: leaves the reported hang unresolved for end users. Retained as an additive requirement layered on Option A.
- **Test-seam-only fix, trust native delivery** (Option D) — rejected: the trust assumption is false per #59's documented evidence and cannot be confirmed by any maintainer.
- **Promise.race wrapper** (Option E) — rejected as a distinct mechanism: reduces to the same underlying scheduler primitive with worse composition against the file's existing generation-guard idiom.
- **New public `onHostUnavailable` callback** — considered while drafting the host-fallback decision, rejected: no existing consumer need justifies the added public surface; retain-or-fallback is a safe default and keeps this ADR's API impact at zero, consistent with the "no accidental public API expansion" rule in `docs/agent-execution-contract.md`.
- **Platform-forked watchdog implementations (separate Web/native code paths)** — rejected: the single injectable-scheduler abstraction already covers both platforms' primitives (`requestAnimationFrame` exists on both); forking would duplicate the generation-guard integration for no behavioral gain, and only the default tick *count* is left open for future platform-specific tuning.

## Implementation consequences

This ADR unblocks and directly constrains:

- **#121 (R1.2, bounded measurement completion)** — implements the `MeasurementScheduler` seam and watchdog arming/cancellation in `overlay-runtime.tsx` per the Completion budget and Close/unmount invalidation sections above; owns tuning the default tick count.
- **#122 (R1.3, deterministic host fallback)** — implements the Host fallback terminal state exactly as specified (fallback-rect-or-retain, no new callback).
- **#123 (R1.4, anchor-unavailable completion/cleanup)** — implements the Anchor-unavailable policy and Late-callback handling terminal states, reusing the existing `generation`/host-revision/`open` guards as specified.
- **#124 (R1.5, development diagnostics)** — implements the Dev diagnostics section, including the Web/native differing-severity framing.
- **#125 (R1.6, load-bearing race/fallback/ABA/unmount regression matrix)** — must add the deterministic tests enumerated in Verification plan below, extending the existing suites rather than duplicating their setup.
- **#126 (R1.7, real iOS/Android runtime stress)** — must validate the default tick budget from Completion budget against genuine device frame timing and report back if platform-specific tuning is warranted (Revisit trigger below).
- **#127 (R1.8, independent final review and closure of #59)** — reviews #121–#126 against this ADR's terminal-state table and closes #59 only once every row is covered by load-bearing evidence.
- **#128 (R1.9, #62 pageSheet/formSheet policy)** — unaffected; explicitly out of scope for this ADR (unresponsive-callback behavior is orthogonal to the `pageSheet`/`formSheet` tap-swallow issue tracked separately in memory as "Issue #62 pageSheet overlay race").

No other issue, ADR, or public contract is changed by this document.

## Verification plan

All verification is deterministic-contract evidence (`docs/beeui-1.0-evidence-classes.md`) executed through the injectable `MeasurementScheduler` seam — no real timers, no `jest.useFakeTimers()` racing React's scheduler, no sleep-based waits. #125 must add, at minimum, tests proving:

1. **Unresponsive anchor timeout**: schedule an anchor measurement whose mock `measureInWindow` never invokes its callback; advance the injected scheduler through the budget; assert `onAnchorUnavailable` fires exactly once and the rendered anchor rect stays in its unresolved state — extending the harness already proven in `anchor-measurement-seam-proof.test.tsx`.
2. **Unresponsive host timeout, with fallback**: same shape at the host layer, with a prior `onLayout` fallback recorded; assert the fallback rect commits after the budget elapses — extending `overlay-host-measurement-race.test.tsx`'s mock-callback harness.
3. **Unresponsive host timeout, no fallback**: same, with no prior `onLayout`; assert `hostRect` remains `null` and no crash/warning beyond the single expected dev diagnostic occurs.
4. **Late callback after timeout is inert**: advance the scheduler to trigger timeout, then invoke the original (now-stale) native callback; assert no further state change and no second dev diagnostic.
5. **Superseded before timeout is inert**: start a remeasure, start a second remeasure before the budget elapses, then advance the scheduler; assert the first watchdog produces no `onAnchorUnavailable`/fallback commit and no dev diagnostic — proving supersession, not timeout, retired it.
6. **Close/unmount before timeout is inert**: close or unmount the owning component before the budget elapses, then advance the scheduler; assert no `act()`-outside-render warning, no state commit, and no dev diagnostic.
7. **Host-revision change during timeout window**: extend `overlay-host-revision-gap.test.tsx`'s exact gap scenario so the pending callback is replaced by a scheduler-driven timeout, proving the host-revision guard rejects a timeout resolution exactly as it already rejects a stale successful callback.
8. **Dev diagnostic gating**: assert exactly one `console.warn` call under `__DEV__` for a genuine timeout, and zero calls for every other terminal state in the summary table, including a simulated `__DEV__ = false` pass producing zero warnings.

Each of these tests must be load-bearing per `docs/agent-execution-contract.md`: reverting the watchdog/fallback/late-callback logic under test must make the corresponding test fail, not merely change a snapshot.

Deterministic contract evidence does not, by itself, prove real native callback-drop behavior. #126's real iOS/Android Simulator/device runtime evidence remains required before #127 can close #59, per `docs/beeui-1.0-evidence-classes.md`'s rule against generalizing compile/deterministic evidence into a native runtime claim.

## Revisit trigger

Revisit this ADR if any of the following becomes concrete evidence rather than speculation:

- **#126's real-device stress evidence shows the default tick budget produces false-positive unresponsive detection** on legitimately slow/low-end devices (frame delivery genuinely exceeds the budget without a dropped callback) — revisit the numeric default and/or whether a platform-specific budget is warranted; the tick-based mechanism itself would not need to change.
- **A future React Native release changes `measureInWindow`'s delivery guarantees** (for example, a synchronous or Promise-native layout-measurement API becomes the supported primitive) — revisit whether a completion budget is still necessary at all, or whether the watchdog can be simplified/removed.
- **Product requirements change such that a dropped host measurement must visibly fail** (rather than silently retaining stale-but-valid geometry) — revisit the Host fallback decision and consider whether a new `onHostUnavailable` callback is then justified.
- **#124's real-world dev-diagnostic telemetry shows Web-side timeouts firing at non-negligible frequency** in supported environments — revisit the Web/native differing-severity framing; a frequent Web timeout would indicate the mechanism, not just an isolated bug, needs reconsideration on that platform.
