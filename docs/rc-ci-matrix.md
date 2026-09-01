# BeeUI 1.0 RC automated CI matrix record (#247, R11.5)

> **Status:** Automated-gate evidence record for the frozen RC candidate. It reports the
> **actual** status of every CI matrix dimension against the candidate surface — including the
> dimensions that are currently red or diagnostic — and cites a real CI run id for each. It
> asserts nothing about npm publication and claims no device/AT evidence that does not exist.
> **Candidate:** `1.0.0-rc-ready.1` = SHA `a58abe71a179a395f7ace35c1e73adf8515737bc`
> ([docs/rc-candidate.md](rc-candidate.md), #246).
> **Snapshot:** 2026-09-02. Evidence generated with Node 24.13.1, pnpm 10.15.0. Runs live at
> `https://github.com/beobungbu/BeeUI/actions/runs/<id>`.

## Evidence method (why prior-head runs are valid here)

The RC library surface is **frozen** ([docs/api-freeze.md](api-freeze.md) #243,
[docs/token-freeze.md](token-freeze.md) #244) and the candidate commit `a58abe7` is
**documentation-only** (it adds the two freeze docs; it changes no package, CLI, registry,
token, or component source). Every commit between the last native-gate run cited below
(`4f347c4`, #389) and the candidate is docs/test-eval only. Therefore a green gate on the
frozen surface at `4f347c4`…`a58abe7` is valid candidate evidence for the dimensions it
exercised. Two dimensions — `web-a11y` and `web-consumer` — completed green on the **exact
candidate SHA** push; the rest are cited from the most recent completed runs on the unchanged
frozen surface. (The candidate-SHA push runs for `ci`, `visual-web`, and `expo-consumer` were
still queued/in-progress on the self-hosted runner at snapshot time — see the note per row —
so a completed run on the identical frozen surface is cited instead of an incomplete one.)

Every result is a **Browser-interaction / Build-compile class** automated gate per
[docs/beeui-1.0-evidence-classes.md](beeui-1.0-evidence-classes.md). Automated CI **does not**
produce real-device native-runtime or assistive-technology evidence — those are separate,
currently-unmet classes carried by the owner-gated dimensions at the bottom of this record.

## Matrix

| # | Dimension | Workflow · job | Status | Evidence class | Run |
| --- | --- | --- | --- | --- | --- |
| 1 | Change classification | `ci.yml` · `classify` | **GREEN** | Deterministic | [33553826050](https://github.com/beobungbu/BeeUI/actions/runs/33553826050) |
| 2 | Workspace verify (hygiene / typecheck / tests, token generation·lifecycle·consumption, registry / CLI, `release:verify`, Web+Android+iOS Metro bundles, clean packed/CLI consumers, perf-budget checks) | `ci.yml` · `verify` | **GREEN** | Deterministic + Clean-consumer + Bundle | [33553826050](https://github.com/beobungbu/BeeUI/actions/runs/33553826050) |
| 3 | Bare Android native compile | `ci.yml` · `bare-native` | **GREEN** | Bundle/compile | [33553826050](https://github.com/beobungbu/BeeUI/actions/runs/33553826050) |
| 4 | Required iOS native compile (Showcase + bare RN 0.86.2) | `ci.yml` · `ios-native` | **GREEN** | Bundle/compile | [33553826050](https://github.com/beobungbu/BeeUI/actions/runs/33553826050) |
| 5 | Deterministic Web visual regression (28 canonical + 370-render Pattern Gallery matrix) | `visual-web.yml` · `visual-web` | **GREEN (visual matrix)** — see §Visual note | Visual | [33553216495](https://github.com/beobungbu/BeeUI/actions/runs/33553216495) |
| 6 | Visual report aggregation | `visual-web.yml` · `visual-web-report` | **GREEN** | Visual | [33553216495](https://github.com/beobungbu/BeeUI/actions/runs/33553216495) |
| 7 | Web accessibility (automated axe/keyboard) | `web-a11y.yml` · `web-a11y` | **GREEN — exact candidate SHA** | Browser-interaction | [33554564024](https://github.com/beobungbu/BeeUI/actions/runs/33554564024) |
| 8 | Independent Web consumer (packed-tarball install + typecheck/bundle) | `web-consumer.yml` · `web-consumer` | **GREEN — exact candidate SHA** | Clean-consumer + Bundle | [33554564064](https://github.com/beobungbu/BeeUI/actions/runs/33554564064) |
| 9 | Clean Expo SDK 57 consumer — Metro Web/Android/iOS export + typecheck from packed tarballs | `expo-consumer.yml` · `bundle` | **GREEN** | Clean-consumer + Bundle | [33553826030](https://github.com/beobungbu/BeeUI/actions/runs/33553826030) |
| 10 | Expo consumer iOS Simulator native compile | `expo-consumer.yml` · `ios-native` | **RED — runner infra, not a library regression** — see §Expo iOS note | Bundle/compile | [33553826030](https://github.com/beobungbu/BeeUI/actions/runs/33553826030) |
| 11 | RN 0.87 forward-compat probe (bare Android + iOS) | `compat-rn-0-87.yml` | **DIAGNOSTIC / EXCLUDED (#131)** — not a required gate; failure is the documented outcome — see §Compat note | Bundle/compile (diagnostic) | [33489559493](https://github.com/beobungbu/BeeUI/actions/runs/33489559493) |
| 12 | Native runtime smoke — iOS Simulator + Android Emulator Maestro | `runtime-native.yml` · `ios-runtime`, `android-runtime` | **GREEN** (simulator/emulator, not physical device) | Native runtime (sim/emu) | [33487902789](https://github.com/beobungbu/BeeUI/actions/runs/33487902789) |

## Notes on the non-clean rows (stated honestly)

### §Visual note — dimension 5 (`visual-web`)

The **visual screenshot evidence itself is green**: run
[33553216495](https://github.com/beobungbu/BeeUI/actions/runs/33553216495) logs
`BEEUI_GALLERY_FULL_MATRIX … totalRenders:370, failedGroups:[]` and its `visual-web (1)`,
`visual-web (2)`, and `visual-web-report` jobs pass — the 28 canonical light/dark screenshots and
the full 370-render Pattern Gallery matrix compare clean. **However, the `visual-web` workflow
conclusion is currently `failure`** because its Playwright project also bundles the
overlay-context integration specs, and one — `apps/visual-regression/tests/overlay-context.spec.ts:155`
"Web Escape CASE C: later root Popover behind the dialog cannot steal Escape" — fails on shard
3/3 with `expect(locator).toHaveCount(0)` observing `1` (the passive-effect menu does not dismiss
on Escape in that registration-order fixture). This is a **Browser-interaction-class** assertion,
not a visual regression. History shows the case is **flaky** (green/red interleaved across
2026-08-31, e.g. green run [33370309223](https://github.com/beobungbu/BeeUI/actions/runs/33370309223))
and has been **consistently red in the most recent window**. Honest classification: **Visual
evidence obtained (green); the `visual-web` gate is not green on the candidate** because of this
bundled flaky overlay-Escape interaction spec. This is an open follow-up for the owner/maintainer,
not a resolved gate — see Go/No-Go.

### §Expo iOS note — dimension 10 (`expo-consumer` · `ios-native`)

The Expo consumer's `bundle` job (dimension 9) is green — the clean-consumer Metro export and
typecheck from the packed tarballs pass. The `ios-native` compile job is red, but the failure is
a **runner-side toolchain setup error, not a BeeUI library regression**: the step aborts with
`Could not locate Gemfile` (Ruby Bundler, exit code 10) during CocoaPods setup, **before** any
BeeUI code is compiled. The equivalent iOS native compile of the Showcase and the bare RN 0.86.2
consumer passes in `ci.yml · ios-native` (dimension 4), and the iOS Simulator runtime smoke
passes in dimension 12 — so the frozen library surface does compile and run on iOS. This row is
flagged as **infra-blocked**; re-running the job on a correctly-provisioned macOS runner is the
remediation, tracked as an owner/maintainer follow-up.

### §Compat note — dimension 11 (`compat-rn-0-87`)

React Native `0.87.x` is **outside the frozen peer range** (`>=0.86.0 <0.87.0`) and is
**decided/excluded from the 1.0 peer promise on real evidence (#131)**
([docs/compatibility-matrix.md](compatibility-matrix.md)). This workflow is a deliberately
out-of-range **diagnostic** probe: it is opt-in (`workflow_dispatch` or the `ci:rn-0.87` PR
label), **not a required check anywhere**, installs with `--legacy-peer-deps` to bypass the
peer-range self-enforcement, and runs its Android leg with `continue-on-error: true`. Its
`failure` conclusion is the **expected, documented outcome** (the root cause is upstream —
`react-native-safe-area-context@5.7.0` does not build against RN 0.87's native surface — not a
BeeUI defect). It does **not** gate the candidate. Cited run
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

- **Green on the candidate:** change classification; full workspace verify (deterministic +
  token + registry/CLI + `release:verify` + Web/Android/iOS bundles + clean consumers + perf
  budgets); bare Android native compile; required iOS native compile; the deterministic Web
  visual screenshot matrix; visual report; automated Web a11y (exact candidate SHA); independent
  Web consumer (exact candidate SHA); clean Expo SDK 57 consumer bundle; native runtime smoke on
  iOS Simulator + Android Emulator.
- **Not green — open follow-ups (not silent):**
  1. `visual-web` workflow — flaky bundled overlay-Escape interaction spec
     (`overlay-context.spec.ts:155` CASE C); the visual matrix itself is green.
  2. `expo-consumer · ios-native` — runner Bundler/`Gemfile` infra failure, not a library
     regression (iOS compile + runtime proven green elsewhere).
- **Diagnostic / excluded (does not gate):** `compat-rn-0-87` (RN 0.87 excluded per #131).
- **Unmet evidence classes (owner-gated):** physical-device native runtime (#248) and
  VoiceOver/TalkBack AT (#249) — `OWNER_ACTION_REQUIRED`.

Because #247's DoD is "all **applicable automated** gates green on one exact candidate," the two
open follow-ups above are the items standing between this record and an unqualified all-green
automated result; both are itemized here rather than papered over. The summary for
[#114](https://github.com/beobungbu/BeeUI/issues/114) should carry these two items and the two
owner-gated classes forward.

## Cross-references

- RC candidate declaration + checksums: [docs/rc-candidate.md](rc-candidate.md) (#246)
- Security / release-readiness audit (same SHA): [docs/rc-security-readiness-audit.md](rc-security-readiness-audit.md) (#251)
- Evidence classes: [docs/beeui-1.0-evidence-classes.md](beeui-1.0-evidence-classes.md)
- Compatibility matrix (RN 0.87 exclusion): [docs/compatibility-matrix.md](compatibility-matrix.md)
- Web a11y acceptance: [docs/rc-web-a11y-acceptance.md](rc-web-a11y-acceptance.md) (#250)
- Native runtime smoke contract: [docs/native-runtime-smoke.md](native-runtime-smoke.md)
