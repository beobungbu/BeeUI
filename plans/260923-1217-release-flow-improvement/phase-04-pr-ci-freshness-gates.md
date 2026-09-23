# Phase 04 — PR CI proves generated-surface freshness before merge

**Context:** CI-scope/literal audit and the post-merge freshness blind spot.
**Independent of:** Phases 01–03.
**Size:** M.

## Goal

Move deterministic freshness failures into PR CI without returning BeeUI to 30+ minute waits on ordinary source PRs. Expensive root composite validation is reserved for release-preparation/control-plane changes.

## Requirements

### 1. Fast docs freshness lane

Extend `verify-docs` with deterministic, comparatively fast checks required to detect stale committed output, including:

- `docs:portal-pages:check`;
- `docs:reference:check`;
- `docs:surface:check`;
- `docs:surface:diff`;
- `docs:social-card:check`;
- `portal-shell:test` where its measured cost fits the lane budget.

Target wall time for the fast docs lane: **under 10 minutes**.

### 2. Deep docs lane

Keep slower behavior/quality suites such as portal page test matrices, accessibility/search/budget/vitals in `verify-docs-deep` or their existing dedicated workflows. Scope them to changes that can affect those dimensions; do not duplicate them unconditionally in both fast and composite lanes.

If a slow check remains post-merge, document that explicitly as a backstop rather than implying every docs dimension is pre-merge.

### 3. Correct docs scope

Update `scripts/ci-scope.mjs` so `docs-required` includes the actual generator inputs discovered by the audit: UI source, registry, showcase patterns/fixtures and the scripts that produce/check committed public surfaces. Add table-driven tests from changed path → expected scope.

### 4. Dedicated release-prep composite scope

Introduce a separate classifier output such as `release-prep-required`.

It becomes true for changes that can invalidate the release preparation/control plane, for example:

- lockstep/root release manifests;
- `CHANGELOG.md`;
- `.changeset/**`;
- release policy/evidence schema files;
- release preparation/version scripts;
- npm release / Version Packages / tag workflows.

Only this scope (plus an explicit manual CI escape hatch if desired) runs the literal root:

`pnpm typecheck && pnpm test`

Do **not** attach the ~26–35 minute composite to every generic `full-ci` source change.

The existing `verify` fan-in remains the branch-protection surface; it waits for whichever scoped jobs are required.

### 5. Self-verification

A CI change must prove it can fail. Use one of:

- a deliberately stale throwaway PR that changes a generator input without regenerating and separately corrupts an acknowledged surface hash; or
- deterministic workflow/fixture tests that exercise the same changed-path and stale-output behavior, plus one real failure run before merge.

Record failure-run URLs/evidence in the phase report and close the throwaway PR without merge.

## Files

Modify `.github/workflows/ci.yml`, `scripts/ci-scope.mjs`, classifier tests, release-ruleset docs/checks and any docs that enumerate lanes.

## Steps

1. Add/adjust path classifier tests first.
2. Add the fast freshness checks and measure actual wall time.
3. Add `release-prep-required` and the scoped composite job.
4. Confirm:
   - docs/source generator-input PR → freshness lane runs;
   - ordinary source-only PR → no root composite;
   - manifest/changeset/release workflow PR → root composite runs.
5. Update ruleset documentation/contracts.
6. Run the negative proof.

## Validation

- Stale generated pages/public-surface ownership fail before merge.
- `pnpm ci-contract:test` passes.
- Phase report records before/after CI wall time for at least docs-only, source-only and release-prep PR shapes.
- No ordinary source-only PR gains the root ~30-minute composite solely because `full-ci` is true.
- The aggregate required `verify` job fails if a scoped required lane fails.

## Risks / rollback

The main risk is CI cost and duplicated work. Prefer deterministic freshness checks in the fast lane and reuse existing dedicated jobs for expensive quality/runtime dimensions. Roll back workflow wiring independently from classifier tests if necessary.
