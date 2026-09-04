# WBS #474 — autonomous execution plan

Status: IN_PROGRESS
Authority: #474 (control plane), #454 (scope), #473 (coverage), #472 (deep links), #254 (publication)
Branch topology: `feat/*` -> `development` -> `staging` -> `main` (PR only, no direct pushes)

## Resolved truth (2026-09-04)

- `DEVELOPMENT_BASE_SHA` = `8226cd505d1a3787a0ac8d2f233fa0e39a357205`
- `POST_455_BASE_SHA` = `a94b60658a771f9e88d892a710e60cf6e6f8e9c3` (B011)
- `POST_CONTRACT_BASE_SHA` = `eb44cf07f85ce1ed3765c1fb0c409114b7886aaf` (C022)
- Public-surface gate: PASS — 683 rows, **20 published / 663 planned**, 67 owner routes, 1 published page

## Completed before this session

A001, A002 DONE · B010/B011 #455 INTEGRATED (PR #475) · C020 #473 INTEGRATED (PR #476) ·
C021 #472 INTEGRATED (PR #477) · C022 reached but never recorded on the issue until this run.

## Central finding driving this plan

Gate C1 passes on a **routing** contract: every public surface has a ratified owner route, but 663 of
683 rows point at pages that do not exist. Publishing those 66 owner pages *is* the D/E content wave.
Coverage is mechanical, not a matter of opinion:

| Owner route family | rows | lane |
| --- | --- | --- |
| `/docs/components/<slug>/` (62 families) | 444 | E040 #459 |
| `/docs/reference/tokens/` | 155 | D033 #463 |
| `/docs/reference/core/` | 45 | D033 #463 |
| `/docs/reference/cli/` | 17 | D033 #463 |
| `/docs/reference/registry/`, `/docs/reference/styling/` | 2 | D033 #463 |
| already published (`/docs/components/table/`) | 20 | — |

## Key architectural decisions

1. **Component pages already have a canonical generator** (`scripts/public-component-reference.mjs`)
   emitting `/docs/components/reference/<slug>/`. E040 retargets it to the ratified owner route
   `/docs/components/<slug>/`. No hand-written second truth source; rule 8 preserved.
2. **Task-oriented Table and Calendar/Date-time docs move to `/docs/guides/`** (D031 deliverables),
   freeing `/docs/components/` to be fully generator-owned.
3. **Reference pages are generated too** — tokens/core/CLI/registry derive from the same canonical
   sources the inventory reads, so the coverage gate and the page cannot drift. No such generator
   exists yet; D033 must add them plus `sourceToPage` entries.
4. **Serialized children.** Shared files (`web/public-site.config.json`, `apps/docs/astro.config.mjs`,
   `docs/public-surface-owners.json`) are touched by most lanes, so #474's own escape hatch applies:
   "if both touch shared generator/schema files, serialize them". Each child branches from the
   then-current `origin/development`, PRs into it, and integrates before the next starts.

## Recorded, unfixed control-plane risks (owner decision: no CI changes in this run)

1. `pnpm release-ruleset:check` fails on `development@8226cd5` — #479 renamed the CI jobs
   (`verify-*`, `bare-consumer`, `android-native`, `ios-native`, `visual-web-full`) without
   repointing the pinned contract in `scripts/check-release-ruleset.mjs` or `docs/release-ruleset.md`.
   It does **not** turn PRs red, because #479 also dropped that check from every CI lane; it only
   breaks the local `pnpm typecheck` chain. Exact-head verification in this run therefore reports the
   individual checks in that chain and calls out this pre-existing failure rather than skipping it.
2. Rule 12 has no enforcing mechanism: `ci.yml` and `expo-consumer.yml` trigger only on
   `pull_request` plus a `main` push, so the required `verify` aggregate has never run on an
   integrated head. #479 did add `development`/`staging` push triggers to `visual-web`, `web-a11y`,
   `web-consumer` and `beeui-environment-ci`, so those four lanes do re-run on integrated heads.

PR #481 proposed fixing both and was closed at the owner's request; workflows are untouched.

## Owner decisions needed (blocking G060, not the D/E waves)

- `docs/dist-tag-policy.md`'s machine block says `candidateStableVersion: "1.0.0"` and
  `prereleaseVersionPattern: ^1\.0\.0-rc\.N$`, while its own prose (owner decision #407) mandates
  `20260902.0.0-rc.N`. The block is rendered into the generated release page as
  "Stable target: `1.0.0`" next to workspace version `20260902.0.0`. G060 requires zero release-state
  contradiction, and this one touches #254, so it is escalated rather than patched.

## Lane sequence

| # | WBS | Issue | Owner surfaces | Status |
| --- | --- | --- | --- | --- |
| 1 | D030 | #457 | `/docs/start/**` + redirect serving | REVIEW |
| 2 | D031 | #458 | `/docs/guides/**` (incl. table, date-time moved from components) | READY |
| 3 | D032 | #462 | `/docs/learn/**` | BLOCKED by 2 |
| 4 | D033 | #463 | `/docs/reference/**` + reference generators | BLOCKED by 3 |
| 5 | D034 | — | integration checkpoint, record `POST_CORE_CONTENT_BASE_SHA` | BLOCKED |
| 6 | E040 | #459 | `public-component-reference.mjs` -> `/docs/components/<slug>/` | BLOCKED |
| 7 | E041 | #460 | `public-pattern-reference.mjs` -> `/docs/patterns/<slug>/` | BLOCKED |
| 8 | E042 | #461 | `/examples/` directory + detail | BLOCKED |
| 9 | E043 | #456 | landing + docs home | BLOCKED |
| 10 | E044 | — | integration checkpoint, record `POST_CONTENT_SURFACES_BASE_SHA` | BLOCKED |
| 11 | F050/F051/F052 | #464/#465 | `/demo/`, `/showcase/` portal shells | BLOCKED |
| 12 | G060/G061 | #473 | closure audit + adversarial readability review | BLOCKED |
| 13 | H070–H076 | #466 | search/SEO/a11y/perf/release-truth/score/exact-head RC | BLOCKED |
| 14 | H077 | — | **OWNER_ACTION_REQUIRED** — production cutover is not agent-authorized | — |

## Verification procedure per lane

`pnpm typecheck` cannot run to completion (risk 1 above), so each lane runs the chain's checks
individually plus `pnpm docs:build`:

```
node ./scripts/check-repo-hygiene.mjs
node ./scripts/check-public-doc-truth.mjs
node ./scripts/check-public-site-contract.mjs
node ./scripts/generate-docs-foundation.mjs --check
node ./scripts/check-public-surface-ownership.mjs
node ./scripts/check-public-web.mjs
node ./scripts/check-doc-examples.mjs
node ./scripts/generate-llms-txt.mjs --check
pnpm docs:build
```

## Stop conditions honored

H077 (production cutover) and #254 (npm publication) are owner gates. This run stops at a verified,
integrated `development` head plus a GO/HOLD report; it does not open `development -> staging` or
`staging -> main` promotion PRs.
