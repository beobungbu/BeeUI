# Phase 03 — Changesets v3 migration gate, Version Packages PR and repository tags

**Context:** pipeline/process audit and owner decisions D4/D5.
**Depends on:** Phase 01; Phase 02 preferred.
**Size:** M.

## Non-negotiable compatibility constraints

BeeUI currently uses Changesets v3. Therefore:

- prerelease state is created by `pnpm changeset pre enter rc`;
- `.changeset/pre.json` is tool-owned and must not contain removed v2 state such as `initialVersions`;
- versioned prerelease changesets are managed by Changesets under `.changeset/pre/`;
- do not hand-edit prerelease state to force a desired version;
- the GitHub Action is pinned to a reviewed commit SHA and configured with its current `version-script` input, not the older `version` input.

Because BeeUI is already mid-line at `0.86.2-rc.2`, prerelease automation is gated by a scratch proof rather than assumed safe.

## Phase 03A — migration proof

On a throwaway branch/worktree based on the post-rc.2 `development` state:

1. Confirm manifests are exactly `0.86.2-rc.2`.
2. Run `pnpm changeset pre enter rc`; inspect the tool-generated state but do not edit it.
3. Add a representative patch changeset for the fixed package group.
4. Run the proposed `pnpm release:version` path.
5. Required result for current-line adoption: lockstep packages become exactly `0.86.2-rc.3`.
6. Add another patch changeset and prove the next cycle is `0.86.2-rc.4`.
7. Run `pnpm changeset pre exit` then the version step; required stable result is exactly `0.86.2`.
8. Record command output and diff in the phase report; reset the scratch branch.

### Migration decision

- **If every transition above is correct:** current-line Changesets prerelease adoption may proceed.
- **If any transition differs** (for example Changesets wants a new stable base such as `0.86.3-rc.0`): do not invent/mutate `pre.json`. Finish the 0.86.2 line with `release:prepare`, ship stable 0.86.2, then enter Changesets pre mode from the next clean release line.

This gate is stronger than a unit fixture because it executes the exact installed dependency and BeeUI fixed-package graph.

## Phase 03B — Version Packages PR

After the migration gate is accepted (or when the next release line begins):

- add `release:version` that runs `changeset version`, then BeeUI version propagation and generated-surface regeneration;
- create `.github/workflows/version-packages.yml` on push to `development`;
- use the reviewed/pinned Changesets Action with:
  - `version-script: pnpm release:version`;
  - no `publish-script`;
  - least-privilege `contents: write` and `pull-requests: write` only in this workflow;
- the standing PR is “Version Packages (rc)” while pre mode is active;
- merging the bot PR performs the source/version bump only. npm mutation remains separate.

The action must update the existing standing PR rather than create one PR per merge.

## Phase 03C — repository release tag

Create a repository-level `v<version>` tag after the promoted `main` commit is known.

A custom `tag-release.yml` may create/verify this tag, but:

- the tag target is the `main` release/promotion commit, **not** the earlier candidate-source SHA;
- if the tag already exists, verify its target and fail on mismatch;
- do not use Changesets monorepo package tags as a substitute for BeeUI’s repository-level `v<version>` release tag unless a separate ADR chooses that convention;
- do not rely on the tag push to recursively start publication.

## Phase 03D — publication authorization

For the 0.86.2 line, `npm-release.yml` remains `workflow_dispatch`-driven:

1. merge/version candidate to `development`;
2. promote/sync the exact release content to `main`;
3. create/verify `v<version>` on that `main` commit;
4. owner dispatches `stage-rc` with the exact version/confirmation;
5. release environment + npm 2FA authorize registry mutation;
6. dispatch registry observation.

Do **not** add a `push: tags: ['v*']` publication path that depends on a tag created using `GITHUB_TOKEN`. GitHub Actions suppresses event-recursion for token-generated events; the design must not depend on that chain.

A future fully automatic design may call a reusable workflow with `workflow_call` from the same orchestrator or use a reviewed GitHub App token, but that is outside the current line.

## Files

Create/modify as appropriate:

- tool-generated `.changeset/pre.json` only after the migration gate;
- `docs/decisions/016-release-line-and-prerelease-bumps.md`;
- `.github/workflows/version-packages.yml`;
- `.github/workflows/tag-release.yml`;
- package scripts for `release:version`;
- release docs/ruleset contracts/tests.

No tag-triggered npm publish workflow is added in this phase.

## Validation

- Scratch evidence proves the exact accepted version sequence or explicitly records deferral to the next release line.
- No hand-authored `initialVersions` exists.
- Bot PR diff equals the approved version/regeneration path and contains no current-state prose edits.
- Action is commit-SHA pinned and uses `version-script`.
- Bot workflow has no publish command and no npm credentials.
- Repository tag target equals the promoted `main` release commit.
- Creating the tag is not required to trigger another workflow; manual release dispatch still works independently.
- Release-control-plane, distribution-policy, ruleset and PR CI checks are green.

## Risks / rollback

The biggest risk is adopting prerelease mode halfway through an already established RC line. The migration gate makes “defer until next line” an explicit successful outcome, not a failure. Workflows can be reverted without changing already published registry state.
