# Phase 01 — single source of workspace version truth

**Context:** version-truth data-flow report and owner decisions D1/D2.
**Size:** M. Contract change across release-policy scripts and tests. Lands after rc.2 publication/integration is complete.

## Target

`packages/ui/package.json` is the only authored current lockstep version.

- `sync-root-version.mjs` remains the propagation tool for followers that Changesets does not own directly.
- `docs/dist-tag-policy.md` keeps policy only: `candidateStableVersion`, dist-tag names, lockstep package names and release environment. Remove authored `currentVersion`, `prereleaseExample` and the authored prerelease-regex copy.
- Derive the prerelease shape from the manifest/stable-line policy in one library function.
- `.github/workflows/npm-release.yml` requires `expected_version` with no hard-coded default; preflight asserts the dispatch value equals the checked-out manifest.
- `docs/consumer-compatibility-report.md` drops its own current candidate version and publication boolean. Phase 02 replaces publication claims with observed data.
- Public-surface ownership hashing ignores **only** the derived top-level `version` field for lockstep manifests. Dependency protocols/ranges and every other semantic field remain part of the hash.

## Files

Modify the release/public-site contract library; release-control-plane, distribution-policy, public-doc-truth and public-surface ownership checks; docs-foundation generator; sync-root-version; policy/compatibility docs; npm release workflow; relevant tests.

Create `scripts/release/prepare-candidate.mjs` and a `release:prepare` package script.

## Steps

1. Change the shared library first:
   - current version reads `packages/ui/package.json`;
   - add one derived prerelease-pattern helper;
   - during the migration PR, reject authored legacy current-version fields with an actionable error once all callers have moved.
2. Update release-control-plane assertions:
   - all lockstep/follower manifests equal the UI manifest where required;
   - the version is either the stable candidate or a valid RC for the stable line;
   - `npm-release.yml` dispatch input has no default;
   - workflow guards use the shared/derived rule rather than a second hard-coded current-version pin.
3. Update distribution/public-doc checks and tests to stop reading the removed live pin.
4. Change public-surface ownership hashing:
   - parse lockstep manifests;
   - delete only the top-level `version` property before canonical serialization/hash;
   - do **not** normalize `dependencies`, `peerDependencies`, `workspace:^`, `workspace:*`, export maps or other semantics.
5. Add `pnpm release:prepare <version>`:
   - validate requested version against the release line;
   - set the UI manifest;
   - run version propagation;
   - regenerate canonical generated surfaces;
   - run a literal audit/report;
   - never silently edit prose.
6. Dry-run on a scratch branch using `0.86.2-rc.9`, then revert.

## Validation

- Existing tests plus new tests for missing workflow default, invalid derived RC shape and legacy policy fields.
- Ownership-hash regression:
  - changing only `version` does **not** require a manual surface acknowledgement;
  - changing `workspace:^` to `workspace:*` **does** fail the ownership gate until reviewed/acknowledged.
- `pnpm typecheck && pnpm test` green.
- Dry-run diff contains only expected manifests/generated surfaces plus the remaining prose hits that Phase 02 removes.
- Deliberately desync one lockstep manifest and prove PR CI rejects it.
- Re-run the legacy-symbol inventory immediately before merge and attach the machine-generated result to the phase report; the implementation is not complete while any live consumer still reads the removed pin/publication fields.

## Migration inventory / risks / rollback

A missed consumer of `policy.currentVersion` can break at runtime. At baseline `8c63c9d`, a direct-symbol inventory for `currentVersion` / `readPublicationState` / `extractPublicationPolicy` / `extractDistTagPolicy` found these 17 non-test files: `apps/docs/src/lib/foundation-contract.ts`, `scripts/check-ai-agent-contract.mjs`, `scripts/check-distribution-policy.mjs`, `scripts/check-public-doc-truth.mjs`, `scripts/check-public-site-contract.mjs`, `scripts/check-release-control-plane.mjs`, `scripts/check-token-removals.mjs`, `scripts/generate-component-reference.mjs`, `scripts/generate-docs-foundation.mjs`, `scripts/generate-llms-txt.mjs`, `scripts/generate-public-surface-inventory.mjs`, `scripts/public-component-reference.mjs`, `scripts/public-pattern-reference.mjs`, `scripts/public-site-contract-lib.mjs`, `scripts/public-web-checks/discovery.mjs`, `scripts/public-web-checks/guides.mjs`, `scripts/token-lifecycle.mjs`; plus nine test files under `scripts/__tests__/`.

Treat that as the **direct legacy-symbol migration inventory, not an exhaustive Phase 01 touched-file list**. Phase 01 also explicitly owns callers and surfaces that may not contain those exact symbols, including `scripts/sync-root-version.mjs`, `.github/workflows/npm-release.yml`, `docs/dist-tag-policy.md`, `docs/consumer-compatibility-report.md`, generated-surface ownership metadata, and any transitive consumer whose assertions change because an imported release-control-plane value changes (for example `verify-release.mjs`). Re-run grep/search after the refactor instead of assuming the baseline count stays complete.

Rollback is a revert; there is no data migration.
