# Phase 01 implementation report — single source of workspace version truth

Branch `release-flow/phase-01-single-version-source`, off `origin/development@4fe4933` (`0.86.2-rc.3`).
Commits: `bc063ccf` (main change), `e9294025` (release:prepare lockstep-manifest fix found by the
dry run), `1bc42660` (ci-scope lane exemption for the new unit test).

## Target achieved

`packages/ui/package.json` is now the only authored current lockstep version. `docs/dist-tag-policy.md`'s
`json dist-tag-policy` block carries policy only (`candidateStableVersion`, dist-tag names, lockstep
package names, release environment, `published`, `observedDistTags`); `currentVersion`,
`prereleaseExample` and `prereleaseVersionPattern` are derived, and re-authoring any of the three is
rejected with an actionable error. `docs/consumer-compatibility-report.md` no longer authors
`candidateVersion` for the same reason. The npm-release workflow's `expected_version` dispatch input
has no default; the preflight step asserts it equals the checked-out `packages/ui/package.json`
version. Public-surface ownership hashing for the three lockstep package manifests excludes only the
top-level `version` field. `pnpm release:prepare <version>` performs the whole bump mechanically.

## Files changed, by category

**Shared library**
- `scripts/public-site-contract-lib.mjs` — added `readCurrentVersion` (reads `packages/ui/package.json`),
  `derivePrereleasePattern`, `assertNoLegacyPolicyFields`, `LEGACY_POLICY_FIELDS`; `readPublicationState`
  now derives `currentVersion`/`prereleaseVersionPattern` instead of reading them from the policy block,
  and rejects the block if it still authors any of the three legacy fields.

**Checks**
- `scripts/check-release-control-plane.mjs` — `readPinnedVersion` unchanged in signature, now
  transparently sourced from `packages/ui/package.json` via the lib; removed the now-dead "packages
  agree, only the pin lags" branch (structurally unreachable once the pin *is* one of the lockstep
  manifests) and folded its remediation hint into the root-manifest violation message;
  `collectNpmReleaseWorkflowViolations` now rejects a hard-coded `expected_version` default (any
  value) instead of requiring one to match the pin, and requires `required: true`.
- `scripts/check-distribution-policy.mjs` — `collectDistTagPolicyViolations` derives the current
  version from measured `packageVersions` instead of `policy.currentVersion`, derives the prerelease
  pattern from `candidateStableVersion`, and rejects legacy fields; `collectCompatibilityReportViolations`
  rejects a re-authored `candidateVersion` instead of checking it for agreement.
- `scripts/check-public-doc-truth.mjs` — `extractPublicationPolicy` now derives `currentVersion`/
  `prereleaseVersionPattern` via the shared lib and rejects legacy fields (still fails closed to the
  unpublished fallback on missing/malformed JSON, matching prior behavior); updated the drift-violation
  message to name `packages/ui/package.json` as the source.
- `scripts/check-public-surface-ownership.mjs` — added `canonicalOwnershipContent` /
  `LOCKSTEP_MANIFEST_OWNERSHIP_PATHS`; `validateAcknowledgedSurfaceSources` and
  `acknowledgeSurfaceSources` hash the three lockstep manifests with the top-level `version` value
  erased first (regex substitution on the raw text — byte-identical otherwise, so every other field
  stays significant).
- `scripts/check-public-site-contract.mjs` — no code change; verified it now reads a correctly derived
  `publication.currentVersion` transparently through the updated lib.

**Generators**
- `scripts/public-guide-data.mjs` — `readPublicGuideData` now derives `distribution.currentVersion`/
  `prereleaseVersionPattern` via the shared lib and rejects legacy fields (fixes
  `scripts/public-web-checks/guides.mjs`, which reads `data.distribution.currentVersion`).
- `scripts/generate-docs-foundation.mjs`, `scripts/generate-llms-txt.mjs`,
  `scripts/generate-component-reference.mjs`, `scripts/public-component-reference.mjs`,
  `scripts/public-pattern-reference.mjs`, `scripts/generate-public-surface-inventory.mjs`,
  `scripts/public-web-checks/discovery.mjs` — no code change; each reads `currentVersion` through
  `readPublicationState`/`extractPublicationPolicy`, which now derive it correctly.

**New release tooling**
- `scripts/release/prepare-candidate.mjs` (new) — `pnpm release:prepare <version>`: validates the
  version against `candidateStableVersion`, sets all four lockstep manifests
  (`packages/{core,tokens,ui,cli}/package.json` — Changesets is not yet operating the release flow, so
  nothing else moves the three non-`ui` packages), runs `syncRootVersion` for the non-workspace
  followers, runs the eight canonical generators in the same order `apps/docs`'s `predev`/`prebuild`/
  `pretypecheck` plus the two root-level generators use, and reports (via `git grep`) every tracked line
  still naming the previous version — informational only, never auto-edited.
