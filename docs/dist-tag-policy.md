# BeeUI dist-tag and prerelease policy (#206, R7.10)

This document defines the npm release semantics for BeeUI: supported consumer dist-tags, prerelease naming, lockstep package/CLI alignment, first-package bootstrap, staged publishing, stable promotion, and recovery. The distribution architecture authority is [ADR-011](decisions/011-distribution-architecture.md); current gates are [docs/release.md](release.md); GitHub protection is [docs/release-ruleset.md](release-ruleset.md); npm bootstrap/OIDC handoff is [docs/npm-release-bootstrap.md](npm-release-bootstrap.md).

## Owner guard — nothing is published before #254 authorization

Before the repository owner explicitly authorizes the exact release candidate/publication action, this policy is documentation only. No package or CLI is published and no public dist-tag is created, moved, or deleted. Registry mutation is gated behind the protected `release` GitHub environment and the #254 hard gate.

Technical readiness is not release authorization. Packed tarballs, dry runs, retained artifacts, a configured workflow, npm organization ownership, and 2FA do not mean BeeUI has been published.

## Version authority

BeeUI 1.0 remains the product milestone name. The owner-selected npm date-version line is `20260902`, represented as SemVer:

- stable: `20260902.0.0`
- prerelease: `20260902.0.0-rc.N` (`rc.1`, `rc.2`, ...)

The root workspace, `@beemvp/beeui-core`, `@beemvp/beeui-tokens`, `@beemvp/beeui-ui`, and `@beemvp/beeui-cli` use one lockstep version. The CLI binary remains `beeui`.

`scripts/check-release-control-plane.mjs` accepts only this stable release line or its `-rc.N` prereleases and rejects package drift. `pnpm release:verify` remains the package/artifact boundary authority.

### Published prerelease vs internal rc-ready artifact

Do not confuse a public `20260902.0.0-rc.N` with the internal retained-artifact version produced by `scripts/pack-artifacts.mjs`, which uses `<version>-rc-ready.<commit-sha12>`. The `rc-ready` form is never a public npm version; it exists only to identify reproducible retained artifacts.

## Consumer-facing dist-tags

BeeUI supports exactly two consumer-facing floating channels:

| Dist-tag | Consumer opt-in | Intended target |
| --- | --- | --- |
| `latest` | default (`npm i @beemvp/beeui-ui`) | current stable version only |
| `next` | explicit (`npm i @beemvp/beeui-ui@next`) | newest approved prerelease only |

A prerelease is never intentionally exposed through `latest`. The first public testing channel is `next` on a `20260902.0.0-rc.N` version.

A stable release transaction may use a short-lived internal transaction tag solely to upload and verify immutable package versions before coordinated `latest` promotion. Such a tag is not a supported consumer channel, must not be documented as an install target, and must be removed after the transaction. npm has no cross-package atomic dist-tag primitive, so BeeUI must describe this as a coordinated fail-safe promotion rather than claiming registry-level atomicity.

## First-ever package bootstrap

npm staged publishing cannot create a brand-new package, and npm Trusted Publisher configuration is package-scoped. Therefore the first public BeeUI package set must be bootstrapped once before OIDC-only staged publishing can be used.

The first bootstrap must use an owner-approved prerelease `20260902.0.0-rc.N` and the `next` tag, never the stable `20260902.0.0` or `latest`. `.github/workflows/npm-release.yml` implements this as `bootstrap-rc` behind the protected `release` environment. It publishes in dependency order:

1. `@beemvp/beeui-core`
2. `@beemvp/beeui-tokens`
3. `@beemvp/beeui-ui`
4. `@beemvp/beeui-cli`

The bootstrap uses provenance and a temporary `NPM_BOOTSTRAP_TOKEN` stored only in the `release` environment. The workflow exposes that token only to the final direct-publish step; install/build/verify/pack and registry probes run without it. Because this is a non-interactive first publication, that temporary token may need npm's bypass-2FA capability. It must be revoked immediately after the packages exist and Trusted Publisher is configured.

A partial bootstrap is a STOP condition. Do not silently retry or republish already-created package versions. Reconcile exact registry state, artifact hashes, provenance, and missing packages first. Any owner-authorized recovery must target only the missing package/version pairs using the exact previously reviewed tarballs; it is a separate explicit/manual recovery action (or separately reviewed recovery workflow), not a normal `bootstrap-rc` rerun.

