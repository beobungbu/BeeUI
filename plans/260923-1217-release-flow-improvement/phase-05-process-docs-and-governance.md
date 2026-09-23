# Phase 05 — process docs, evidence automation, governance

**Context:** `reports/scout-release-pipeline-and-process-docs-report.md` §2, §5, §7 items 1, 6, 7, 8, 9; owner decisions D6, D7. Depends on Phases 01–04 (documents the flow they create).
**Size:** S/M.

## Requirements

1. **Evidence is generated, not typed.** `pnpm release:evidence` (`scripts/release/write-candidate-evidence.mjs`) writes the "Frozen candidate — `<version>`" section of `docs/rc-candidate.md` between markers from `.artifacts/release-verification.json` (tarball names, bytes, SHA-256), `git rev-parse HEAD`, and, when given `--pr <n>`, the `gh` check results for that head. `npm-release.yml` preflight asserts the candidate SHA recorded in the section equals `GITHUB_SHA` (so the rc.1 mismatch cannot recur), and after a successful stage the owner's next `registry:observe` PR appends the published integrity values.
2. **One release runbook.** Collapse `docs/release.md`, `docs/npm-release-bootstrap.md` "Subsequent RCs", `docs/rc-candidate.md` "Candidate-freeze rule", and `.changeset/README.md` into a single ordered runbook (`docs/release-runbook.md`): merge bot PR → sync `main` (tag appears) → dispatch/approve `stage-rc` → owner 2FA → `registry:observe` PR → evidence updated. Old docs keep a pointer. `docs/rollback-runbook.md` references real tags.
3. **CONTRIBUTING.md**: post-publication state; GNU tar requirement; "no self-merge" stated as convention with the ruleset value; how to add a changeset (`patch` while on the 0.86.2 line, ADR-016).
4. **Governance (D6)**: `docs/release-ruleset.md` records the decision on `requiredApprovingReviewCount`; if raised, `check-release-ruleset` expectation updated.
5. **Package READMEs (D7)**: no exact version literal; install via `@next`; link to CHANGELOG.
6. **Archive**: `docs/rc-ci-matrix.md` and other superseded candidate evidence move under `docs/archive/` with an index.

## Files

Create: `scripts/release/write-candidate-evidence.mjs` (+ test), `docs/release-runbook.md`, `docs/archive/README.md`.
Modify: `docs/rc-candidate.md` (markers), `.github/workflows/npm-release.yml` (preflight SHA assertion), `docs/release.md`, `docs/npm-release-bootstrap.md`, `docs/rollback-runbook.md`, `CONTRIBUTING.md`, `docs/release-ruleset.md` (+ check/test), `packages/*/README.md`, `.changeset/README.md`, `docs/agent-execution-contract.md` (agent may run `release:prepare`/`release:evidence`, never dispatch/approve).

## Steps

1. Evidence script + markers + preflight assertion; test with the rc.2 verification report.
2. Runbook written from the real rc.2 trail (PR #622, tag, dispatch); old docs pointed at it.
3. CONTRIBUTING and README edits; `docs:public-truth:check` adjusted for the generated block from Phase 02.
4. Archive move; link check (`pnpm docs:foundation:check`, `web:check`).

## Validation

- `pnpm release:evidence --pr 622` reproduces the rc.2 section byte-for-byte except the CI rows it fetches.
- A dry `operation=verify` dispatch on a commit whose evidence SHA differs fails preflight with the new message.
- `grep -rn "0.86.2-rc" packages/*/README.md` returns nothing.
- Full `pnpm typecheck && pnpm test`.

## Risks / rollback

Doc consolidation can drop a rule someone relies on: keep the old files as pointers for one release before deleting. Preflight assertion is additive; revert if it blocks a legitimate re-dispatch (re-run `release:evidence` instead).
