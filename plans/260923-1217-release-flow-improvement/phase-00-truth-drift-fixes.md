# Phase 00 — truth drift that is wrong today (docs only)

**Context:** `reports/scout-release-pipeline-and-process-docs-report.md` §2, §4, §7 items 1, 3, 4, 10; `reports/scout-version-literal-inventory-and-ci-scope-report.md` §1(d).
**When:** after PR #622 (rc.2 candidate) merges, so `docs/rc-candidate.md` edits do not conflict.
**Size:** S. No code, no workflow.

## Requirements

1. `docs/rc-candidate.md` rc.1 record states the SHA that was actually published (`ddf415b0d665c14e1b154bb02570a906585b4b98`, PR #538) and the digests of the artifacts on the registry, not the `58d038d` tree. Obtain digests with `npm view @beemvp/beeui-<pkg>@0.86.2-rc.1 dist.integrity dist.shasum dist.unpackedSize --json` and record `integrity`; keep the `58d038d` table under a "superseded pre-hardening candidate" heading so history is not erased.
2. `docs/rc-candidate.md` status banner and "Publication / provenance state" for rc.1 describe the post-publish state (already partially done in #622; verify).
3. `CONTRIBUTING.md` and `docs/beeui-1.0-owner-gates.md` no longer describe the repository as unpublished/private; publication is owner-gated per operation, not forbidden.
4. `docs/rc-ci-matrix.md` moves to `docs/archive/` (or gets a top-of-file "superseded, do not use" block plus removal from any index) and `docs/release.md` stops linking it as current.
5. `docs/npm-release-bootstrap.md` "Subsequent RCs" describes the real sequence: release branch → PR into `development` → ancestry-only or promote PR into `main` (iterate until artifact determinism is green) → dispatch `stage-rc` → owner 2FA → registry observation → evidence commit.
6. `CONTRIBUTING.md` local setup lists GNU tar as a requirement for `pnpm release:verify` on macOS (`brew install gnu-tar`, PATH note), matching `scripts/release/add-artifact-digests.mjs:213-224`.

## Files

Modify: `docs/rc-candidate.md`, `CONTRIBUTING.md`, `docs/beeui-1.0-owner-gates.md`, `docs/npm-release-bootstrap.md`, `docs/release.md`, `docs/rc-ci-matrix.md` (move or banner).

## Steps

1. Query registry digests (read-only `npm view`); paste into the rc.1 record.
2. Edit the six docs; keep every historical sentence, change only the claims that are false today.
3. Run `pnpm docs:public-truth:check`, `pnpm docs:surface:check`, `pnpm dist-policy:check`, `pnpm release-control-plane:check` (all read some of these files).
4. PR into `development`; docs lane only.

## Validation

- `grep -n "58d038d" docs/rc-candidate.md` appears only under the superseded heading.
- `grep -n "not published\|remains private" CONTRIBUTING.md docs/beeui-1.0-owner-gates.md` returns nothing that describes the current state.
- Gates above green.

## Risks / rollback

Docs-only; revert the PR. Do not touch the JSON block in `docs/dist-tag-policy.md` here (Phase 01 owns it).
