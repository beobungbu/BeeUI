# BeeUI npm dist-tag and publication policy

This document is the machine-checked authority for BeeUI npm versioning, staging and dist-tag behavior.

BeeUI 1.0 is the product milestone name. The stable npm package line starts at **`0.86.2`** per ADR-015. The first public release candidate, **`0.86.2-rc.1`**, is published on npm under the opt-in **`next`** dist-tag. Stable **`latest`** must not point to this prerelease.

## Current public distribution state

The four lockstep packages are publicly published at `0.86.2-rc.1`:

- `@beemvp/beeui-core`
- `@beemvp/beeui-tokens`
- `@beemvp/beeui-ui`
- `@beemvp/beeui-cli`

The bootstrap publication was executed from exact source SHA
`ddf415b0d665c14e1b154bb02570a906585b4b98` through `.github/workflows/npm-release.yml`, using the protected GitHub `release` environment. The release workflow completed successfully after verifying canonical reproducible tarballs and publishing the package set sequentially under `next` with provenance.

Consumer commands for this RC must opt into the prerelease channel or pin the exact version:

```bash
npm install @beemvp/beeui-ui@next @beemvp/beeui-core@next @beemvp/beeui-tokens@next
npx @beemvp/beeui-cli@next --help
```

Do **not** document bare `npm install @beemvp/beeui-ui` as the recommended RC command, because that resolves `latest` rather than `next`.

## Owner guard

Technical readiness is not publication authorization. No later npm package, staged package or dist-tag may be created or changed until the repository owner explicitly authorizes the corresponding release operation under issue #254 and the protected GitHub `release` environment.

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
| `next` | opt-in release-candidate/safety channel; currently points to `0.86.2-rc.1`, and may point to the fully approved stable `0.86.2` during/after stable promotion |

`latest` is the consumer commit point. Default consumers must not see a stable release until the full four-package stable set has been published and verified.

## First-ever package bootstrap — completed

The one-time bootstrap path for `0.86.2-rc.1` is complete:

1. exact candidate frozen on `main`;
2. exact-head release gates passed;
3. protected `bootstrap-rc` workflow approved through the `release` environment;
4. all four packages published sequentially under `next` with provenance;
5. public package publication succeeded.

The temporary bootstrap token is a compatibility bridge, not the steady-state release credential. After verifying Trusted Publisher configuration for all four packages, revoke the bootstrap token and delete `NPM_BOOTSTRAP_TOKEN` from the GitHub `release` environment.

## Subsequent RC publication

For later `0.86.2-rc.N` versions:

1. freeze an exact `main` SHA with a fresh lockstep RC version;
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

Using `next` for the stable upload phase is intentional: it prevents a partial stable approval from changing the default-install channel.

## Why `latest` promotion is owner-interactive

npm Trusted Publishing/OIDC authenticates supported publish operations but does not replace owner proof-of-presence for every registry mutation. The final `latest` move remains an owner-controlled action so BeeUI does not need a permanent broad write token solely for dist-tag changes.

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
- registry absence of a new candidate version;
- protected release-environment approval.

After publication, additionally record the public package integrity/provenance, dist-tags and clean-consumer result.

## Machine-readable policy contract

The block below is parsed by `scripts/check-distribution-policy.mjs` and feeds the release control plane.

```json dist-tag-policy
{
  "published": true,
  "currentVersion": "0.86.2-rc.1",
  "candidateStableVersion": "0.86.2",
  "prereleaseVersionPattern": "^0\\.86\\.2-rc\\.(0|[1-9][0-9]*)$",
  "prereleaseExample": "0.86.2-rc.1",
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

## Revisit trigger

Revisit this policy if npm expands Trusted Publishing/dist-tag capabilities, a second maintained release line needs another persistent channel, or the CLI leaves the lockstep release group.
