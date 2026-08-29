# BeeUI 1.0 Compatibility Support Matrix

This document is the locked candidate compatibility support matrix for issue #129
(`[BeeUI 1.0][R2.1] Define the 1.0 compatibility support matrix`, parent #114).

It is the authority for R2.2–R2.10 (#130–#138): those issues narrow, prove, or
finalize the rows below. No row here may be widened by a docs-only change; a
range only widens when the linked proving issue lands additional tested
evidence and updates this file in the same change.

This document does not modify `package.json` peer ranges, `engines` fields, or
CI workflows. It records the ranges those files **already declare**, states
what is actually tested for each, and marks the gap between declared and
tested honestly. Peer-range/engines/workflow changes belong to #130–#135, not
to this issue.

## Rule (from issue #129)

> If a combination cannot be tested, narrow the public promise instead of
> documenting hope.

Evidence terms below (`deterministic`, `bundle/compile`, `native runtime`,
etc.) use the definitions in `docs/beeui-1.0-evidence-classes.md`. A row is
marked `TESTED` only when a currently-running gate or currently-installed
lockfile version exercises it. A row is marked `CANDIDATE` when it is declared
as an allowed range/intent but no gate or lockfile entry currently exercises
the full declared range. `CANDIDATE` is not a promise; it is an honestly
labeled gap the linked issue must close or the range must be narrowed to
match.

## How to read this matrix

- **Declared range** — the exact string currently present in
  `packages/ui/package.json` `peerDependencies`, root `package.json`
  `engines`, or the relevant CI workflow, as of base SHA
  `e19c66bb7db1a90929d4f709ccd5c37abb288216`.
- **Actual tested value** — the exact version resolved in `pnpm-lock.yaml`
  and exercised by `apps/showcase` / `apps/visual-regression`, or the exact
  value enforced by a CI assertion.
- **Evidence class** — the strongest evidence class in `docs/beeui-1.0-evidence-classes.md`
  currently obtained for that value.
- **Status** — `TESTED` (declared value matches an exercised value),
  `CANDIDATE` (declared range exceeds what is exercised), or `NO EVIDENCE`
  (declared/aspirational only, nothing in the repo exercises it today).
- **Proving issue** — which of #130–#135 closes the gap, and how.

## Matrix

| # | Row | Declared range (source) | Actual tested value | Evidence class | Status | Proving issue |
|---|-----|--------------------------|----------------------|-----------------|--------|----------------|
| 1 | React | `>=19.0.0` (`packages/ui/package.json` peer) | `19.2.3` (lockfile, all workspace apps) | Deterministic + bundle/compile (typecheck, Jest, Metro/Expo export, native compile) | CANDIDATE — floor tested, no upper cap declared or verified | #133 |
| 2 | React DOM (optional) | `>=19.0.0`, `peerDependenciesMeta.react-dom.optional: true` | `19.2.3` (lockfile, Web/visual-regression) | Deterministic + browser interaction (Playwright, `apps/visual-regression`) | CANDIDATE — same floor-only gap as React | #133 |
| 3 | React Native minimum (candidate 0.86) | Declared peer floor is `>=0.85.0` (`packages/ui/package.json`), **not** 0.86 | `0.86.2` is the only version in the lockfile; `0.85.x` is not installed or exercised anywhere in this repo | 0.86.2: bundle/compile (Metro, Android APK, iOS Simulator xcodebuild) + native runtime smoke (`docs/native-runtime-smoke.md`). 0.85.x: none. | 0.86.2 → TESTED. 0.85.0 (the currently declared floor) → **NO EVIDENCE** | #130 confirms the 0.86 row; #132 decides whether the declared floor stays at the untested 0.85 or is raised to the tested 0.86 |
| 4 | React Native current | Issue text proposes "0.87" as current; no manifest in this repo declares or resolves `0.87.x` anywhere | `0.86.2` (lockfile) is the actual current version across `packages/ui`, `apps/showcase`, `apps/visual-regression` | Same as row 3 (0.86.2) | Repo's actual "current" is `0.86.2`, not `0.87`. `0.87` is **NO EVIDENCE** in this repo today. | #131 — either upgrades and proves 0.87, or this row stays narrowed to 0.86.2 as current until it does |
| 5 | Expo SDK | `~57.0.0` (`apps/showcase/package.json`, `apps/visual-regression/package.json`) | `57.0.15` (lockfile) | Bundle/compile (Metro/Expo export, Android APK, iOS Simulator xcodebuild) + native runtime smoke | TESTED for `~57.0.0` as currently resolved | #130/#131 (exercised together with the RN version each proves) |
| 6 | Node — repo/release toolchain | `engines.node: "24.13.1"` (root `package.json`); CI workflows (`ci.yml`, `visual-web.yml`, `runtime-native.yml`) assert `node --version` equals exactly `v24.13.1` | `24.13.1` enforced exactly; note this worktree's ambient Node was `24.14.1` and required an explicit `engine-strict=false` override to install, confirming the declared value is an **exact pin**, not a `24.x` range | Deterministic (CI version assertion) | TESTED, but only for the exact patch `24.13.1` — do not read this as "any Node 24.x" | #134 — decide/document whether the pin stays exact or widens to a stated `24.x` range, and reconcile local dev drift (e.g. `24.14.1`) against the exact-pin CI gate |
| 7 | Node — CLI/consumer tooling (candidate 22 + 24) | Not declared anywhere: no `package.json`, workflow, or script in this repo references Node 22 in any form | None | None | **NO EVIDENCE** — this is a stated aspiration in issue #129's scope text with zero current proof | #134 must either add real Node 22 evidence (a CI job, a registry-CLI consumer test matrix entry) or this claim must be dropped from the public promise |
| 8 | Tailwind CSS | `>=4 <5` (`packages/ui/package.json` peer) | `4.3.3` resolved in `apps/showcase`/`apps/visual-regression`; lockfile also carries `4.3.2` as a nested/transitive resolution — neither app pins that lower patch directly | Bundle/compile (Metro/Expo export, Uniwind build) | CANDIDATE — only the `4.3.x` patch line actually exercised; `>=4 <5` is far wider than what has run | #135 |
| 9 | Uniwind | Declared peer is `>=1.10.1 <2` (`packages/ui/package.json`) | `1.10.1` exact (lockfile, `apps/showcase`/`apps/visual-regression` dependency pin) | Bundle/compile (Metro/Expo export uses Uniwind's Tailwind integration) | TESTED only at the exact floor `1.10.1`; everything above that up to `<2` is **CANDIDATE** | #135 — issue #129's own scope text calls this "tested range `<2`"; the repo only tests the single floor version today, so the public range must stay narrow until #135 proves more of it |
| 10 | react-native-safe-area-context | `>=5 <6` (`packages/ui/package.json` peer) | `5.7.0` exact (lockfile) | Bundle/compile + native runtime smoke (mounted in Showcase native builds) | TESTED at `5.7.0`; rest of the `v5` range is CANDIDATE | Exercised alongside whichever RN row runs the native Showcase — currently #130 |
| 11 | react-native-teleport | `>=1.1 <2` (`packages/ui/package.json` peer) | `1.1.13` exact (lockfile) | Bundle/compile + native runtime smoke | TESTED at `1.1.13`; rest of the `1.1.x`/pre-`2` range is CANDIDATE | Exercised alongside whichever RN row runs the native Showcase — currently #130 |

### Supporting, non-peer dependency (for context only)

`react-native-web@0.21.0` is pinned in `apps/showcase` and `apps/visual-regression`
to bundle `@beeui/ui` for Web. It is not declared as a `packages/ui` peer
dependency (consumers do not choose their own `react-native-web` version the
way they choose React/RN/Tailwind/Uniwind), so it is not a matrix row, but any
change to it changes the Web evidence behind rows 1, 2, 5, 8, and 9 and should
be called out in whichever of #130–#135 touches Web bundling.

## What "locked" means here

Locking this matrix means:

- No future PR may widen a `CANDIDATE` or `NO EVIDENCE` row's public claim
  (docs, package peer range, or CI matrix) without also landing the tested
  evidence for that wider range in the same change.
- `docs/roadmap.md` R2 and `docs/beeui-1.0-sequence.md`'s compatibility-core
  lane point here as the current-state reference for #130–#135; those issues
  update this file directly when they land new evidence, rather than creating
  a second competing compatibility document.
- This document does not itself change any `peerDependencies`, `engines`, or
  workflow file. Any package/CI change implied by narrowing a row (for
  example, raising the declared RN floor from `0.85.0` to `0.86.0`, or adding
  a real Node 22 CI job) is downstream work for #130–#135, tracked here only
  as "planning intent," per issue #129's scope discipline.

## Base evidence snapshot

Captured against base SHA `e19c66bb7db1a90929d4f709ccd5c37abb288216` by
reading `packages/ui/package.json`, `apps/showcase/package.json`,
`apps/visual-regression/package.json`, root `package.json`,
`.github/workflows/{ci,visual-web,runtime-native}.yml`, and the resolved
`pnpm-lock.yaml`. No package manifest, `engines` field, or workflow file was
modified to produce this document.