- `package.json` — added `release:prepare` and `release:prepare:test` scripts; wired the latter into
  the root `test` aggregate.

**CI/workflow**
- `.github/workflows/npm-release.yml` — removed `expected_version`'s hard-coded `default:`; preflight
  now reads the expected version from `packages/ui/package.json` instead of the root manifest.

**Docs**
- `docs/dist-tag-policy.md` — removed `currentVersion`/`prereleaseExample`/`prereleaseVersionPattern`
  from the JSON block; added a prose paragraph explaining the derivation and the rejection behavior.
- `docs/consumer-compatibility-report.md` — removed `candidateVersion` from the JSON block; updated the
  contract-description sentence.
- `docs/npm-release-bootstrap.md`, `docs/release-ruleset.md` — updated the manual bump procedure and
  the "expected_version equals workspace root version" sentences to describe the new mechanism
  (`pnpm release:prepare`, comparison against `packages/ui/package.json`, no workflow default).
- `apps/docs/src/content/docs/guides/troubleshooting.md` — updated one sentence naming the policy's
  removed `currentVersion` field.
- `docs/public-surface-owners.json` — regenerated `acknowledgedSourceBlobs` hashes for the three
  lockstep manifests using the new version-excluded canonicalization (values change; keys/scheme
  unchanged).

**Package READMEs (D7)**
- `packages/{core,tokens,ui,cli}/README.md` — the "Release candidate" sentence no longer hard-codes the
  current RC literal (it shipped inside the published tarball and went stale on the next bump); it now
  points at `CHANGELOG.md`. The `@next` install command lines are unchanged.

**Tests**
- Modified: `scripts/__tests__/check-distribution-policy.test.mjs`, `public-doc-truth.test.mjs`,
  `public-site-contract.test.mjs`, `public-surface-ownership.test.mjs`, `release-control-plane.test.mjs`,
  `ci-scope.test.mjs` (see "Deviations" below for why).
- New: `scripts/__tests__/release-prepare-candidate.test.mjs`.
- Verified unchanged and still green against the live repo (no fixture touched `currentVersion`/
  `candidateVersion`): `docs-foundation.test.mjs`, `generate-llms-txt.test.mjs`, `public-web.test.mjs`,
  `ai-agent-contract.test.mjs`, `public-surface-inventory.test.mjs`, `check-public-surface-diff.test.mjs`,
  `release-artifacts.test.mjs`.
- Confirmed unrelated (different `currentVersion` concept — token-lifecycle semver, not the release
  pin): `scripts/check-token-removals.mjs`, `scripts/token-lifecycle.mjs`,
  `scripts/__tests__/token-lifecycle.test.mjs`, `scripts/__tests__/token-removal-guard.test.mjs`.

## Consumer checklist (phase's 17-file migration inventory)

| File | Outcome |
|---|---|
| `apps/docs/src/lib/foundation-contract.ts` | unchanged — `ReleaseState` type already carries both `currentVersion`/`workspaceVersion` fields |
| `scripts/check-ai-agent-contract.mjs` | unchanged — reads `.published`/`.prereleaseDistTag` only |
| `scripts/check-distribution-policy.mjs` | modified |
| `scripts/check-public-doc-truth.mjs` | modified |
| `scripts/check-public-site-contract.mjs` | unchanged — transparent through the lib |
| `scripts/check-release-control-plane.mjs` | modified |
| `scripts/check-token-removals.mjs` | confirmed unrelated |
| `scripts/generate-component-reference.mjs` | unchanged — reads `extractPublicationPolicy` |
| `scripts/generate-docs-foundation.mjs` | unchanged — transparent through the lib |
| `scripts/generate-llms-txt.mjs` | unchanged — reads `extractPublicationPolicy` |
| `scripts/generate-public-surface-inventory.mjs` | unchanged — reads `.published` only |
| `scripts/public-component-reference.mjs` | unchanged — reads `extractPublicationPolicy` |
| `scripts/public-pattern-reference.mjs` | unchanged — reads `extractPublicationPolicy` |
| `scripts/public-site-contract-lib.mjs` | modified (the shared library) |
| `scripts/public-web-checks/discovery.mjs` | unchanged — reads `extractPublicationPolicy` |
| `scripts/public-web-checks/guides.mjs` | unchanged — fixed transitively via `public-guide-data.mjs` |
| `scripts/token-lifecycle.mjs` | confirmed unrelated |
| 9 `scripts/__tests__/*` baseline hits | see Tests section; 2 of the original grep hits were the unrelated token-lifecycle files |

