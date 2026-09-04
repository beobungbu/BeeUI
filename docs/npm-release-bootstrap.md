# npm bootstrap and Trusted Publishing handoff

BeeUI's public npm scope is `@beemvp`. The repository-side release control plane is prepared, but registry mutation remains owner-gated by `docs/beeui-1.0-owner-gates.md` and issue #254.

## Current owner/account state

As of 2026-09-04, the owner has confirmed that the npm organization/scope `@beemvp` exists and that 2FA is enabled on the npm owner account. No BeeUI package publication is implied by those account-level actions.

The release workflow filename is `.github/workflows/npm-release.yml`. Its mutating jobs use the protected GitHub environment `release`; the OIDC staging job grants `id-token: write` only at the job level.

## Important npm bootstrap constraint

npm staged publishing cannot create a brand-new package. `npm stage publish` requires the package to already exist on the public registry. Trusted Publisher configuration is also package-scoped, so the first publication of each BeeUI package needs a one-time bootstrap path before OIDC-only staged publishing can take over.

BeeUI therefore uses this sequence:

1. Prepare an owner-approved prerelease version `20260902.0.0-rc.N` across root, core, tokens, ui and cli.
2. Run `npm-release` with `operation=verify` first. This is non-mutating.
3. For the first-ever package publication only, run `operation=bootstrap-rc` through the protected `release` environment. This path publishes the RC under `next` with provenance and requires the temporary environment secret `NPM_BOOTSTRAP_TOKEN`.
4. Immediately after the four packages exist, configure npm Trusted Publisher for every package using the exact values below.
5. Revoke the bootstrap token and delete `NPM_BOOTSTRAP_TOKEN` from the GitHub `release` environment.
6. For later RCs, use `operation=stage-rc`. The workflow authenticates with OIDC, stages each package, and stops. The owner reviews and approves each staged package with 2FA on npm.

No workflow operation promotes `latest`. Stable publication remains #254 work and must follow `docs/dist-tag-policy.md` plus exact-candidate approval.

## Trusted Publisher values on npm

Configure each of these packages independently after the first bootstrap publication:

- `@beemvp/beeui-core`
- `@beemvp/beeui-tokens`
- `@beemvp/beeui-ui`
- `@beemvp/beeui-cli`

Use the following trust relationship:

| npm field | Value |
| --- | --- |
| Provider | GitHub Actions |
| Organization or user | `beobungbu` |
| Repository | `BeeUI` |
| Workflow filename | `npm-release.yml` |
| Environment | `release` |
| Allowed action | `npm stage publish` only |

Do **not** enable direct `npm publish` on the steady-state Trusted Publisher. Staged publishing intentionally preserves a human 2FA approval boundary.

After OIDC is proven, set each package's publishing access to the strongest npm option that disallows normal publish tokens while retaining 2FA for owner/admin package changes. Keep no long-lived publish token in ordinary CI.

## Temporary bootstrap token

The bootstrap token is intentionally exceptional. It exists only because npm cannot use staged publishing or package-level Trusted Publisher before the package exists.

Create a granular npm access token with the minimum scope that can create the four public `@beemvp/beeui-*` packages. Because the one-time bootstrap happens in non-interactive GitHub Actions, npm direct publishing may require the token to bypass the interactive 2FA challenge. Store it only as the `NPM_BOOTSTRAP_TOKEN` secret in the protected GitHub `release` environment, never as a repository-level secret and never in `.npmrc`, source, logs or issue comments.

Revoke it immediately after bootstrap and Trusted Publisher configuration. The steady state is OIDC only.

## Workflow guardrails

`.github/workflows/npm-release.yml` is manual-dispatch only. Registry-mutating operations require all of the following before their job can run:

- exact workflow SHA checkout;
- exact user-entered version equals the workspace root version;
- version matches `20260902.0.0-rc.N`;
- explicit confirmation string `BEEUI_RC_RELEASE`;
- `pnpm release-control-plane:check`, `pnpm dist-policy:check`, and `pnpm release:verify` pass;
- protected `release` environment approval.

`bootstrap-rc` additionally refuses a version that is already public. `stage-rc` requires all package names to already exist and refuses a version that is already public. Registry mutation is sequential in dependency order: core, tokens, ui, cli.

A partial bootstrap is not automatically retried. Stop and reconcile the exact registry state, package hashes and provenance before any recovery action. Never publish a different artifact under the same semantic version.

## Staged approval

After `stage-rc` succeeds, review the staged package entries on npm before approval. Inspect package metadata/tarballs and approve with 2FA in dependency order: core, tokens, ui, cli. Approval is the action that makes each staged version public.

If anything is wrong, reject the staged version instead of approving it. A staged version occupies npm's version uniqueness index until it is rejected, so do not try to stage the same package/version again without first resolving the existing staged entry.

## Owner boundary

Creating this workflow and documentation does not authorize registry mutation. Until the owner explicitly authorizes the exact RC/publication action, the correct operational state is:

`OWNER_ACTION_REQUIRED`
