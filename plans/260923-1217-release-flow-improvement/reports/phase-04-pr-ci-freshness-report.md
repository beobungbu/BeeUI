# Phase 04 — PR CI freshness gates implementation report

Date: 2026-09-23
Plan: `phase-04-pr-ci-freshness-gates.md`
Implementation PR: #626

## Scope implemented

- Extended `scripts/ci-scope.mjs` so real generated-doc inputs route to `verify-docs` before merge.
- Added `releasePrep` as a dedicated scope for manifests, changesets, release policy/evidence, release/version scripts, and release workflows.
- Added `verify-release-prep` and isolated the literal `pnpm typecheck && pnpm test` root composite to that scope (or explicit `ci:full`).
- Kept the stable required `verify` fan-in; a selected scoped lane failure still makes `verify` fail.
- Added classifier contract cases for generated-doc inputs and release-prep boundaries.
- Added deterministic committed-output checks to `verify-docs`: portal pages, reference hub, public-surface ownership/diff, social-card asset freshness, and portal-shell tests.
- Updated `docs/release-ruleset.md` and its checker/test contract so `verify-release-prep` is an explicitly conditional lane and is not incorrectly promoted to a branch-protection-required status.

## Social-card split

`docs:social-card:check` validates **built HTML** and intentionally fails when `apps/docs/dist` does not exist. A direct attempt to run it in the source-only `verify-docs` lane failed on PR #626 run `35854774701` with `apps/docs/dist has no built pages` after the rest of the source freshness checks had passed.

Therefore the fast PR freshness lane runs `docs:social-card:asset-check`, which validates the committed 1200×630 asset without requiring a portal build. The complete built-page social-card contract remains part of `apps/docs`'s canonical `build` script together with docs accessibility, page-budget and search-intent checks. This is the explicit slow/built-output backstop permitted by the Phase 04 plan rather than pretending the fast source lane owns a build artifact it does not produce.

## Negative proof

### Proof A — ownership acknowledgement drift

Throwaway PR #627 intentionally corrupted one `docs/public-surface-owners.json` acknowledgement.

Observed on CI run `35853937006`:

- `classify`: PASS
- `verify-fast`: FAIL
- failure: existing `release-control-plane:check` / public-surface ownership gate reported the deliberately stale blob acknowledgement
- aggregate `verify`: FAIL

Disposition: PR #627 closed without merge. This proved the existing control-plane guard already blocks acknowledgement drift, but by itself did not prove the newly routed docs-generator path.

### Proof B — generated page drift

A second throwaway proof is created from the final Phase 04 implementation branch and changes only a generated CLI reference page without regenerating it. Acceptance requires:

- `verify-fast`: PASS
- `verify-docs`: FAIL on reference freshness
- aggregate `verify`: FAIL
- proof PR closed without merge

The final run/PR IDs are appended below before #626 merges.

## Timing / coverage evidence

### Before Phase 04

The read-only baseline audit (`scout-version-literal-inventory-and-ci-scope-report.md`) found these deterministic gates absent from PR CI: portal-page freshness, reference freshness, full public-surface ownership/diff, social-card checks and portal-shell tests. They therefore had **no honest PR-lane wall time to report**; failures could first appear in later/full validation. The same audit records the literal root `pnpm typecheck` chain at about 26 minutes before `pnpm test` is added, which is why the plan explicitly forbids attaching the root composite to generic source PRs.

### Phase 04 observed

PR #626 run `35854774701` demonstrated:

- `verify-release-prep` ran the full root composite and PASSed independently.
- `verify-docs` reached all newly added portal/reference/surface checks successfully.
- The source docs lane reached the built-output social-card check at about 9 minutes after job start; that check then failed only because no docs build exists in that lane. The built-output check was removed from the fast lane and retained in the canonical docs build backstop, keeping the fast-lane target realistic.

A final green #626 run supplies the final Phase 04 timing evidence after the correction.

## Security / permission boundary

No workflow permission was expanded. PR verification remains `contents: read`; no npm/release credential or `id-token: write` permission was introduced into Phase 04 CI.

## Status

Implementation complete pending final green #626 CI and Proof B evidence. Do not merge #626 until both are recorded.
