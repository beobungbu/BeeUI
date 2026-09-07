# npm bootstrap, Trusted Publishing and stable handoff

BeeUI publishes under the public npm scope `@beemvp`. Registry mutation remains owner-gated by `docs/beeui-1.0-owner-gates.md` and issue #254.

## Current account state

The owner has confirmed that the npm organization/scope `@beemvp` exists and npm account 2FA is enabled. No BeeUI package publication is implied by those account-level actions.

The release workflow is `.github/workflows/npm-release.yml`. Every registry-mutating job uses the protected GitHub environment `release` and runs on a GitHub-hosted runner.

## Why a bootstrap is required

npm staged publishing and package-scoped Trusted Publisher configuration require the package to already exist. The first-ever BeeUI package publication therefore cannot start with `npm stage publish`.

BeeUI uses one exceptional bootstrap RC, then switches to OIDC-only staged publishing.

## Prepare a prerelease candidate

A publishable RC must be a fresh lockstep `0.86.2-rc.N` version on an exact integrated `main` SHA.

When intentionally moving the source tree to an RC version:

1. update all four package manifests (`packages/core`, `packages/tokens`, `packages/ui`, `packages/cli`) to the same `0.86.2-rc.N`;
2. run `pnpm version:sync` so `package.json`, `web/worker/package.json`, `apps/demo/app.json` and `apps/showcase/app.json` follow;
3. update `currentVersion` in the `json dist-tag-policy` block while leaving `candidateStableVersion` at `0.86.2`;
4. set `.github/workflows/npm-release.yml`'s `expected_version` default to the same RC version;
5. update `candidateVersion` in `docs/consumer-compatibility-report.md`;
6. regenerate checked generated docs/LLM surfaces required by the repository;
7. run the release-control, distribution-policy, public-truth, Web and release-verification gates before dispatch.

The active prerelease regex remains `^0\.86\.2-rc\.(0|[1-9][0-9]*)$`.

## First-ever RC bootstrap

After explicit owner authorization and a green exact candidate on `main`:

1. run `npm-release` with `operation=verify` first;
2. create a temporary granular npm token with only the permissions required to create the four `@beemvp/beeui-*` packages;
3. store it only as `NPM_BOOTSTRAP_TOKEN` in the protected GitHub `release` environment;
4. dispatch `operation=bootstrap-rc`, `expected_version=<exact rc>`, `confirmation=BEEUI_RC_RELEASE`;
5. the workflow rebuilds/verifies the package set and publishes sequentially under `next` with provenance;
6. verify the resulting public packages before continuing.

The bootstrap token is exposed only to the direct publish step. It must not be a repository-level token and must not be used by ordinary CI.

## Configure Trusted Publishing after bootstrap

Configure each package independently:

- `@beemvp/beeui-core`
- `@beemvp/beeui-tokens`
- `@beemvp/beeui-ui`
- `@beemvp/beeui-cli`

Use this trust relationship:

| npm field | Value |
| --- | --- |
| Provider | GitHub Actions |
| Organization or user | `beobungbu` |
| Repository | `BeeUI` |
| Workflow filename | `npm-release.yml` |
| Environment | `release` |
| Allowed action | `npm stage publish` only |

After all four Trusted Publishers are configured and a staged publish has been proven, revoke the bootstrap token and delete `NPM_BOOTSTRAP_TOKEN` from the GitHub release environment. Then configure the strongest npm publishing-access posture that disallows normal automation tokens while preserving owner 2FA administration.

## Subsequent RCs

For a later fresh `0.86.2-rc.N` candidate:

1. freeze the exact candidate on `main`;
2. dispatch `operation=stage-rc` with `confirmation=BEEUI_RC_RELEASE`;
3. CI stages all four packages under `next` through npm Trusted Publishing/OIDC;
4. owner reviews/downloads the staged tarballs as needed and approves each package with npm 2FA;
5. verify the actual public registry artifacts and clean-consumer behavior.

Do not silently retry an occupied staged version. Reject/reconcile the existing stage first.

## Stable `0.86.2`

Stable publication uses the same staged-publishing trust path, but it deliberately does **not** expose a partial set through `latest`.

1. restore/freeze the source manifests and policy to lockstep stable `0.86.2` on the exact approved `main` SHA;
2. run `operation=verify`;
3. dispatch `operation=stage-stable`, `expected_version=0.86.2`, `confirmation=BEEUI_STABLE_STAGE`;
4. CI stages all four stable packages under `next` through OIDC;
5. owner approves all four staged packages with npm 2FA;
6. dispatch `operation=verify-stable` from the exact approved stable main line;
7. `verify-stable` requires all four public `0.86.2` versions, checks registry integrity and canonical repository metadata, verifies the `next` tag, installs the actual public packages into a clean consumer and executes the packed `beeui` binary;
8. only after that verification is green, the owner moves `latest` for all four packages to `0.86.2` in one uninterrupted authenticated 2FA session;
9. verify the resulting `latest` tags and record release evidence.

The stable upload temporarily uses `next` as a safety channel because npm staged approval would otherwise attach the default `latest` tag package-by-package. `latest` remains the final consumer commit point.

## Why final dist-tag promotion is manual

npm Trusted Publishing/OIDC authenticates `npm publish` and `npm stage publish`. It does not authorize `npm dist-tag` mutation. The final `latest` move is therefore an owner proof-of-presence operation rather than a CI write-token workflow.

This is intentional: BeeUI does not add a long-lived npm write token merely to automate the last four dist-tag changes.

## Workflow guardrails

Registry-mutating workflow operations require:

- `refs/heads/main`;
- exact workflow SHA checkout;
- user-entered `expected_version` equals the workspace root version;
- the correct version shape (`0.86.2-rc.N` for RC operations, exactly `0.86.2` for stable staging);
- explicit confirmation (`BEEUI_RC_RELEASE` or `BEEUI_STABLE_STAGE`);
- `pnpm release-control-plane:check`;
- `pnpm dist-policy:check`;
- `pnpm release:verify`;
- protected `release` environment approval.

`bootstrap-rc` refuses reused versions. `stage-rc` and `stage-stable` require the package names to already exist and refuse a public version collision. Only an npm 404 is treated as absence; unexpected registry/network/auth failures abort.

Registry mutation is sequential in dependency order: core → tokens → ui → cli.

## Partial publication recovery

Never rebuild a different artifact under the same semantic version.

If a bootstrap or approval sequence is partial:

- stop;
- inspect exact registry/stage state;
- compare package integrity/provenance with the reviewed candidate;
- recover only the missing package/version pair with explicit owner authorization;
- keep `latest` untouched until the full stable set is verified.

Published versions are immutable. Correct forward; do not unpublish to reclaim a version.

## Owner boundary

Until the owner explicitly authorizes a concrete registry operation, the correct operational state remains:

`OWNER_ACTION_REQUIRED`
