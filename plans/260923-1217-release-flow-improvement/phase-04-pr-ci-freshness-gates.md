# Phase 04 — PR CI proves generated-surface freshness and the composite chains before merge

**Context:** `reports/scout-version-literal-inventory-and-ci-scope-report.md` §3, §4; `reports/scout-release-pipeline-and-process-docs-report.md` §1 (gate diff), §7 item 5; memory note `beeui-portal-pages-gate-post-merge-only`. Independent of Phases 01–03; do it early so later phases self-prove.
**Size:** M. Workflow + scope classifier + ruleset doc; measured wall-time budget.

## Requirements

1. `verify-docs` (ci.yml) additionally runs `docs:portal-pages:check` (53 s), `docs:reference:check`, `docs:surface:check`, `docs:surface:diff`, `docs:social-card:check`, `portal-shell:test`. `docs:portal-pages:test` (6.5 min) and `docs:{a11y,search,budget,vitals}:*` go into a new `verify-docs-deep` job gated on the same scopes, so the fast docs lane stays under 10 min.
2. `scripts/ci-scope.mjs`: `docs-required` becomes true for `packages/ui/src/`, `registry/`, `apps/showcase/`, `scripts/public-component-reference.mjs`, `scripts/public-component-previews.mjs`, `scripts/public-pattern-reference.mjs`, `scripts/public-reference.mjs`, `scripts/check-portal-pages-fresh.mjs`, `scripts/generate-llms-txt.mjs`, `scripts/generate-docs-foundation.mjs` (extend `DOC_SCRIPT_RE`). Rationale: these are the inputs of the generated docs surfaces.
3. A `verify-composite` job runs the literal root `pnpm typecheck && pnpm test` on PRs when `full-ci` is true or when any manifest / `CHANGELOG.md` / `.changeset/` / `docs/dist-tag-policy.md` changed (release-prep PRs). Budget: ~26–35 min measured; runs in parallel with the lanes, is a required check only via the existing `verify` fan-in.
4. `docs/release-ruleset.md` and `scripts/check-release-ruleset.mjs` document the new jobs; `docs/release-ruleset.md:11` no longer claims full decomposition.
5. Per the self-verification lesson: this PR is proven by a second PR that deliberately commits a stale component page and a stale `docs/public-surface-owners.json`; both must fail `verify-docs` before merge. Record both run URLs in the phase report.

## Files

Modify: `.github/workflows/ci.yml`, `scripts/ci-scope.mjs` + `scripts/__tests__/ci-scope.test.mjs`, `docs/release-ruleset.md`, `scripts/check-release-ruleset.mjs` + test, `docs/beeui-web-deployment.md` if it lists lanes.

## Steps

1. Scope classifier change with tests (paths → `docs-required`).
2. `verify-docs` additions; measure the job wall time on the PR; split into `verify-docs-deep` if over 10 min.
3. `verify-composite` job with the trigger rule above; confirm on a manifest-touching PR that it runs and on a source-only PR that it does not.
4. Ruleset doc + check update.
5. Second PR with deliberate staleness; both failures observed; close without merge.

## Validation

- Both deliberate-failure PRs red on `verify-docs`; the phase PR itself green.
- `pnpm ci-contract:test` green (ci-scope tests).
- CI minutes: report before/after for a docs-only PR, a source-only PR, and a release-prep PR.

## Risks / rollback

CI cost: `verify-composite` adds ~30 min to release-prep PRs only. If `docs:portal-pages:test` is too slow for PRs, keep it post-merge and note that the floor ratchets remain a post-merge signal. Rollback: revert the workflow; classifier change is harmless on its own.
