# Phase 01 — single source of version truth

**Context:** `reports/scout-version-truth-data-flow-report.md` §1 #1–#5, §2, §5, §6 items 1, 3, 4; owner decisions D1, D2.
**Size:** M. Contract change in five scripts and their tests. Lands after rc.2 publishes.

## Target

`packages/ui/package.json` is the only authored version. Everything else is derived or checked against it:

- `sync-root-version.mjs` remains the propagation tool for the three followers and two Expo identities (Changesets cannot reach them).
- `docs/dist-tag-policy.md` JSON block keeps only *policy*: `candidateStableVersion`, `distTags`, `prereleaseDistTag`, `stableDistTag`, `stablePromotionTag`, `lockstepPackages`, `releaseEnvironment`. `currentVersion` and `prereleaseExample` are removed; `prereleaseVersionPattern` is derived as `^${escape(candidateStableVersion)}-rc\.(0|[1-9][0-9]*)$` by the library, not typed.
- `.github/workflows/npm-release.yml` `expected_version` input has no default (required); preflight already asserts it equals `package.json`. The verbatim-copy assertion in `check-release-control-plane.mjs:65-100` is replaced by "input has no default and the regex in the workflow equals the derived pattern".
- `docs/consumer-compatibility-report.md` drops `candidateVersion` (derived) and its own `published` (Phase 02 owns published state); the prose sentence "candidate version `X` today" becomes generated text or is removed from `VERSION_SENTENCES`.
- `docs:surface` acknowledged blobs for `packages/{ui,tokens,core}/package.json` hash the manifest with `version` stripped (and `dependencies` on workspace packages normalised), so a bump never requires `docs:surface:acknowledge`.

## Files

Modify: `scripts/public-site-contract-lib.mjs` (`readPublicationState`, `readPinnedVersion` → read manifest), `scripts/check-release-control-plane.mjs` (EXPECTED_VERSION from manifest; lockstep + shape assertions; workflow assertions), `scripts/check-distribution-policy.mjs` (remove currentVersion/prereleaseExample expectations; derive pattern; drop candidateVersion check), `scripts/check-public-doc-truth.mjs` (`VERSION_SENTENCES`: keep README + ADR-015 for now, remove compat-report sentence), `scripts/check-public-surface-ownership.mjs` + `docs/public-surface-owners.json` (version-stripped hashing; one-time re-acknowledge), `scripts/generate-docs-foundation.mjs` (currentVersion from manifest; keep workspaceVersion; remove the 362-364 equality assertion only in Phase 02), `scripts/sync-root-version.mjs` (drop the "now hand-edit the policy" hint), `docs/dist-tag-policy.md`, `docs/consumer-compatibility-report.md`, `.github/workflows/npm-release.yml`, `.changeset/README.md`, tests: `scripts/__tests__/{release-control-plane,check-distribution-policy,public-doc-truth,public-site-contract,generate-llms-txt,check-public-surface-diff}.test.mjs`.

## Steps

1. Library first: `readPinnedVersion` reads `packages/ui/package.json`; add `derivePrereleasePattern(policy)`; keep old field names accepted for one release with a deprecation violation ("`currentVersion` is no longer authored; remove it") so the migration PR itself passes.
2. Update the four checks and their tests; the tautology concern in `check-release-control-plane.mjs:10-14` is answered by asserting (a) all five manifests + two app.json equal the ui manifest, (b) the value matches the derived pattern or equals `candidateStableVersion`, (c) the workflow regex equals the derived pattern and the input has no default.
3. Edit the two policy docs and the workflow input; re-acknowledge surface owners once.
4. Add `pnpm release:prepare <version>` (new `scripts/release/prepare-candidate.mjs`): sets the ui manifest version, runs `sync-root-version`, regenerates every generated surface (`docs:portal-pages`, `docs:reference`, `docs:contract`, `docs:foundation`, `llms`, `public-guide-data`), and prints the gate list. No prose edits: after Phase 02 there are none; until then it prints the remaining literal hits as a checklist.
5. Dry-run on a scratch branch: `pnpm release:prepare 0.86.2-rc.9 && pnpm typecheck && pnpm test`, then revert.

## Validation

- Unit tests for each modified check (existing fixtures + new "authored currentVersion present" violation).
- `pnpm typecheck && pnpm test` green.
- Dry-run diff contains only manifests + generated surfaces (+ remaining prose hits listed by the script, which Phase 02 removes).
- Second PR: deliberately desync `packages/core/package.json` and confirm `release-control-plane:check` fails on PR CI (verify-fast).

## Risks / rollback

Any consumer of `policy.currentVersion` missed by grep breaks at runtime: grep `currentVersion` across scripts/, web/, apps/docs/src before merging. Rollback is a revert; no data migration.