Plus phase-owned callers/surfaces outside the 17-symbol grep (as the phase file anticipates):
`scripts/sync-root-version.mjs` (reused unmodified — `SOURCE_MANIFEST` was already
`packages/ui/package.json`), `.github/workflows/npm-release.yml` (modified), `docs/dist-tag-policy.md`
(modified), `docs/consumer-compatibility-report.md` (modified), `docs/public-surface-owners.json`
(modified — ownership metadata), `scripts/verify-release.mjs` (unmodified — verified correct
transitively via `pnpm release:verify`), `scripts/public-guide-data.mjs` (modified — transitive consumer).

**Re-run legacy-symbol inventory immediately before merge** (per the phase's validation requirement):

```
grep -rn "currentVersion\|readPublicationState\|extractPublicationPolicy\|extractDistTagPolicy\|prereleaseExample\|prereleaseVersionPattern" --include="*.mjs" --include="*.ts" --include="*.md" --include="*.yml" scripts apps .github docs
```

No hit reads `.currentVersion`/`.prereleaseExample`/`.prereleaseVersionPattern` directly off a raw
`JSON.parse` of the fenced policy block outside `public-site-contract-lib.mjs`, `check-public-doc-truth.mjs`
(its own derivation) and `public-guide-data.mjs` (its own derivation) — every other consumer reads the
already-derived projection.

## Owner-decision interpretation (D1, D2, D7)

- **D1** implemented as specified.
- **D2** implemented as specified: `canonicalOwnershipContent` erases only the top-level `version`
  value (regex substitution on raw text, not JSON re-serialization, so key order/formatting of every
  other field stays byte-significant); `workspace:^` → `workspace:*` still fails until
  `docs:surface:acknowledge` runs (covered by a new regression test).
- **D7** implemented as specified for the four package READMEs.
- **Deviation, documented per audit rule:** the phase file's Target section states
  "`docs/consumer-compatibility-report.md` drops its own current candidate version **and publication
  boolean**." I dropped `candidateVersion` but left `published` authored as-is. Rationale: the task's
  explicit owner-decision scope for this phase lists only D1, D2, D5, D7 as in-scope and says
  "D3/D4/D6 belong to later phases — do not implement them here"; D3 ("committed registry
  observation") is specifically the registry-observation/publication-state redesign, and
  `check-distribution-policy.mjs`'s `policy.published !== report.published` cross-check is
  load-bearing existing behavior with no Phase-02 replacement built yet. Removing `published` here
  without a replacement would either delete that check or fabricate Phase 02's observation-file design
  ahead of schedule, both out of scope. Left for Phase 02 as planned.

## Bug found and fixed by the dry run

`release:prepare` initially wrote only `packages/ui/package.json`, then ran `version:sync` (which only
propagates to the *non-workspace* followers: root, Worker, Expo identities). `packages/core`,
`packages/tokens` and `packages/cli` were left at the previous version — `release-control-plane:check`
failed immediately. Fixed in `e9294025` by writing all four lockstep manifests
(`scripts/release/prepare-candidate.mjs`'s `setLockstepManifestVersions`, reusing
`check-release-control-plane.mjs`'s `EXPECTED_PACKAGE_NAMES` as the canonical list) before running
`version:sync`. Covered by a new regression test
(`setLockstepManifestVersions moves all four lockstep package manifests together`).

## Dry run — `pnpm release:prepare 0.86.2-rc.9`

Run twice on top of commit `bc063ccf` (before, and after, the lockstep-manifest fix), each time reverted
with `git checkout -- .` (never committed). Second run (with the fix):

- `packages/{core,tokens,ui,cli}/package.json`, `package.json`, `web/worker/package.json`,
  `apps/demo/app.json`, `apps/showcase/app.json` → `0.86.2-rc.9`.
- 63 generated `apps/docs/src/content/docs/components/*.md`, `docs/component-reference.md`,
  4 `llms*.txt` regenerated and updated to the new candidate.
- **76 files changed total** — exactly the manifests plus the generated surfaces the phase's own
  literal-count table classifies as "generated" (Category (b), scout report §1). No hand-maintained
  prose file was edited.
- `pnpm release-control-plane:check` → pass (`lockstep 0.86.2-rc.9`).
- `pnpm dist-policy:check` → pass.
- `pnpm docs:surface:check` → pass, **without** running `docs:surface:acknowledge` — direct evidence
  D2 works: the version-only change to the three lockstep manifests did not trip the ownership gate.
- Literal audit reported ~40 tracked lines still naming `0.86.2-rc.3` (hand-maintained current-state
  prose across `docs/`, `apps/docs/src/content/docs/`, `examples/`, plus dated history in
  `docs/rc-candidate.md`/`plans/`/`CHANGELOG.md` — correctly left untouched since those are historical,
  not current-state). This matches the phase's acceptance line: "the diff is limited to manifests,
  CHANGELOG/changeset state and generated surfaces... plus the remaining prose hits that Phase 02
  removes" (Phase 02 was not implemented here).
- Reverted cleanly; `git status --short` empty before and after.

## Validation results

- `pnpm typecheck` — **pass** (includes `hygiene:check`, `docs:social-card:asset-check`,
  `docs:public-truth:check`, `site:contract:check`, `docs:foundation:check`, `docs:surface:check`,
  `docs:reference:check`, `docs:portal-pages:check`, `web:check`, `release-control-plane:check`,
  `lint`, `tokens:check`, `compat:check`, `ui-exports:check`, `release-ruleset:check`,
  `dist-policy:check`, `llms:check`, `ai-contract:check`, `docs:contract:check`, `docs:examples:check`,
  `docs:patterns:check`, `pnpm build`, per-package typecheck). Regenerated surfaces during the run
  produced **zero** diff against committed content (confirms freshness).
- `pnpm test` — **pass**, 2 full runs (one caught and fixed a `ci-scope.test.mjs` lane-classification
  gap for the new test file — see below).
- `pnpm release:verify` — **pass**: all four packages canonical + reproducible, clean-consumer install/
  version checks pass, CLI bin/help/list smoke passes, no Expo runtime pulled in.
- New tests added/verified per the validation requirement:
  - missing workflow default → `expected_version without required: true is rejected` +
    `a hard-coded dispatch default is rejected, whether or not it still equals the pin` (both directions).
  - invalid derived RC shape → `derivePrereleasePattern accepts the stable line's release candidates
    and rejects everything else` (rejects `-rc.01`, `-rc.007`, off-line versions, bare stable, trailing
    suffix) plus `rejects a version off the stable release line` in `prepare-candidate` tests.
  - legacy authored policy fields rejected with an actionable error →
    `an authored legacy version field in the policy block is rejected with an actionable error`
    (`public-site-contract.test.mjs`, `release-control-plane.test.mjs`) and
    `authoring a legacy version field is rejected with an actionable error`
    (`check-distribution-policy.test.mjs`) and `a re-authored candidateVersion is rejected`.
  - ownership-hash regression → `a version-only change to a lockstep manifest needs no
    acknowledgement` / `a dependency-range change to a lockstep manifest still fails until
    acknowledged` (`workspace:^` → `workspace:*`).
  - desynced lockstep manifest rejected → `rejects version drift and legacy release scope`
    (pre-existing, still exercises this) plus the new `lockstep package version must agree across
    manifests` (`check-distribution-policy.test.mjs`).
- No change under `packages/*/src`. No CI workflow other than `.github/workflows/npm-release.yml`
  touched, and only for the `expected_version` default/preflight-source change the spec calls for.

## Deviation: `ci-scope.test.mjs`

Not listed in the phase's file scope, but required for `pnpm test` to stay green. The new
`scripts/__tests__/release-prepare-candidate.test.mjs` tests `scripts/release/prepare-candidate.mjs`;
`ci-scope.mjs`'s companion-script lookup (`scripts/__tests__/x.test.mjs` → `scripts/{,check-,generate-,
verify-}x.mjs`) only searches directly under `scripts/`, so it cannot resolve to a script inside
`scripts/release/`. Added one `NO_LANE_REQUIRED` entry (same pattern already used for
`release-control-plane.test.mjs`, `release-artifacts.test.mjs`, `release-ruleset-contract.test.mjs`) —
the underlying script already carries the `release`/`releasePrep` lane on its own path, so PR-lane
coverage of behavior changes is unaffected.

## Deferred to Phase 02 (explicitly out of scope here)

- `docs/dist-tag-policy.md`'s `observedDistTags` stays exactly where it is, unredesigned (per this
  task's scope notes).
- `docs/consumer-compatibility-report.md`'s `published` boolean stays authored (see "Owner-decision
  interpretation" above).
- Registry observation as committed data (D3), Changesets prerelease adoption (D4), required-review
  ruleset (D6) — not implemented, as instructed.

## Unresolved questions

None blocking. One judgment call is recorded above (keeping `published` in
`docs/consumer-compatibility-report.md`) — flag if a different reading of the phase file's literal
"and publication boolean" sentence was intended for this phase rather than Phase 02.

Status: DONE
Summary: packages/ui/package.json is now the single authored lockstep version; policy/report docs no
longer author duplicate version fields and reject re-authoring one with an actionable error; the
npm-release workflow requires an explicit expected_version every run; ownership hashing ignores only
the top-level version field; pnpm release:prepare automates the bump and was proven end-to-end (twice)
against a scratch RC version, catching and fixing a real lockstep-manifest bug in the process. Full
pnpm typecheck, pnpm test and pnpm release:verify are green on the final commit.
Concerns/Blockers: none blocking; one scope-interpretation judgment call noted above for owner review.
