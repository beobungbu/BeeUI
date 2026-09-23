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

### Proof B — generator-input freshness (canonical Phase 04 proof)

Throwaway PR #628 targeted `development` and changed a Showcase source fixture consumed by the public-doc generator without regenerating committed docs.

Observed on CI run `35854857269`:

- `classify`: PASS
- `verify-fast`: PASS
- `verify-docs`: **FAIL**
- exact freshness failure from `docs:portal-pages:check`: `Portal pages are stale. Run pnpm docs:portal-pages:generate.`
- stale generated pages reported: `calendar.md`, `form-message.md`, `label.md`, `metadata-row.md`, `use-bee-token.md`, `visually-hidden.md`
- aggregate `verify`: **FAIL**

Disposition: PR #628 closed without merge. This is the canonical self-verification evidence for Phase 04: a real generator-input change is routed into the docs freshness lane and blocks merge while the always-on fast policy lane remains green.

A redundant one-file generated-reference proof was also exercised in #632; it failed at `docs:reference:check` with `Reference hub pages are stale: cli`. It targeted the Phase 04 branch rather than `development`, so the PR also force-selected full CI; #628 is therefore the cleaner canonical proof. #632 was closed without merge.

## Timing / coverage evidence

### Before Phase 04

The read-only baseline audit (`scout-version-literal-inventory-and-ci-scope-report.md`) found these deterministic gates absent from PR CI: portal-page freshness, reference freshness, full public-surface ownership/diff, social-card checks and portal-shell tests. They therefore had **no honest PR-lane wall time to report**; failures could first appear in later/full validation. The same audit records the literal root `pnpm typecheck` chain at about 26 minutes before `pnpm test` is added, which is why the plan explicitly forbids attaching the root composite to generic source PRs.

### Phase 04 observed

PR #626 run `35854774701` demonstrated that `verify-release-prep` can run the full root composite independently while the docs lane exercises the new freshness checks. That run also exposed that built-page `docs:social-card:check` cannot live in a source-only lane, leading to the explicit split above.

Canonical negative proof #628 / run `35854857269` measured the source docs lane from job start at `11:32:36.897Z` to the intended stale-output failure at `11:41:50.165Z`: about **9m13s**. The lane reached the new `docs:portal-pages:check` after the existing Web checks and then rejected the stale generated output before merge. `verify-fast` remained green on that same PR.

The final clean #626 head is required to stay green before merge. Its run ID and final successful lane timing are recorded in the PR conversation/body rather than appended here afterward, so recording evidence does not itself create another implementation SHA and invalidate the CI identity.

### PR-shape behavior

- docs/generator-input PR: `verify-docs` runs freshness gates; negative proof #628 confirms it can fail and block `verify`.
- ordinary source-only PR: classifier contract asserts `releasePrep=false`, so the literal root composite is not selected merely because generic source/full scopes are active.
- release-prep/control-plane PR: `verify-release-prep` runs `pnpm typecheck && pnpm test` and participates in aggregate `verify`.

## Security / permission boundary

No workflow permission was expanded. PR verification remains `contents: read`; no npm/release credential or `id-token: write` permission was introduced into Phase 04 CI.

## Status

Implementation and negative-proof evidence are complete. #626 must be rebuilt to a clean single commit and its clean-head CI must be green before merge.