## Trusted Publishing and staged RCs

After the first bootstrap, configure one npm Trusted Publisher per package using:

- provider: GitHub Actions
- GitHub owner/user: `beobungbu`
- repository: `BeeUI`
- workflow filename: `npm-release.yml`
- environment: `release`
- allowed action: `npm stage publish` only

Steady-state RC publication uses `operation=stage-rc` in `.github/workflows/npm-release.yml`. The job has `contents: read` plus job-local `id-token: write`, uses a GitHub-hosted runner, stages the four packages under `next`, and stops. No long-lived publish token is used.

A maintainer then reviews the staged packages on npm and approves each with 2FA. Approval is the action that makes the staged package public. Review/approval order is core, tokens, ui, cli. If inspection finds any mismatch, reject the stage instead of approving it.

Staged package versions occupy npm's version uniqueness index. Do not attempt to stage the same package/version again while a prior staged entry exists.

## RC testing and promotion discipline

`next` is the real-registry consumer test channel. A clean external consumer may install:

```sh
pnpm add @beemvp/beeui-ui@next
```

and the CLI may be exercised with the matching `@beemvp/beeui-cli@next` line. Web, Expo Android/iOS, and bare React Native verification must use the public package artifacts rather than monorepo fallbacks when claiming registry-consumer evidence.

A prerelease that fails testing is not promoted to stable. Publish a later `rc.N` after fixes; never overwrite an existing npm version.

## Stable `latest` release

Stable `20260902.0.0` remains #254 work and is intentionally not implemented by the RC bootstrap/staging workflow in this change.

The stable release workflow must preserve these invariants:

1. exact owner-approved SHA/version and retained artifact hashes are frozen;
2. all four immutable stable package versions are uploaded without exposing a partially-ready UI/CLI release as the new default;
3. registry artifacts, provenance, package metadata, dependencies, and clean-consumer installs are verified;
4. `latest` is promoted only after the complete set is present and verified;
5. library dependency targets are available before `@beemvp/beeui-ui` becomes the new default, and CLI promotion occurs only after its matching libraries are ready;
6. any temporary transaction tag is removed after successful promotion.

If npm introduces a true cross-package transaction mechanism, this policy may be tightened to use it. Until then, do not describe sequential npm operations as atomic.

## Correction and recovery

Published package content is immutable. Recovery uses metadata and forward fixes, not overwrite attempts.

- Wrong `latest`: re-point `latest` to the last-good stable version for all affected packages, with UI/CLI moved only after their dependency set is coherent.
- Bad published version: deprecate it with a clear reason and upgrade path, then publish a corrected new version.
- Do not unpublish as a routine rollback mechanism.
- Wrong `next`: re-point `next` to the intended prerelease, or remove it if no valid prerelease should currently be exposed.
- Partial bootstrap/stage: stop, inventory exact package/version state, verify hashes/provenance, and perform an explicit reviewed recovery plan.

## Machine-readable policy contract

The block below is parsed by `scripts/check-distribution-policy.mjs`. `published` remains `false` until owner-authorized publication updates repository evidence. `currentVersion` must match the lockstep manifests, the candidate stable base must match the date-version line, and the prerelease pattern must describe the approved `-rc.N` form.

```json dist-tag-policy
{
  "published": false,
  "currentVersion": "20260902.0.0",
  "candidateStableVersion": "20260902.0.0",
  "prereleaseVersionPattern": "^20260902\\.0\\.0-rc\\.(0|[1-9][0-9]*)$",
  "prereleaseExample": "20260902.0.0-rc.1",
  "distTags": ["latest", "next"],
  "prereleaseDistTag": "next",
  "stableDistTag": "latest",
  "stablePromotionTag": "latest",
  "lockstepPackages": [
    "@beemvp/beeui-core",
    "@beemvp/beeui-tokens",
    "@beemvp/beeui-ui",
    "@beemvp/beeui-cli"
  ],
  "releaseEnvironment": "release"
}
```

## Revisit triggers

Revisit this policy if a second maintained release line needs another supported consumer tag, the CLI leaves the lockstep scheme, npm changes staged-publishing bootstrap requirements, npm adds cross-package transactions, or the owner changes the date-version authority.
