# BeeUI npm dist-tag and publication policy

This document is the machine-checked authority for BeeUI npm versioning, staging and dist-tag behavior.

## Current public state

<!-- release-status:generated:start — written by `pnpm release-status:generate`; do not hand-edit between these markers. -->
BeeUI `0.86.2-rc.3` is public on npm under the opt-in `next` dist-tag (observed 2026-09-25T06:25:18.371Z). `latest` currently resolves to `0.86.2-rc.3` and lags `next` until the owner moves it for all four packages.
<!-- release-status:generated:end -->

The tag state above is observed registry evidence (`docs/registry-observation.json`, refreshed by `pnpm registry:observe`), not an inference from the publish command or the owner's intent. Full per-package integrity/shasum evidence and the history of prior observations (including the intermediate 2026-09-24T09:02:17Z observation before the owner's `latest` move) are retained in `docs/rc-candidate.md`. Consumer documentation still uses `@next` or an exact RC version, because `latest` lags `next` after every future RC publication until the owner moves it.

BeeUI 1.0 is the product milestone name. The stable npm package line is **`0.86.2`** per ADR-015.

## Release group

The public lockstep release group is:

- `@beemvp/beeui-core`
- `@beemvp/beeui-tokens`
- `@beemvp/beeui-ui`
- `@beemvp/beeui-cli`

Recommended prerelease consumption:

```bash
npm install @beemvp/beeui-ui@next @beemvp/beeui-core@next @beemvp/beeui-tokens@next
npx @beemvp/beeui-cli@next --help
```

Do not recommend an unqualified install for RC consumers. It resolves through `latest`, which lags `next` between an RC publication and the owner's `latest` move (see [`latest` during the `0.86.2` prerelease line](#latest-during-the-0862-prerelease-line)). At the 2026-09-24T09:27:49Z observation both `latest` and `next` were on `0.86.2-rc.3`.

## Publication history and authority

### `0.86.2-rc.1` — bootstrap release

The first package publication used the one-time bootstrap path. Important provenance identities are deliberately separated:

- candidate source SHA: `58d038dfd63267a0760b6eb1b5749e96939edb28`;
- publish workflow `GITHUB_SHA`: `ddf415b0d665c14e1b154bb02570a906585b4b98`;
- publish workflow run: `34294238899` (`bootstrap-rc`);
- transport: temporary environment-scoped npm bootstrap token plus provenance.

The bootstrap token path is historical. It is not the steady-state release mechanism.

### `0.86.2-rc.2` — Trusted Publishing / staged release

The second RC used the steady-state staged path:

- candidate source SHA: `a58d8b83977f364bb141351f86b61e8b477602bd`;
- release-prep branch head: `3a5b30d85d3b43d707c2d0171a2a672e1541614c`;
- `development` integration SHA: `292b0a7bc773d76a03c3e86fe44ba64c65f84531`;
- `main` promotion / publish workflow SHA: `cd07c671a0814cdcf8a9809fa1c414276acf5bdc`;
- GitHub Actions run: `35846285677` (`stage-rc`);
- transport: npm Trusted Publishing/OIDC with `npm stage publish --tag next --provenance`;
- final registry exposure: owner approval of the npm staged packages.

The four npm stage IDs were:

| Package | Stage ID |
| --- | --- |
| `@beemvp/beeui-core` | `b6399036-e1bb-466a-adbf-8aa4be1fad31` |
| `@beemvp/beeui-tokens` | `0b773fcb-3a46-48f8-a91d-bb67d2bbe243` |
| `@beemvp/beeui-ui` | `06f1d318-fabe-4ceb-ab57-ba041ce8d8b5` |
| `@beemvp/beeui-cli` | `24ba08d3-7be1-4639-8d2f-0ba39a8c89bf` |

### `0.86.2-rc.3` — Trusted Publishing / staged release

