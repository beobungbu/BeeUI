# Release-flow improvement plan — one source of version truth, observable registry state, reproducible release evidence

**Status:** D1–D7 approved 2026-09-25 and implemented 2026-09-26. Phases 00 (#625), 04 (#626), 01 (#639), 02 (#640, #642, #644), 03 (#648: pre mode + `release:version`; tag verification #647) and the D7 literal sweep (#649) are merged. Two deviations, both forced by live repository settings and recorded in `reports/phase-03-changesets-pre-mode-report.md`: no bot Version Packages workflow (Actions may not open PRs), and `v*` tags are created by the owner and verified by CI (only admins may create signed release tags). Not started: the rest of Phase 05 (machine-readable release ledger, candidate evidence generated from it, the preflight check that publish artifacts match the frozen candidate digests, post-publication evidence).
**Baseline:** `development@8c63c9d`; rc.2 candidate is PR #622. Do not rebase Phases 01–03 onto the rc.2 release branch.
**Evidence:** three scout reports in `reports/` (version data flow, pipeline/process docs, literal inventory/CI scope). The reports describe the audited repository state; this plan adds implementation constraints discovered during review.

## Problem in one paragraph

The package version lives in `packages/*/package.json`, but a hand-typed copy in the fenced JSON block of `docs/dist-tag-policy.md` currently acts as the effective release pin and is re-typed into many prose/generated surfaces. Checks mostly prove copies agree rather than proving the statements are true. Registry publication is represented by an authored boolean even though it is external state. Changesets is installed but not operating the release flow. Release evidence also conflates the frozen candidate source SHA, later integration/promotion commits, and the SHA from which npm publication actually runs. The result is a release bump with many manual edits, publication-state drift windows, and important generated-surface checks that are discovered only after merge.

## Architectural invariants

1. **Version truth:** `packages/ui/package.json` is the single authored lockstep version. Followers are derived and checked.
2. **Registry truth:** npm state is observed external data. The repo stores a timestamped observation, never a hand-authored `published` boolean.
3. **Evidence truth:** `candidateSourceSha`, `integrationSha`, `mainPromotionSha` / publish workflow SHA, git tag target, and artifact digests are distinct facts. They must not be forced equal.
4. **Artifact identity is the release invariant:** promotion/evidence-only commits may have different commit SHAs while still producing byte-identical canonical tarballs. Release preflight proves the publish artifacts match the frozen candidate evidence.
5. **No event-recursion dependency:** a tag created by a workflow using the repository `GITHUB_TOKEN` must not be relied on to trigger another workflow. Release authorization remains explicit unless a future reusable-workflow/GitHub-App design replaces it.
6. **Changesets state is tool-owned:** with Changesets v3, `.changeset/pre.json` is created/mutated by `changeset pre ...`; do not hand-author removed v2 fields such as `initialVersions`.

## Target state

1. A bump is one command or one bot PR: `pnpm release:prepare <version>` during the migration, then a Changesets “Version Packages” PR after the prerelease migration gate passes. No human edits a live version literal.
2. Outside `CHANGELOG.md`, dated evidence/history and plans, there are zero hand-maintained current-version literals.
3. Workspace version and npm registry state are separate data with separate provenance. Public claims about npm are rendered from a committed observation with `observedAt`.
4. PR CI proves generated-surface freshness before merge. Expensive composite validation is release-prep scoped rather than attached to every broad full-CI change.
5. A release leaves a repository-level `v<version>` tag, immutable candidate evidence generated from `release-verification.json`, and a post-publication registry observation.
6. The release workflow never assumes `candidateSourceSha === GITHUB_SHA`; it proves artifact/content identity instead.

## Phases

| Phase | Title | Size | Depends on | Owner decision needed |
|---|---|---:|---|---|
| 00 | Fix current truth drift | S | after #622 merges | no |
| 04 | PR freshness gates and release-prep composite validation | M | independent | no |
| 01 | Single source of workspace version truth | M | 00 | D1, D2 |
| 02 | Registry observation as data; shared status renderer | L | 01 | D3, D7 |
| 03 | Changesets v3 migration gate, bot Version Packages PR, tags | M | 01; 02 preferred | D4, D5 |
| 05 | Evidence automation, runbook and governance | S/M | 01–04 | D6, D7 |

Recommended order: **00 → 04 → 01 → 02 → 03 → 05**. Phase 04 runs early so every later phase is self-proving before merge.

## Owner decisions

- **D1 — manifest owns the version.** Remove `currentVersion` / `prereleaseExample` from the policy JSON and derive the current version from `packages/ui/package.json`. **Recommendation: yes.**
- **D2 — ownership hashing ignores only derived version bytes.** For lockstep manifests, compute the ownership hash from a canonical object with the top-level `version` removed. Do **not** normalize or strip dependency protocol/range semantics such as `workspace:^` vs `workspace:*`. **Recommendation: yes.**
- **D3 — committed registry observation.** Keep docs builds deterministic/offline by committing `docs/registry-observation.json`. The primary refresh is an explicit post-publish `registry-observe` dispatch; a scheduled workflow is only a drift-detection/backstop path. A bot-created PR must be proven to execute the repository’s required checks correctly; do not assume unattended protected-CI behavior. **Recommendation: yes.**
- **D4 — Changesets prerelease adoption.** BeeUI uses Changesets v3. `pre.json` contains tool-owned prerelease state (`mode`, `tag`); removed v2 `initialVersions` must not be authored. Before enabling the bot flow, a scratch proof must demonstrate the exact BeeUI transition `0.86.2-rc.2 → 0.86.2-rc.3 → 0.86.2`. If direct mid-line adoption cannot prove that result, finish the 0.86.2 line with `release:prepare` and enter Changesets prerelease mode on the next release line. **Recommendation: conditional on the scratch proof; never fabricate pre state.**
- **D5 — release authorization.** Keep manual `workflow_dispatch stage-rc` through the 0.86.2 line. A repository tag may be created automatically, but do not chain publication by relying on a `GITHUB_TOKEN`-created tag push to start another workflow. Future automation may use `workflow_call` or a GitHub App after a separate design review. **Recommendation: manual dispatch for current line.**
- **D6 — required reviews.** Raise the `main` ruleset to one required approving review when a second maintainer exists; until then document the convention without pretending the ruleset enforces it. **Recommendation: defer.**
- **D7 — package README version prose.** Tarball/example READMEs should avoid exact current RC literals; install examples use `@next` and point to CHANGELOG/release state. **Recommendation: yes.**

## Changesets/action implementation constraint

When Phase 03 is enabled:

- use the repository’s installed Changesets v3 semantics;
- create prerelease state with `pnpm changeset pre enter rc`, never by typing `.changeset/pre.json`;
- pin the Changesets GitHub Action to a reviewed commit SHA;
- for the current action interface use `version-script: pnpm release:version` (the script itself must call `changeset version`);
- configure **no publish step** in the Version Packages workflow.

## Acceptance for the whole plan

- **Migration dry run:** on a scratch branch, `pnpm release:prepare 0.86.2-rc.9 && pnpm typecheck && pnpm test` is green with no manual prose edits; the diff is limited to manifests, CHANGELOG/changeset state and generated surfaces.
- **Literal audit:** a previous RC literal appears only in explicit history/evidence/plans, not current-state prose.
- **PR freshness:** changes under `packages/ui/src`, `registry/` or `apps/showcase` run the relevant generated-doc freshness checks before merge.
- **Release-prep composite:** manifest/changeset/release-control-plane changes run the literal root `pnpm typecheck && pnpm test`; ordinary source-only PRs do not inherit this ~30-minute composite merely because they are classified `full-ci`.
- **Registry state:** README/docs/llms output includes observation time and observed dist-tags, and can correctly show workspace ahead of registry.
- **Changesets migration gate:** before Phase 03 bot enablement, record a scratch proof of the exact expected prerelease/stable sequence. Failure means defer Changesets prerelease adoption to the next line.
- **Evidence:** generated candidate evidence records `candidateSourceSha` plus canonical artifact SHA-256 values. Promotion/publish validation compares artifact identity (and recorded provenance) rather than asserting the evidence commit SHA equals `GITHUB_SHA`.
- **Tag/release flow:** creating `v<version>` does not depend on that tag push recursively triggering `npm-release.yml`; current-line publication is an explicit dispatch.
- **Negative proof:** CI/control-plane changes are verified by a deliberately failing second PR or equivalent fixture that demonstrates stale generated content is rejected.

## Risks

- Contract changes touch heavily pinned checks; every phase lands with its tests and negative proof, never by weakening assertions.
- rc.2 publication is in flight; Phases 01–03 land after it or the release candidate must be re-prepared.
- Registry observation is the only new network-dependent operation; docs generation remains offline.
- Changesets prerelease mode is deliberately gated because the repository is already mid-RC-line. The safe fallback is to finish 0.86.2 with the explicit preparation tool and adopt pre mode from the next clean release line.
