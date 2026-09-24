# Phase 05 — reproducible evidence, one release runbook and governance

**Context:** pipeline/process audit and owner decisions D6/D7.
**Depends on:** Phases 01–04.
**Size:** S/M.

## Core correction

Release evidence must not require a commit to contain its own SHA.

The frozen candidate source commit, later evidence commit, `development` integration commit, `main` promotion commit/tag target and publication workflow SHA are distinct objects. The release invariant is **artifact identity plus explicit provenance**, not `candidateSourceSha === GITHUB_SHA`.

## Machine-readable release ledger

Create a machine-readable evidence file (for example `docs/release-evidence/<version>.json`) with fields such as:

- `version`;
- `candidateSourceSha`;
- candidate verification timestamp/tool versions;
- canonical per-package tarball name, bytes and SHA-256;
- optional canonical package manifest digest/content fingerprint;
- `integrationSha` once known;
- `mainPromotionSha` once known;
- `repositoryTag` and `tagTargetSha`;
- publication workflow run id / publication SHA once known;
- post-publish npm integrity/shasum values;
- registry-observation reference/timestamp.

Fields may be filled in over the lifecycle, but once a provenance/digest field is recorded it may not be silently rewritten. Corrections are explicit amendments with reason/history.

`docs/rc-candidate.md` becomes a generated/human-readable projection of this ledger between markers rather than the primary machine authority.

## Candidate evidence generation

Add `pnpm release:evidence` / `scripts/release/write-candidate-evidence.mjs`:

1. read `.artifacts/release-verification.json`;
2. record `candidateSourceSha = git rev-parse HEAD` **for the candidate being verified**;
3. record canonical tarball digests and tool/runtime metadata;
4. optionally import exact-head PR/CI evidence through an explicit API/`gh` integration;
5. write/update the version ledger and generated candidate section.

Committing that evidence creates a later commit SHA. That is expected and must not invalidate the candidate.

## Release preflight invariant

On `main`, `npm-release.yml`:

1. reads the evidence ledger for the requested version;
2. checks the requested version equals the checked-out manifest;
3. verifies the repository release tag exists/targets the expected `main` release commit when the tag is part of the current flow;
4. runs the canonical `pnpm release:verify` / artifact build at `GITHUB_SHA`;
5. compares every resulting canonical package artifact digest to the frozen candidate evidence;
6. fails on any package/digest mismatch before registry mutation.

It must **not** assert `candidateSourceSha === GITHUB_SHA`.

This directly proves that evidence-only/integration/promotion commits did not alter the publishable package artifacts.

## Post-publication evidence

After staged publication completes:

1. dispatch `registry:observe`;
2. record the publication workflow run/SHA and npm provenance/integrity facts;
3. link the committed registry observation;
4. render the updated release ledger into the candidate/release docs.

Do not infer the publish commit from npm integrity alone; use workflow/provenance evidence for the source/run association.

## One release runbook

Create `docs/release-runbook.md` as the canonical ordered flow:

1. prepare/version candidate;
2. verify and generate frozen candidate evidence;
3. merge to `development`;
4. promote/sync release content to `main`;
5. create/verify `v<version>` tag on the main release commit;
6. owner dispatches/approves `stage-rc`;
7. npm 2FA/release environment completes publication;
8. dispatch registry observation;
9. append publication/provenance facts to the release ledger;
10. confirm public rendered release state.

Old release/bootstrap/change-set docs keep a pointer for at least one release cycle before deletion/archive.

## Governance/docs

- `CONTRIBUTING.md`: post-publication state, GNU tar local requirement, review convention/ruleset reality, changeset policy for the active line.
- `docs/release-ruleset.md`: record D6 accurately.
- package READMEs: no exact live RC literal; use `@next` + CHANGELOG/release-state link.
- archive superseded candidate/CI docs with an index.
- agent execution contract: agents may prepare/verify/generate evidence but never approve the protected release environment or satisfy owner 2FA.

## Files

Create:

- release evidence writer + tests;
- per-version machine-readable evidence ledger path/schema;
- `docs/release-runbook.md`;
- archive index.

Modify release workflow preflight, candidate docs, contributing/release/ruleset/rollback docs, package READMEs and relevant contract tests.

## Validation

- Generating evidence at candidate SHA A and committing it at SHA B is a normal passing case.
- Promotion to SHA C passes preflight **only if** canonical artifact digests equal the candidate ledger.
- Deliberately modify one packed file/manifest after candidate freeze: preflight at promotion SHA must fail digest comparison.
- Tag target is checked separately from candidate source SHA.
- Registry observation/publication provenance can be appended without pretending those later commits are the frozen candidate.
- Package README current RC literals are absent.
- Full `pnpm typecheck && pnpm test` passes.

## Risks / rollback

Digest comparison must use the same canonical deterministic packaging path on candidate and promotion commits. If that path itself changes, the candidate is invalid and must be re-frozen; do not bypass the mismatch. Runbook consolidation can drop a rule, so old docs remain as pointers for one release cycle.
