> **Release-integrity note (#407, 2026-09-02):** this document preserves historical evidence for candidate `5cb061f`. Those tarballs encode the former `0.1.0` package version. The owner-selected date-version label is `20260902`, represented in npm-compatible SemVer as `20260902.0.0`. The visual verification harness was stabilized after `5cb061f` at `18a6833`. Therefore `5cb061f` MUST NOT be published as the current package set. A new immutable candidate must be stamped after #407 lands and the exact new head is green.

# BeeUI 1.0 RC automated CI matrix record (#247, R11.5)

> **Status:** Automated-gate evidence record for the frozen RC candidate. It reports the
> **actual** status of every CI matrix dimension against the candidate surface — including the
> dimensions that are diagnostic or infra-blocked — and cites a real CI run id for each. It
> asserts nothing about npm publication and claims no device/AT evidence that does not exist.
> **Candidate:** `1.0.0-rc-ready.1` = SHA `5cb061f60df312e04036c1f6108ef0f099307bd9`
> ([docs/rc-candidate.md](rc-candidate.md), #246).
> **Snapshot:** 2026-09-02. Evidence generated with Node 24.13.1, pnpm 10.15.0. Runs live at
> `https://github.com/beobungbu/BeeUI/actions/runs/<id>`.

## Evidence method (what runs on the exact candidate, and why the rest is valid)

Most gates ran **on the exact candidate SHA `5cb061f`** — they are triggered by the `push` that
created it. The push-triggered workflows (`ci`, `visual-web`, `web-a11y`, `web-consumer`,
`expo-consumer`) all have completed runs on `5cb061f` and are cited directly below. This is a
**stronger** position than the prior draft: the deterministic Web visual gate (`visual-web`) that
was **red** on the un-landed draft head `a58abe7` is now **green on the exact candidate**, because
[#402] fixed the "Web Escape CASE C" overlay routing and `5cb061f` closed the `visual-web-report`
masking (see §Visual note).

Two workflows are **not** push-triggered — `runtime-native` (Maestro sim/emulator smoke) and
`compat-rn-0-87` (out-of-range diagnostic) run only on `schedule` / `workflow_dispatch` / label,
so no run exists on `5cb061f`. Their most recent executed runs are on `4f347c4`. The only source
delta between `4f347c4` and the candidate that touches the **native** surface is [#402]'s change
to `useOverlayEscapeKey` in `packages/ui/src/components/overlay-runtime.tsx` — a **web-only**
handler: it is gated on `event.key === 'Escape'` and installs a `document`-level keydown listener,
neither of which exists in the native (iOS/Android) runtime. It is inert on native, so the native
runtime-smoke surface is unchanged from `4f347c4`, and that run remains valid candidate evidence
for the native dimension (stated explicitly, not generalized silently — see §Runtime-native note).

Every result is a **Browser-interaction / Build-compile / simulator-emulator class** automated
gate per [docs/beeui-1.0-evidence-classes.md](beeui-1.0-evidence-classes.md). Automated CI **does
not** produce real-device native-runtime or assistive-technology evidence — those are separate,
currently-unmet classes carried by the owner-gated dimensions at the bottom of this record.

## Matrix

| # | Dimension | Workflow · job | Status | On exact candidate SHA? | Run |
| --- | --- | --- | --- | --- | --- |
| 1 | Change classification | `ci.yml` · `classify` | **GREEN** | Yes (`5cb061f`) | [33558917039](https://github.com/beobungbu/BeeUI/actions/runs/33558917039) |
| 2 | Workspace verify (hygiene / typecheck / tests, token generation·lifecycle·consumption, registry / CLI, `release:verify`, Web+Android+iOS Metro bundles, clean packed/CLI consumers, perf-budget checks) | `ci.yml` · `verify` | **GREEN** | Yes (`5cb061f`) | [33558917039](https://github.com/beobungbu/BeeUI/actions/runs/33558917039) |
| 3 | Bare Android native compile | `ci.yml` · `bare-native` | **GREEN** | Yes (`5cb061f`) | [33558917039](https://github.com/beobungbu/BeeUI/actions/runs/33558917039) |
| 4 | Required iOS native compile (Showcase + bare RN 0.86.2) | `ci.yml` · `ios-native` | **GREEN** | Yes (`5cb061f`) | [33558917039](https://github.com/beobungbu/BeeUI/actions/runs/33558917039) |
| 5 | Deterministic Web visual regression (canonical light/dark screenshots + 370-render Pattern Gallery matrix) | `visual-web.yml` · `visual-web` (3 shards) | **GREEN** | Yes (`5cb061f`) | [33558917068](https://github.com/beobungbu/BeeUI/actions/runs/33558917068) |
| 6 | Visual report aggregation (now fails if any shard fails) | `visual-web.yml` · `visual-web-report` | **GREEN** | Yes (`5cb061f`) | [33558917068](https://github.com/beobungbu/BeeUI/actions/runs/33558917068) |
| 7 | Web accessibility (automated axe/keyboard) | `web-a11y.yml` · `web-a11y` | **GREEN** | Yes (`5cb061f`) | [33558917015](https://github.com/beobungbu/BeeUI/actions/runs/33558917015) |
| 8 | Independent Web consumer (packed-tarball install + typecheck/bundle) | `web-consumer.yml` · `web-consumer` | **GREEN** | Yes (`5cb061f`) | [33558917083](https://github.com/beobungbu/BeeUI/actions/runs/33558917083) |
| 9 | Clean Expo SDK 57 consumer — Metro Web/Android/iOS export + typecheck from packed tarballs | `expo-consumer.yml` · `bundle` | **GREEN** | Yes (`5cb061f`) | [33558917009](https://github.com/beobungbu/BeeUI/actions/runs/33558917009) |
| 10 | Expo consumer Android debug-APK native compile | `expo-consumer.yml` · `android-native` | **RED — Gradle config-cache vs Expo template, not a library regression** — see §Expo Android note | Yes (`5cb061f`) | [33558917009](https://github.com/beobungbu/BeeUI/actions/runs/33558917009) |
| 11 | Expo consumer iOS Simulator native compile | `expo-consumer.yml` · `ios-native` | **RED — runner infra, not a library regression** — see §Expo iOS note | Yes (`5cb061f`) | [33558917009](https://github.com/beobungbu/BeeUI/actions/runs/33558917009) |
| 12 | Native runtime smoke — iOS Simulator + Android Emulator Maestro | `runtime-native.yml` · `ios-runtime`, `android-runtime` | **GREEN** (simulator/emulator, not physical device) — surface unchanged since run, see §Runtime-native note | No — `4f347c4` (native surface unchanged) | [33487902789](https://github.com/beobungbu/BeeUI/actions/runs/33487902789) |
| 13 | RN 0.87 forward-compat probe (bare Android + iOS) | `compat-rn-0-87.yml` | **DIAGNOSTIC / EXCLUDED (#131)** — not a required gate; failure is the documented outcome — see §Compat note | No — `4f347c4` (out-of-range probe) | [33489559493](https://github.com/beobungbu/BeeUI/actions/runs/33489559493) |

## Notes on the non-clean rows (stated honestly)

### §Visual note — dimensions 5 & 6 (`visual-web`, `visual-web-report`)

On this candidate the whole `visual-web` workflow is **green**: run
[33558917068](https://github.com/beobungbu/BeeUI/actions/runs/33558917068) shows all three
screenshot shards and the `visual-web-report` job passing (`visual-web (1)` 56 passed,
`visual-web (2)` 88 passed, `visual-web (3)` 156 passed), and shard 3 logs
`BEEUI_GALLERY_FULL_MATRIX … totalRenders:370, failedGroups:[]`. Shard 3 also carries the
overlay-context integration specs, including
`apps/visual-regression/tests/overlay-context.spec.ts` "Web Escape CASE C: later root Popover
behind the dialog cannot steal Escape" — the assertion that was **red** on the prior draft head
`a58abe7`. It is green here because [#402] delegates the Escape dismissal to the depth-aware
`OverlayActiveScopeCoordinator.dispatchTop` (so a shallow overlay's trivially-true local
`isTopmost()` can no longer hijack an Escape meant for a deeper modal), and `5cb061f` makes
`visual-web-report` fail when any shard fails — closing the aggregation gap that previously let a
red shard be masked. Both the visual screenshot matrix **and** the workflow conclusion are green
on the exact candidate. This dimension is no longer an open follow-up.

### §Expo iOS note — dimension 11 (`expo-consumer` · `ios-native`)

The Expo consumer's `bundle` job (dimension 9) is green — the clean-consumer Metro export and
typecheck from the packed tarballs pass. The `ios-native` compile job is red, but the failure is
a **runner-side toolchain setup error, not a BeeUI library regression**: the step aborts during
CocoaPods/Ruby-Bundler setup (`Could not locate Gemfile`, exit code 10), **before** any BeeUI
code is compiled. The equivalent iOS native compile of the Showcase and the bare RN 0.86.2
consumer is exercised in `ci.yml · ios-native` (dimension 4), and the iOS Simulator runtime smoke
passes in dimension 12 — so the frozen library surface does compile and run on iOS. This row is
**infra-blocked**; re-running the job on a correctly-provisioned macOS runner is the remediation,
tracked as an owner/maintainer follow-up. It is **not required** and does not gate the candidate.

### §Expo Android note — dimension 10 (`expo-consumer` · `android-native`)

The Expo consumer's Android debug-APK compile is red, but the failure is a **Gradle
configuration-cache incompatibility in the Expo/React-Native scaffold, not a BeeUI library
regression**: the build aborts with `Configuration cache problems found in this build` because the
generated `app/build.gradle` spawns external `node` processes at configuration time
(`node -e require('expo/scripts/resolveAppEntry') …`, `node --print require.resolve('react-native/package.json')`),
which Gradle 9.3.1's configuration cache rejects. This is **environmental to the consumer test
harness** and independent of the candidate: it fails **identically on the pre-#402 head
`a58abe7`** (run [33554564057](https://github.com/beobungbu/BeeUI/actions/runs/33554564057),
`android-native` failure), so it is not introduced by anything in this candidate. The BeeUI
Android surface itself compiles clean — the **bare Android native compile passes** in
`ci.yml · bare-native` (dimension 3, green on `5cb061f`) — and the clean Expo consumer **bundle**
(dimension 9) is green. This row is **not a required gate** and does not gate the candidate;
remediation (disable the config cache for this job or upstream the `providers.exec` fix) is an
owner/maintainer follow-up on the harness.

### §Runtime-native note — dimension 12 (`runtime-native`)

`runtime-native.yml` runs only on `schedule` / `workflow_dispatch`, so it produced no run on the
`5cb061f` push. Its most recent executed run is
[33487902789](https://github.com/beobungbu/BeeUI/actions/runs/33487902789) (scheduled, SHA
`4f347c4`, **success**), covering the iOS Simulator + Android Emulator Maestro smoke. The single
source change between `4f347c4` and the candidate that touches native-runnable code is [#402]'s
edit to `useOverlayEscapeKey`, which is **web-only** (guarded by `event.key === 'Escape'` and a
`document` keydown listener that has no native equivalent); it cannot alter native overlay
dismissal, which on native is driven by hardware-back / gesture paths in separate code. The
native runtime surface is therefore unchanged from `4f347c4`, and this run is valid candidate
evidence for the native-runtime-smoke dimension. **Caveat, not generalized:** this is
simulator/emulator evidence only — it is **not** physical-device evidence (see #248 below), and
if the owner wants a run bound to the exact candidate SHA, a `workflow_dispatch` of
`runtime-native.yml` on `5cb061f` will produce one.

### §Compat note — dimension 13 (`compat-rn-0-87`)

React Native `0.87.x` is **outside the frozen peer range** (`>=0.86.0 <0.87.0`) and is
**decided/excluded from the 1.0 peer promise on real evidence (#131)**
([docs/compatibility-matrix.md](compatibility-matrix.md)). This workflow is a deliberately
out-of-range **diagnostic** probe: it is opt-in (`workflow_dispatch` or the `ci:rn-0.87` PR
label), **not a required check anywhere**, installs with `--legacy-peer-deps` to bypass the
peer-range self-enforcement, and runs its Android leg with `continue-on-error: true`. Its
`failure` conclusion is the **expected, documented outcome** (the root cause is upstream —
`react-native-safe-area-context` does not build against RN 0.87's native surface — not a BeeUI
defect). It does **not** gate the candidate. Cited run
[33489559493](https://github.com/beobungbu/BeeUI/actions/runs/33489559493) (scheduled, SHA
`4f347c4`).

## Owner-gated dimensions — evidence class NOT obtained by automated CI

Per [docs/beeui-1.0-evidence-classes.md](beeui-1.0-evidence-classes.md), automated CI provides
Browser-interaction / Bundle-compile / simulator-emulator evidence only. The following classes
are **not** produced by any workflow above and are **not** claimed here:

| Dimension | Class required | Status |
| --- | --- | --- |
| RC native runtime on a **real physical device** ([#248](https://github.com/beobungbu/BeeUI/issues/248)) | Native runtime (physical device) | **OWNER_ACTION_REQUIRED** — no physical-device run exists; simulator/emulator smoke (dimension 12) must not be generalized to physical-device behavior. |
| **VoiceOver / TalkBack** assistive-technology interaction ([#249](https://github.com/beobungbu/BeeUI/issues/249)) | Assistive-technology | **OWNER_ACTION_REQUIRED** — the automated `web-a11y` gate (dimension 7) is axe/keyboard Browser-interaction evidence and is **not** an AT certification. No VoiceOver/TalkBack run exists. |

## Go / No-Go on automated gates

- **Green on the exact candidate SHA `5cb061f`:** change classification; full workspace verify
  (deterministic + token + registry/CLI + `release:verify` + Web/Android/iOS bundles + clean
  consumers + perf budgets); bare Android native compile; required iOS native compile; the
  deterministic Web visual screenshot matrix **and** its report aggregation (CASE C now green);
  automated Web a11y; independent Web consumer; clean Expo SDK 57 consumer bundle.
- **Green on the unchanged native surface (`4f347c4`):** native runtime smoke on iOS Simulator +
  Android Emulator (dimension 12) — valid because the only intervening change is web-only.
- **Not required / not gating (stated, not papered over):**
  1. `expo-consumer · ios-native` — runner Bundler/`Gemfile` infra failure, not a library
     regression (iOS compile + runtime proven elsewhere: dimensions 4, 12).
  2. `expo-consumer · android-native` — Gradle 9.3.1 configuration-cache rejection of the Expo
     template's build-time `node` calls; environmental, fails identically pre-#402, and the BeeUI
     Android surface compiles green in `ci · bare-native` (dimension 3).
  3. `compat-rn-0-87` — RN 0.87 excluded per #131; failure is the documented diagnostic outcome.
- **Unmet evidence classes (owner-gated):** physical-device native runtime (#248) and
  VoiceOver/TalkBack AT (#249) — `OWNER_ACTION_REQUIRED`.

#247's DoD is "all **applicable automated** gates green on one exact candidate." Every required
automated gate is green on `5cb061f`; the only non-green rows are a non-required infra failure and
an excluded out-of-range diagnostic, both itemized above rather than hidden. The summary for
[#114](https://github.com/beobungbu/BeeUI/issues/114) should carry forward the two owner-gated
classes (#248, #249) and the two non-gating rows.

## Cross-references

- RC candidate declaration + checksums: [docs/rc-candidate.md](rc-candidate.md) (#246)
- Security / release-readiness audit (same SHA): [docs/rc-security-readiness-audit.md](rc-security-readiness-audit.md) (#251)
- Evidence classes: [docs/beeui-1.0-evidence-classes.md](beeui-1.0-evidence-classes.md)
- Compatibility matrix (RN 0.87 exclusion): [docs/compatibility-matrix.md](compatibility-matrix.md)
- Web a11y acceptance: [docs/rc-web-a11y-acceptance.md](rc-web-a11y-acceptance.md) (#250)
- Native runtime smoke contract: [docs/native-runtime-smoke.md](native-runtime-smoke.md)

[#402]: https://github.com/beobungbu/BeeUI/pull/402