- candidate source SHA: `1110844adec4fbbf6ae73d2f8ed1ed12986a5047`;
- release-prep branch head: `3ccecae3` (evidence only);
- `development` integration SHA: `f6d0d4284e6a3bd319b572772c407132198f314e` (PR #634);
- `main` promotion / publish workflow SHA: `9b1fb095d419198728b6389b55b9e383ba857ae6` (PR #635);
- GitHub Actions run: `35977601708` (`stage-rc`);
- transport: npm Trusted Publishing/OIDC with `npm stage publish --tag next --provenance`;
- final registry exposure: owner approval of the four npm staged packages with npm 2FA.

Registry metadata, provenance log indexes and the authoritative CI artifact digests are recorded in `docs/rc-candidate.md`.

GitHub Environment approval and npm staged-package approval are distinct gates. OIDC authorizes staging; it does not turn the protected GitHub environment approval into npm-side approval.

## Persistent dist-tags

BeeUI uses exactly two persistent public dist-tags. The current observed target of each is stated
in ["Current public state"](#current-public-state) above and in `docs/registry-observation.json`;
this table records their durable meaning, not a point-in-time value:

| Tag | Meaning |
| --- | --- |
| `latest` | default-install channel; during the `0.86.2` prerelease line it follows the newest complete, verified RC once the owner moves it; at stable promotion it moves to `0.86.2` |
| `next` | opt-in release-candidate channel; tracks the newest published RC |

When stable `0.86.2` is ready, it is staged under the safe non-default path, verified as a complete four-package set, and only then is `latest` moved to `0.86.2` in one coordinated owner-controlled operation.

## `latest` during the `0.86.2` prerelease line

Owner decision recorded 2026-09-24 (issue #561): until stable `0.86.2` is promoted, `latest` follows the newest **complete, verified** RC.

- The owner moves `latest` only after the whole four-package set of that RC is published (all four staged packages approved) and verified: registry metadata observed and clean public consumption green.
- The move covers all four packages in one owner-controlled operation with npm 2FA:

  ```bash
  npm dist-tag add @beemvp/beeui-core@<version> latest
  npm dist-tag add @beemvp/beeui-tokens@<version> latest
  npm dist-tag add @beemvp/beeui-ui@<version> latest
  npm dist-tag add @beemvp/beeui-cli@<version> latest
  ```

- The owner then runs `pnpm registry:observe` to record the four `latest` tags in `docs/registry-observation.json` (which regenerates the "Current public state" block above via `pnpm release-status:generate`) and in `docs/rc-candidate.md`. Until that observation is recorded, documentation states the last recorded observation, not the intended target.
- `latest` never points at a partial set. If only some of the four moves succeed, the owner completes or reverts the remaining moves in the same session so all four `latest` tags agree.
- The `npm-release` workflow never mutates dist-tags; the `latest` move is an owner proof-of-presence operation for RCs exactly as for stable (`docs/npm-release-bootstrap.md`).
- Stable `0.86.2` still moves `latest` to `0.86.2` at stable promotion, after which `latest` only ever points at a stable version.
- Consumer documentation keeps recommending `@next` or an exact version for RCs, because `latest` lags `next` between an RC publication and the owner's move.

## Owner guard

Technical readiness is not publication authorization. Creating staged packages, approving staged packages, publishing versions, or mutating dist-tags remains owner-controlled through the release control plane. Contributor/agent work may prepare and verify artifacts but must not bypass these gates.

## Package set and lockstep versioning

All four released packages share one version. A prerelease is `0.86.2-rc.N`; stable is `0.86.2`.

`pnpm release:verify` must prove packed manifests contain the expected lockstep version, exports resolve to shipped files, and no unresolved `workspace:*` dependency remains.

## Subsequent RC publication

For a later `0.86.2-rc.N`:

1. freeze an exact source candidate;
2. integrate it through `development` and promote the reviewed release state to `main`;
3. run `stage-rc` on that exact `main` workflow SHA;
4. GitHub Actions stages the canonical package set sequentially using Trusted Publishing/OIDC and provenance under `next`;
5. the owner approves the staged npm packages;
6. dispatch the `registry-observe` workflow (or run `pnpm registry:observe` locally) to observe the real registry state — version, integrity, shasum, unpacked size, repository metadata and dist-tags — into `docs/registry-observation.json`, and merge the PR it opens into `development`;
7. verify clean public consumption;
8. once the complete four-package set is published and verified, the owner moves `latest` for all four packages to that RC in one operation (`npm dist-tag add @beemvp/beeui-<pkg>@<version> latest` ×4, npm 2FA);
9. dispatch `registry-observe` again (or run `pnpm registry:observe` locally) to observe the four `latest` tags, merge the resulting PR, and separately record them in `docs/rc-candidate.md`.

Do not infer publication merely because the stage workflow succeeded, and do not infer the `latest` move from the owner's intent: record it only after observing it.

## Stable `0.86.2` publication

Stable publication deliberately separates upload from default-channel promotion:

1. freeze exact stable `0.86.2` source on `main` and require release gates to pass;
2. stage the full stable release group under the safe non-default channel;
3. approve and verify all four real registry packages and clean-consumer behavior;
4. only then move `latest` for all four packages to `0.86.2` in one owner-controlled operation;
5. verify all `latest` tags resolve to the same stable version;
6. dispatch the `registry-observe` workflow (or run `pnpm registry:observe` locally) to record the stable observation in `docs/registry-observation.json` and merge the PR it opens into `development`.

## Failure handling

npm does not provide a cross-package transaction. Safety comes from ordering and explicit state:

- before approval, staged packages are not public registry evidence;
- while only part of a four-package set is public, record `partial-publication` rather than claiming release success;
- never overwrite an already-published package version;
- complete a partial set at the same version only when the missing package version is truly absent;
- correct a bad immutable version forward with a new version and deprecate the bad one where appropriate;
- if a dist-tag is moved incorrectly, restore the complete release group to the last-good target before proceeding.

## Evidence requirements

Before registry mutation, record the candidate source SHA, release-prep/integration/promotion identities, lockstep version, artifact verification, exact-head CI and owner authorization boundary.

After publication, additionally record:

- public version for every package;
- full `dist.integrity`;
- `dist.shasum`;
- `dist.unpackedSize`;
- repository metadata;
- observed dist-tags;
- publication workflow run and workflow `GITHUB_SHA`;
- clean-consumer result.

Registry integrity identifies published bytes. It does **not** by itself prove which Git commit produced those bytes; source/promotion/workflow lineage is separate evidence.

## Machine-readable policy contract

The block below is parsed by the release/public-doc control plane. It carries policy only —
dist-tag names, the stable release line, lockstep package names and the release environment.
The current lockstep version and the derived prerelease pattern are not authored here:
`packages/ui/package.json` is the single authored current version (see "Package set and
lockstep versioning" above), and the prerelease pattern is derived from `candidateStableVersion`.
Publication state and observed dist-tags are not authored here either: `docs/registry-observation.json`
(written only by `pnpm registry:observe`, never hand-edited) is the single committed registry
observation, and `scripts/release-status-lib.mjs` derives `published`/the release state from it plus
the workspace version. Authoring `currentVersion`, `prereleaseExample`, `prereleaseVersionPattern`,
`published` or `observedDistTags` in this block is rejected with an actionable error, so a stale
duplicate pin cannot silently reappear.

```json dist-tag-policy
{
  "candidateStableVersion": "0.86.2",
  "distTags": ["latest", "next"],
  "prereleaseDistTag": "next",
  "stableDistTag": "latest",
  "stablePromotionTag": "latest",
  "lockstepPackages": ["@beemvp/beeui-core", "@beemvp/beeui-tokens", "@beemvp/beeui-ui"],
  "releaseEnvironment": "release"
}
```

## Revisit trigger

Revisit this policy if npm changes Trusted Publishing/staged-publishing/dist-tag capabilities, a second maintained release line needs another persistent channel, or the CLI leaves the lockstep release group.
