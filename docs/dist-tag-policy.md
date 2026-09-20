# BeeUI npm dist-tag and publication policy

This document is the machine-checked authority for BeeUI npm versioning, staging and dist-tag behavior.

BeeUI 1.0 is the product milestone name. The stable npm package line starts at **`0.86.2`** per ADR-015. The first public release candidate, **`0.86.2-rc.1`**, is published on npm under the opt-in **`next`** dist-tag.

## Real current dist-tag state: `latest` also resolves to the RC

Verified against the live registry (`npm view <package> dist-tags`): `next` and `latest` both currently resolve to `0.86.2-rc.1` for all four packages (`@beemvp/beeui-core`, `@beemvp/beeui-tokens`, `@beemvp/beeui-ui`, `@beemvp/beeui-cli`). This is not a release-process error. The bootstrap publish ran `npm publish --tag next --provenance` for every package (GitHub Actions run 34294238899, 2026-09-09, job `bootstrap-rc`, log line `npm notice Publishing to https://registry.npmjs.org/ with tag next and public access`), and the registry still attached `latest` to that first version alongside `next`: the npm registry requires every package to carry a `latest` tag, so when no earlier version exists it is set on the first publish whatever `--tag` asked for. This document does not rely on removing that tag (whether `npm dist-tag rm <package> latest` is accepted for a package's only version is unverified); `latest` is only ever re-pointed by the deliberate stable publish/promotion described below. Every one of these four packages has exactly one published version today.

This means a bare, unqualified `npm install @beemvp/beeui-ui` currently installs the same `0.86.2-rc.1` artifact as `npm install @beemvp/beeui-ui@next`. Documentation must keep recommending the explicit `@next` tag (or an exact pinned version) anyway, never a bare install — that recommendation is what stays correct across the transition described below, not what is true only today.

**What changes at the first stable `0.86.2` publish:** once the stable release group publishes, `latest` is deliberately moved to point at `0.86.2` (a real, owner-authorized dist-tag operation — see "Stable `0.86.2` publication" below), and it never points at a prerelease again. `next` keeps tracking whatever prerelease is newest (`0.86.2-rc.N`, then later release lines). From that point on, a bare `npm install @beemvp/beeui-ui` installs stable `latest`, and `@next` is required to opt into a prerelease — the behavior the pre-first-publish version of this document assumed applied from day one.

## Current public distribution state

The four release-group packages are public at `0.86.2-rc.1`:

- `@beemvp/beeui-core`
- `@beemvp/beeui-tokens`
- `@beemvp/beeui-ui`
- `@beemvp/beeui-cli`

The bootstrap publication was executed from exact source SHA `ddf415b0d665c14e1b154bb02570a906585b4b98` through `.github/workflows/npm-release.yml`, using the protected GitHub `release` environment. The workflow verified canonical reproducible tarballs and published the set sequentially under `next` with provenance.

Consumer commands for this RC must opt into the prerelease channel or pin the exact version:

```bash
npm install @beemvp/beeui-ui@next @beemvp/beeui-core@next @beemvp/beeui-tokens@next
npx @beemvp/beeui-cli@next --help
```

Do **not** document a bare `npm install @beemvp/beeui-ui` as the recommended RC command. Today an unqualified install happens to resolve to the same RC as `@next` (see "Real current dist-tag state" above), but that coincidence ends the moment stable `0.86.2` publishes and `latest` moves off the prerelease — an explicit `@next` tag or exact pinned version stays correct on both sides of that transition, a bare install does not.

## Owner guard

Technical readiness is not publication authorization. No later npm package, staged package or dist-tag may be created or changed until the repository owner explicitly authorizes the corresponding operation through the protected GitHub `release` environment and the release control plane.

## Package set and lockstep versioning

All four released packages share one version. The three library packages form the package-boundary set used by the public docs foundation; the CLI is modelled separately by the docs generator but its version is locked to the same line by the release control plane.

A prerelease is `0.86.2-rc.N`; the stable version is `0.86.2`. `pnpm release:verify` must prove packed manifests contain the expected version and no unresolved `workspace:*` dependency.

## Persistent dist-tags

BeeUI uses exactly two persistent public dist-tags:

| Tag | Meaning |
| --- | --- |
| `latest` | default-install channel. Today it resolves to `0.86.2-rc.1` because the registry attached `latest` to the first publish alongside the requested `next` tag (evidence above) — not because `latest` was deliberately promoted. Once the stable release group publishes, `latest` moves to the stable version and never points to a prerelease again. |
| `next` | opt-in release-candidate/safety channel; currently points to `0.86.2-rc.1`, same target as `latest` today; keeps tracking future prereleases after the first stable publish. |

`latest` is the intended long-term consumer commit point for stable releases. Default consumers must not see a *deliberately promoted* stable release until the full stable release group has been published and verified — the current first-publish default is a separate, incidental state, not an early promotion.

## First-ever package bootstrap — completed

The one-time bootstrap path for `0.86.2-rc.1` is complete:

1. exact candidate frozen on `main`;
2. exact-head release gates passed;
3. protected `bootstrap-rc` workflow approved through the `release` environment;
4. all four packages published sequentially under `next` with provenance;
5. public package publication succeeded.

After Trusted Publisher configuration is verified for all four packages, revoke the temporary bootstrap token and delete `NPM_BOOTSTRAP_TOKEN` from the GitHub `release` environment.

## Subsequent RC publication

For later `0.86.2-rc.N` versions:

1. freeze an exact `main` SHA with a fresh lockstep RC version;
2. run `stage-rc` from that SHA;
3. CI uses npm Trusted Publishing/OIDC and the approved staged-release path under `next`;
4. the owner reviews/approves the staged package set as required;
5. verify the actual registry artifacts and clean-consumer behavior.

## Stable `0.86.2` publication

Stable publication deliberately separates upload from the default-install `latest` promotion:

1. freeze exact stable `0.86.2` source on `main` and require all release gates to pass;
2. publish/stage the full stable release group under the safe non-default channel according to the release workflow;
3. verify all real registry packages and clean-consumer behavior;
4. only after stable verification is green, move `latest` for the full release group in one coordinated owner-controlled operation — this is the first *deliberate* `latest` dist-tag operation for these packages; the RC-era `latest` value was npm's automatic first-publish default, never an explicit promotion;
5. verify all `latest` tags resolve to the same stable version.

## Failure handling

npm does not provide a cross-package transaction. Safety comes from ordering:

- if an RC operation fails partway, only the opt-in `next` channel may be inconsistent; `latest` is unaffected;
- never overwrite an already-published package version;
- complete a partial set at the same version only when the missing package version is truly absent;
- if a published version is bad, correct forward with a new version and deprecate the bad one rather than treating unpublish as rollback;
- if `latest` is moved incorrectly, restore the complete release group to the last-good stable before doing anything else.

## Candidate and evidence requirements

Before registry mutation, record or verify the exact source SHA, lockstep version, changelog/migration/support status, canonical artifact verification, exact-head CI gates, candidate-version registry state, and protected release-environment approval.

After publication, additionally record the real registry package state, provenance/integrity where available, dist-tags, and clean-consumer result.

## Machine-readable policy contract

The block below is parsed by `scripts/check-distribution-policy.mjs` and feeds the public docs/release control plane. `lockstepPackages` intentionally lists the three library packages consumed as one package boundary; `@beemvp/beeui-cli` is represented separately by the docs foundation and is still version-locked by the release control plane.

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
  "lockstepPackages": ["@beemvp/beeui-core", "@beemvp/beeui-tokens", "@beemvp/beeui-ui"],
  "releaseEnvironment": "release"
}
```

## Revisit trigger

Revisit this policy if npm changes Trusted Publishing/dist-tag capabilities, a second maintained release line needs another persistent channel, or the CLI leaves the release group.
