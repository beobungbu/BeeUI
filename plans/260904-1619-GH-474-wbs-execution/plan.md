# WBS #474 — autonomous execution plan

Status: IN_PROGRESS
Authority: #474 (control plane), #454 (scope), #473 (coverage), #472 (deep links), #254 (publication)
Branch topology: `feat/*` -> `development` -> `staging` -> `main` (PR only, no direct pushes)

## Resolved truth (2026-09-04)

- `DEVELOPMENT_BASE_SHA` = `8226cd505d1a3787a0ac8d2f233fa0e39a357205`
- `origin/main` = `12a0306`, `origin/staging` behind (PR #469 open: staging -> main)
- Baseline `pnpm typecheck` on the base: PASS (verified locally)
- Public-surface gate: PASS — 683 rows, **20 published / 663 planned**, 67 owner routes, 1 published page

## Completed before this session

- A001, A002 — DONE
- B010/B011 #455 — INTEGRATED (PR #475)
- C020 #473 — INTEGRATED (PR #476)
- C021 #472 — INTEGRATED (PR #477)
- C022 — integration checkpoint reached; `POST_CONTRACT_BASE_SHA` never recorded on the issue

## Central finding driving this plan

Gate C1 passes on a **routing** contract: every public surface has a ratified owner route, but 663 of
683 rows point at pages that do not exist yet. Publishing those 66 owner pages *is* the D/E content
wave. Coverage is therefore mechanical and measurable, not a matter of opinion:

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
2. **Task-oriented Table and Calendar/Date-time docs move to `/docs/guides/`** (they are D031
   deliverables), which frees `/docs/components/` to be fully generator-owned.
3. **Reference pages are generated too** — tokens/core/CLI/registry are derived from the same
   canonical sources the inventory reads, so the coverage gate and the page cannot drift.
4. **Serialized children.** Shared files (`web/public-site.config.json`, `apps/docs/astro.config.mjs`,
   `docs/public-surface-owners.json`) are touched by most lanes, so #474's own escape hatch applies:
   "if both touch shared generator/schema files, serialize them". Each child branches from the then-current
   `origin/development`, PRs into it, and merges before the next child starts.

## Rule-12 enforceability fix (PR-0)

`ci.yml` and `expo-consumer.yml` only trigger on `pull_request` (+ `push: main`). Every integration
checkpoint (B011/C022/D034/E044/F052) is a merge commit on `development`, so the aggregate `verify`
job has never run on an integrated head. #479 already added `development`/`staging` push triggers to
`visual-web`, `web-a11y`, `web-consumer` and `beeui-environment-ci`; PR-0 closes the remaining two.

## Lane sequence

| # | WBS | Issue | Owner surfaces |
| --- | --- | --- | --- |
| PR-0 | control plane | #474 | `.github/workflows/{ci,expo-consumer}.yml` |
| 1 | D030 | #457 | `/docs/start/**` + redirects from `/docs/getting-started/**` |
| 2 | D031 | #458 | `/docs/guides/**` (incl. table, date-time moved from components) |
| 3 | D032 | #462 | `/docs/learn/**` |
| 4 | D033 | #463 | `/docs/reference/**` + reference generators |
| 5 | D034 | — | integration checkpoint, record `POST_CORE_CONTENT_BASE_SHA` |
| 6 | E040 | #459 | `scripts/public-component-reference.mjs` -> `/docs/components/<slug>/` |
| 7 | E041 | #460 | `scripts/public-pattern-reference.mjs` -> `/docs/patterns/<slug>/` |
| 8 | E042 | #461 | `/examples/` directory + detail |
| 9 | E043 | #456 | landing + docs home |
| 10 | E044 | — | integration checkpoint, record `POST_CONTENT_SURFACES_BASE_SHA` |
| 11 | F050/F051/F052 | #464/#465 | `/demo/`, `/showcase/` portal shells |
| 12 | G060/G061 | #473 | closure audit + adversarial readability review |
| 13 | H070–H076 | #466 | search/SEO/a11y/perf/release-truth/score/exact-head RC |
| 14 | H077 | — | **OWNER_ACTION_REQUIRED** — production cutover is not agent-authorized |

## Stop conditions honored

H077 (production cutover) and #254 (npm publication) are owner gates. This run stops at a verified,
integrated `development` head plus a GO/HOLD report; it does not open `development -> staging` or
`staging -> main` promotion PRs without owner approval.
