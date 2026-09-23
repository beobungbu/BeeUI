# Phase 03 — Changesets pre mode, bot "Version Packages" PR, tags

**Context:** `reports/scout-release-pipeline-and-process-docs-report.md` §3, §4, §6, §7 items 2, 6, 9; owner decisions D4, D5. Depends on Phase 01 (`release:prepare`), preferably Phase 02.
**Size:** M. Configuration plus one workflow; the only source edit is wiring `release:prepare` into the Changesets version step.

## Target

- `.changeset/pre.json` present with `mode: "pre"`, `tag: "rc"`, `initialVersions` at the current lockstep version. While the stable line is `0.86.2`, every changeset declares `patch`; `changeset version` yields `0.86.2-rc.N+1`. `changeset pre exit` + a final `changeset version` yields `0.86.2` for the stable cut.
- ADR-016 (amends ADR-015): bump rule during and after the `0.86.2` line; the prerelease pattern is derived from the manifest (Phase 01), so a future `0.87.0-rc.0` needs no policy edit.
- `.github/workflows/version-packages.yml`: on push to `development`, `changesets/action` with `version: pnpm release:version` (which runs `changeset version && pnpm version:sync && pnpm release:prepare --regenerate-only`) and **no** `publish` step. It opens or updates the standing PR "Version Packages (rc)". Merging that PR is the bump. Human-authored bump PRs become the exception.
- Tags: `.github/workflows/tag-release.yml` on push to `main` creates `v<version>` when no tag for that version exists and the commit is a `development` sync (guards: `release-control-plane:check` green, tag absent). The `refs/tags/v*` ruleset already protects it. `docs/rollback-runbook.md` guidance about tags becomes true.
- D5: `npm-release.yml` gains an optional `push: tags: ['v*']` trigger that runs `operation=stage-rc` with `expected_version` from the tag; `environment: release` approval and npm 2FA remain. Until D5 is accepted, the tag workflow only creates the tag and prints the dispatch command.

## Files

Create: `.changeset/pre.json`, `docs/decisions/016-release-line-and-prerelease-bumps.md`, `.github/workflows/version-packages.yml`, `.github/workflows/tag-release.yml`.
Modify: `.changeset/README.md` (new 2-step recipe: merge bot PR → dispatch), `package.json` scripts (`release:version`), `.github/workflows/npm-release.yml` (D5 only), `docs/npm-release-bootstrap.md`, `docs/release.md`, `docs/release-ruleset.md` (document the two new workflows; `check-release-ruleset` test update), `scripts/ci-scope.mjs` (new workflow files are control plane → full-ci, already covered by prefix).

## Steps

1. Write ADR-016; get D4 accepted.
2. `pnpm changeset pre enter rc` on a branch; commit `pre.json`; add a `patch` changeset for anything unreleased; run `pnpm release:version` locally and confirm the output equals what Phase 01's dry run produced; revert the version, keep `pre.json`.
3. Add `version-packages.yml`; verify on a fork or with `workflow_dispatch` that the bot PR opens against `development` and PR CI (Phase 04) runs on it.
4. Add `tag-release.yml`; verify on the next `main` sync that `v0.86.2-rc.N` appears and the ruleset blocks deletion.
5. Optional D5 wiring; verified by a dry `operation=verify` run triggered from a tag.

## Validation

- Bot PR diff equals `release:prepare` output (no prose).
- `pnpm dist-policy:check`, `release-control-plane:check`, `release-ruleset:check/test` green on the bot PR.
- Tag exists for the published SHA; `docs/rc-candidate.md` candidate SHA equals the tag target (Phase 05 script asserts it).

## Risks / rollback

`changesets/action` needs `contents: write` + `pull-requests: write`; scope it to that workflow only. If the bot PR is noisy (one per merge), set it to update in place (default) and only merge at cut time. Rollback: delete the two workflows; pre mode can be exited with `changeset pre exit` without side effects.
