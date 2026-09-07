# BeeUI npm dist-tag and publication policy

This document is the machine-checked authority for BeeUI npm versioning, staging and dist-tag behavior.

BeeUI 1.0 is the product milestone name. The stable npm package line starts at **`0.86.2`** per ADR-015. The current unpublished release candidate is **`0.86.2-rc.1`**. The superseded `20260902.0.0`, `1.0.0`-as-npm-version and historical `0.1.0` candidate must not be used by an active release path.

## Owner guard

Technical readiness is not publication authorization. No npm package, staged package or dist-tag may be created or changed until the repository owner explicitly authorizes the corresponding release operation under issue #254 and the protected GitHub `release` environment.

## Package set and lockstep versioning

These four packages release as one lockstep group:

- `@beemvp/beeui-core`
- `@beemvp/beeui-tokens`
- `@beemvp/beeui-ui`
- `@beemvp/beeui-cli`

A prerelease is `0.86.2-rc.N`; the stable version is `0.86.2`. `pnpm release:verify` must prove that packed manifests contain the same version and no unresolved `workspace:*` dependency.

## Persistent dist-tags

BeeUI uses exactly two persistent public dist-tags:

| Tag | Meaning |
| --- | --- |
| `latest` | default-install stable channel; never points to a prerelease |
| `next` | opt-in release-candidate/safety channel; normally points to the newest `0.86.2-rc.N`, and may point to the fully approved stable `0.86.2` during/after stable promotion |

`latest` is the consumer commit point. Default consumers must not see a stable release until the full four-package stable set has been published and verified.

## First-ever package bootstrap

npm staged publishing and trusted-publisher configuration require the package to already exist. Therefore the first public RC is a special bootstrap:

1. freeze one exact `0.86.2-rc.N` source candidate on `main`;
2. require all exact-head release gates to be green;
3. use the protected `bootstrap-rc` workflow with a temporary environment-scoped npm token;
4. publish the four packages sequentially in dependency order under `next` with provenance;
5. verify the public packages;
6. configure a Trusted Publisher independently for all four packages, restricted to `.github/workflows/npm-release.yml`, repository `beobungbu/BeeUI`, environment `release`, with **stage-publish only** permission;
7. revoke the bootstrap token and delete `NPM_BOOTSTRAP_TOKEN` from the GitHub release environment.

The bootstrap token is a one-time compatibility bridge, not the steady-state release credential.

## Subsequent RC publication

For later `0.86.2-rc.N` versions:

1. freeze an exact main SHA with a fresh lockstep RC version;
2. run `stage-rc` from that SHA;
3. CI uses npm Trusted Publishing/OIDC and `npm stage publish --tag next`;
4. the owner reviews each staged package and approves it with npm 2FA;
5. verify the actual registry artifacts and clean-consumer behavior.

OIDC is allowed to stage packages; it is not used for owner proof-of-presence actions.

## Stable `0.86.2` publication

Stable publication deliberately separates **upload** from the default-install `latest` promotion:

1. freeze exact stable `0.86.2` source on `main` and require all release gates to pass;
2. run `stage-stable`; CI stages all four stable tarballs under `next` through Trusted Publishing/OIDC;
3. owner reviews/downloads the staged artifacts as needed and approves all four with npm 2FA;
4. run `verify-stable`; it requires all four `0.86.2` packages to be public, checks registry integrity/repository metadata, requires `next` to resolve to `0.86.2`, installs the real registry packages into a clean consumer and executes the `beeui` CLI;
5. only after `verify-stable` is green, the owner moves `latest` for all four packages to `0.86.2` in one uninterrupted authenticated 2FA session;
6. verify all four `latest` tags and retain the final release evidence.

Using `next` for the stable upload phase is intentional: it prevents a partial stable approval from changing the default-install channel. A stable version on `next` is safe because `next` is explicitly opt-in and `0.86.2` has higher semver precedence than its RCs. Once a future prerelease line exists, `next` can move to that new prerelease.

## Why `latest` promotion is owner-interactive

npm Trusted Publishing/OIDC currently authenticates `npm publish` and `npm stage publish`; it does not authorize `npm dist-tag` mutation. The final `latest` move is therefore an owner proof-of-presence action rather than a CI secret. This avoids introducing a long-lived write token merely to automate four dist-tag changes.

## Failure handling

npm does not provide a cross-package transaction. Safety comes from ordering:

- if an RC bootstrap/stage fails partway, only the opt-in `next` channel can be inconsistent; `latest` is unaffected;
- if stable staging/approval fails partway, `latest` is still untouched;
- never attempt to overwrite an already-published package version;
- complete a partial set at the same version only when the missing package version is truly absent;
- if a published version is bad, correct forward with a new version and deprecate the bad one; do not unpublish;
- if `latest` is moved incorrectly, restore all four packages to the last-good stable before doing anything else.

## Candidate and evidence requirements

Before any registry mutation, record or verify:

- exact source SHA;
- lockstep version;
- changelog/migration/support status;
- release-equivalent tarball verification;
- required exact-head CI gates;
- registry absence of the candidate version;
- protected release-environment approval.

After publication, additionally record the public package integrity/provenance, dist-tags and clean-consumer result.

## Machine-readable policy contract

The block below is parsed by `scripts/check-distribution-policy.mjs` and feeds the release control plane.

```json dist-tag-policy
{
  "published": false,
  "currentVersion": "0.86.2-rc.1",
  "candidateStableVersion": "0.86.2",
  "prereleaseVersionPattern": "^0\\.86\\.2-rc\\.(0|[1-9][0-9]*)$",
  "prereleaseExample": "0.86.2-rc.1",
  "distTags": ["latest", "next"],
  "prereleaseDistTag": "next",
  "stableDistTag": "latest",
  "stablePromotionTag": "latest",
  "lockstepPackages": ["@beemvp/beeui-core", "@beemvp/beeui-tokens", "@beemvp/beeui-ui"],
  "releaseEnvironment": "release"
}
```

## Revisit trigger

Revisit this policy if npm expands Trusted Publishing to dist-tag mutation, a second maintained release line needs another persistent channel, or the CLI leaves the lockstep release group.
