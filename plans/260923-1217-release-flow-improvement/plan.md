# Release-flow improvement plan — one source of version truth, one bump action

**Status:** PROPOSED (2026-09-23). Owner decisions required before Phase 1 (see below).
**Baseline:** `development@8c63c9d`; rc.2 candidate in flight as PR #622 (do not rebase these phases onto that branch).
**Evidence:** three scout reports in `reports/` (data flow, pipeline and process docs, literal inventory and CI scope).

## Problem in one paragraph

The package version lives in `packages/*/package.json`, but a hand-typed copy of it is the real pin (`docs/dist-tag-policy.md` JSON block) and that pin is re-typed by hand into ~29 prose files, two generator templates, a workflow default and a compatibility report. Checks enforce that the copies agree, not that the docs are true. The same JSON block carries one `published` boolean for a fact the repo cannot know (registry state), and three hard assertions force "workspace version" and "published version" to be equal. Changesets is configured but never wired (no pre mode, no bot PR, no publish, no tags), so an RC bump is ~40 judged sentence edits, two regeneration passes and eight gate families that only run after merge. The rc.1 evidence doc records a different SHA than the artifact that shipped.

## Target state

1. A bump is one command or one bot PR: `pnpm release:prepare` (or the Changesets "Version Packages" PR) touches manifests, CHANGELOG and regenerated surfaces; no human edits a version literal.
2. Outside `CHANGELOG.md` and dated history, the repo contains zero hand-maintained version literals (`grep -rn "<previous rc>"` returns only history).
3. "Workspace version" and "published on npm" are two data fields with two provenances; every public sentence about npm is rendered from an observed registry snapshot with a date, never typed.
4. PR CI proves generated-surface freshness and the composite chains before merge; post-merge environment-ci becomes a backstop, not the first detector.
5. A release leaves a git tag, a candidate evidence record written by a script from `release-verification.json`, and a registry observation committed after approval.

## Phases

| Phase | Title | Size | Depends on | Owner decision needed |
|---|---|---|---|---|
| 00 | Truth drift fixes that are wrong today | S | after #622 merges | no |
| 01 | Single source of version truth | M | 00 | D1 (drop hand pin), D2 (hash manifests without `version`) |
| 02 | Registry observation as data; docs render from data | L | 01 | D3 (committed snapshot vs build-time fetch) |
| 03 | Changesets pre mode, bot "Version Packages" PR, tags | M | 01 (02 preferred) | D4 (ADR-015 amendment), D5 (auto-stage on tag or keep dispatch) |
| 04 | PR CI proves freshness and composite chains before merge | M | independent of 01–03 | no (CI minutes trade-off noted) |
| 05 | Process docs, evidence automation, governance | S/M | 01–04 | D6 (required reviews), D7 (package README literals) |

Phase files: [phase-00](phase-00-truth-drift-fixes.md) · [phase-01](phase-01-single-source-of-version-truth.md) · [phase-02](phase-02-registry-observation-as-data.md) · [phase-03](phase-03-changesets-pre-mode-and-bot-pr.md) · [phase-04](phase-04-pr-ci-freshness-gates.md) · [phase-05](phase-05-process-docs-and-governance.md)

Recommended order: 00 → 04 (can run in parallel with 01) → 01 → 02 → 03 → 05. Phase 04 first-ish because it makes every later phase's PR self-proving.

## Owner decisions (block Phase 1+)

- **D1** Remove `currentVersion`/`prereleaseExample` from the `dist-tag-policy` JSON block and derive them from `packages/ui/package.json`. Contract change across `check-release-control-plane`, `check-distribution-policy`, `check-public-doc-truth`, `generate-docs-foundation`, tests. Recommendation: yes.
- **D2** `docs:surface:check` should hash canonical manifests with the `version` field stripped so a bump never trips the ownership gate. Recommendation: yes.
- **D3** Registry state: commit `docs/registry-observation.json` written by `pnpm registry:observe` (deterministic builds, explicit dates) vs fetch `npm view` at docs build time (always fresh, network-dependent builds). Recommendation: committed snapshot + scheduled observe workflow that opens a PR on drift.
- **D4** ADR-015 amendment: while the stable line is `0.86.2`, every changeset is `patch` and Changesets runs in pre mode `rc`; after stable ships, minor/major changesets open a new line and the prerelease regex derives from the manifest. Recommendation: yes; convert the pending `minor` changeset accordingly (it was retired in PR #622 already).
- **D5** Keep manual `workflow_dispatch stage-rc` (owner gate #254) vs let a `v*` tag push trigger `stage-rc` automatically (approval still via `release` environment + npm 2FA). Recommendation: keep dispatch for rc.2/rc.3, switch to tag-trigger once Phase 03 has run twice.
- **D6** Raise `main` ruleset `requiredApprovingReviewCount` to 1 when a second maintainer exists; until then keep the documented convention. Recommendation: defer, record in ruleset doc.
- **D7** Package READMEs (packed into tarballs) and example READMEs drop exact version literals in favor of `@next` + CHANGELOG link. Recommendation: yes.

## Acceptance for the whole plan

- Dry run: on a scratch branch, `pnpm release:prepare 0.86.2-rc.9` (or merging the bot PR) followed by `pnpm typecheck && pnpm test` is green with **no** manual edits; `git diff --name-only` contains only manifests, CHANGELOG, generated surfaces, and `.changeset/`.
- `grep -rn "0.86.2-rc.<previous>" --exclude-dir=node_modules .` returns only `CHANGELOG.md`, `docs/rc-candidate.md` history and `plans/`.
- A PR touching `packages/ui/src`, `registry/` or `apps/showcase` runs `docs:portal-pages:check` and `docs:surface:check` before merge.
- The published-state sentence on the docs site, README and llms.txt shows an observation date and the observed dist-tags, and differs from the workspace version when they differ.
- `docs/rc-candidate.md` candidate section is generated from `release-verification.json` and matches the SHA the workflow later publishes (guard in `npm-release.yml` preflight).

## Risks

- Contract changes touch checks that tests pin; every phase must land with its tests, never by weakening them (see [[beeui-ci-self-verification-blind-spot]] lesson: a PR editing CI is verified by a second, deliberately failing PR).
- rc.2 publish is in flight; Phases 01–03 land after it, or the release branch must be re-prepared.
- Network in CI for registry observation (D3) is the only new external dependency.
