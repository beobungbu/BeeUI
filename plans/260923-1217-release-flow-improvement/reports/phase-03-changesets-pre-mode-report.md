# Phase 03 — Changesets pre-mode adoption report (D4, D5)

Date: 2026-09-26. Base: `development@b2e937e` (manifests at `0.86.2-rc.3`, published on npm 2026-09-24).

## 03A migration proof — PASSED

Throwaway worktree, installed `@changesets/cli` 3.0.2, real `.changeset/config.json` (fixed group of four).
The plan was written at rc.2; rc.3 is already published, so the proven transition starts at rc.3.

| Step | Result |
|---|---|
| `changeset pre enter rc` | `pre.json` = `{"mode":"pre","tag":"rc"}` (no v2 `initialVersions`) |
| patch changeset → `changeset version` | ui/core/tokens/cli = `0.86.2-rc.4` |
| patch changeset → `changeset version` | all four = `0.86.2-rc.5` |
| `changeset pre exit` → `changeset version` | all four = `0.86.2` |
| internal ranges | `workspace:*` preserved |

Decision (per D4): current-line adoption proceeds. The proof is now a permanent test
(`scripts/__tests__/release-version-packages.test.mjs`, last case) so a Changesets upgrade that changes
the arithmetic fails in CI.

## 03B — changed from plan

- `.changeset/pre.json` committed, tool-generated.
- `pnpm release:version` (`scripts/release/version-packages.mjs`): `changeset version` → lockstep assert →
  release-line assert (rejects e.g. `0.87.0-rc.0` from a `minor` changeset) → shared finishing steps
  extracted from `release:prepare` (`finishVersionBump`).
- **No `version-packages.yml` bot workflow.** Repo setting `can_approve_pull_request_reviews: false` means
  Actions cannot open PRs, and a `GITHUB_TOKEN` PR would not start required checks (same finding as
  `registry-observe.yml`). Enabling it is a security-setting change not covered by D1–D7. Target state
  "a bump is one command" is met by `pnpm release:version`; the bot PR stays a future option.

## 03C/03D — D5 constraint found

Ruleset `release-tag-protection` (21888212) restricts `refs/tags/v*` creation to admins and requires signed
tags. A workflow using `GITHUB_TOKEN` cannot create them. D5 is therefore implemented as: owner creates a
signed `v<version>` tag on the promoted `main` commit; a workflow verifies it (separate PR). Publication stays
manual `stage-rc` / `stage-stable` dispatch.

## Unresolved

- Whether to enable Actions PR creation (would allow the bot Version Packages PR) — owner/security decision.
- Existing rc.1–rc.3 have no `v*` tags; back-tagging needs the owner's signing key.
