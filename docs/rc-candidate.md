# BeeUI release candidate authority

> **Status:** `0.86.2-rc.2` is the current published BeeUI release candidate; `0.86.2-rc.3` is the prepared next candidate (not yet published).
>
> **Stable package line:** `0.86.2` (ADR-015).
>
> **Prerelease channel:** `0.86.2-rc.N` → `next`; during the `0.86.2` prerelease line `latest` follows the newest complete, verified RC only after the owner moves it for all four packages.

This file records the immutable source candidate, its integration/promotion lineage, the publication workflow identity and the observed npm registry result. Those identities are deliberately separate: registry integrity proves published bytes, while Git/GitHub evidence proves the release lineage.

## Current published candidate — `0.86.2-rc.2`

### Release lineage

| Identity | SHA / run | Meaning |
| --- | --- | --- |
| candidate source | `a58d8b83977f364bb141351f86b61e8b477602bd` | exact source tree frozen and verified before release-prep-only changes |
| release-prep branch head | `3a5b30d85d3b43d707c2d0171a2a672e1541614c` | PR #622 head with release metadata/version preparation |
| `development` integration | `292b0a7bc773d76a03c3e86fe44ba64c65f84531` | merge of #622 into `development` |
| `main` promotion / workflow SHA | `cd07c671a0814cdcf8a9809fa1c414276acf5bdc` | merge of #624 and exact `GITHUB_SHA` used by the npm workflow |
| npm release workflow | run `35846285677` | `stage-rc`; preflight and staging both passed |
| registry observation | run `35848833210` | read-only post-publication `npm view` observation |

PR #624 was the reviewed `development` → `main` promotion. The release workflow was dispatched from the exact promoted `main` SHA above.

### Candidate artifact identity

`pnpm release:verify` passed for the frozen candidate and recorded these canonical/reproducible candidate tarballs:

| Package | Tarball | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `@beemvp/beeui-core` | `beemvp-beeui-core-0.86.2-rc.2.tgz` | 36,709 | `77d7c7a41a7dd3dfd14f1346eea9f5c0d93f54f4fed89ccce7a856325b4717d1` |
| `@beemvp/beeui-tokens` | `beemvp-beeui-tokens-0.86.2-rc.2.tgz` | 137,593 | `5b48a4156cc5e17062ed68f0a08c35b52232733f5ab364767cb6857bc3309c02` |
| `@beemvp/beeui-ui` | `beemvp-beeui-ui-0.86.2-rc.2.tgz` | 974,335 | `e12143818eeff8da271a24d08cf310f57eacef9c35fd3b036616b2c9d679ec7c` |
| `@beemvp/beeui-cli` | `beemvp-beeui-cli-0.86.2-rc.2.tgz` | 269,202 | `64c0a2d8d39ef40bfa5b11790edbc5875c05c335a788809e173f27538ffe3aec` |

These candidate SHA-256 values are source/release-verification evidence. They are not a substitute for npm's post-publication `dist.integrity`/`dist.shasum` evidence below.

The verifier also proved that packed manifests contain no unresolved `workspace:` protocol, package exports resolve to shipped files, all four tarballs install into a clean consumer, the CLI binary executes `help` and `list`, and the package set does not pull the Expo runtime.

### Publication path

`0.86.2-rc.2` used the steady-state protected staged-publishing path:

1. GitHub Actions run `35846285677` ran `stage-rc` from `main@cd07c671a0814cdcf8a9809fa1c414276acf5bdc`.
2. `preflight` verified the exact workflow SHA, lockstep version and release control plane.
3. The protected GitHub `release` environment was approved.
4. The workflow used npm Trusted Publishing/OIDC and `npm stage publish --access public --tag next --provenance` sequentially for `core` → `tokens` → `ui` → `cli`.
5. The owner approved the npm staged packages; this npm-side proof-of-presence gate is distinct from the GitHub Environment approval.
6. Read-only registry observation then verified the public package metadata and dist-tags.

Stage IDs:

| Package | npm stage ID |
| --- | --- |
| `@beemvp/beeui-core` | `b6399036-e1bb-466a-adbf-8aa4be1fad31` |
| `@beemvp/beeui-tokens` | `0b773fcb-3a46-48f8-a91d-bb67d2bbe243` |
| `@beemvp/beeui-ui` | `06f1d318-fabe-4ceb-ab57-ba041ce8d8b5` |
| `@beemvp/beeui-cli` | `24ba08d3-7be1-4639-8d2f-0ba39a8c89bf` |

### Observed npm registry evidence

The following values were read from the live npm registry in read-only GitHub Actions run `35848833210` on 2026-09-23. The temporary probe workflow was removed after the observation; it is not part of the release control plane.

| Package | `dist.integrity` | `dist.shasum` | `dist.unpackedSize` | `next` | `latest` |
| --- | --- | --- | ---: | --- | --- |
| `@beemvp/beeui-core@0.86.2-rc.2` | `sha512-8xoWK9xJl4u4Zz0c0oyBc/yOk7F4HdhmL0QnE4gUYTfLrndMwjUSqoixrckmD9qAE6FTkt0+8DGnjEcQx92wrQ==` | `a7ca1d97232de11833022c8f57696b8828a007ec` | 151022 | `0.86.2-rc.2` | `0.86.2-rc.1` |
| `@beemvp/beeui-tokens@0.86.2-rc.2` | `sha512-2Q3F7FIg+Vw97+FOC2hUBmZi9vfTsGfcbvEAO9IjB4RDve0Yrx8OTHjpYH+L3SYgoeOqnsfcN5sHxzvJxIvlhw==` | `8a615875d64e0e8a9f9c9a3418b1caa576db5189` | 591567 | `0.86.2-rc.2` | `0.86.2-rc.1` |
| `@beemvp/beeui-ui@0.86.2-rc.2` | `sha512-R+7fNTmg/yF28CYkRbJZNL/ynjHBxyijU3/K8Bdl1+AyYZ0YCYgDQvQY8h3q5PauPRqcmWK2dTaW8tg5n8yXPw==` | `31c500ac9105fade1040b8181f1a638eb7341311` | 3981958 | `0.86.2-rc.2` | `0.86.2-rc.1` |
| `@beemvp/beeui-cli@0.86.2-rc.2` | `sha512-3x5AOpVc7UYLZQzIFrFCjtDTnUO13Po/8peLHHdi5G5LsasVDFvwY0vOBC1HdFFbe66CtcVtdWXnLES53FLktQ==` | `d7b5bb184ebd5cfc0c914012484b90c6789c259a` | 1078532 | `0.86.2-rc.2` | `0.86.2-rc.1` |

All four registry entries reported repository URL `git+https://github.com/beobungbu/BeeUI.git`.

The observed public state is therefore complete, not `partial-publication`: all four package versions exist and all four `next` tags agree on `0.86.2-rc.2`.

### Exact-head CI evidence

The rc.2 release-prep/promotion path completed the required package, docs, Web, accessibility, clean-consumer and native compile gates before publication. The npm release workflow then reran the release control-plane checks and `pnpm release:verify` at the exact publication workflow SHA.

Runtime workflows that were skipped by their own change/schedule/label contract remain skipped evidence, not passes. The iOS `pageSheet` / `formSheet` presentation surface remains **EXPERIMENTAL** under the existing native-evidence contract.

## Previous candidate — `0.86.2-rc.1` (historical bootstrap)

`0.86.2-rc.1` remains public but is no longer the `next` target. Its lineage is retained because the one-time bootstrap publication used a different authorization path:

- candidate source SHA: `58d038dfd63267a0760b6eb1b5749e96939edb28`;
- `development` integration SHA: `0b46eac123a91e509570380124f400aa27369822`;
- ancestry-only main sync from the original candidate path: `11c357188282d0d872902b0b5bf4b82e9568000d` via #529;
- actual bootstrap publish workflow SHA: `ddf415b0d665c14e1b154bb02570a906585b4b98`;
- publish workflow run: `34294238899`, job `bootstrap-rc`;
- transport: temporary environment-scoped `NPM_BOOTSTRAP_TOKEN` plus provenance.

The candidate source SHA and the later workflow/publish SHA must not be collapsed into one value. `ddf415b0...` proves which repository state the publish workflow checked out; it does not retroactively redefine the original candidate source SHA.

The bootstrap-token path is historical. Later RCs use Trusted Publishing/OIDC staged publishing.

## Superseded evidence

The former candidate `5cb061f60df312e04036c1f6108ef0f099307bd9` encoded the old `0.1.0` package version and is historical only. The later date-version proposal `20260902.0.0` was never published and is superseded by ADR-015.

BeeUI 1.0 is the product milestone name; the stable npm version for this line is `0.86.2`.

## Candidate-freeze rule

A new public prerelease candidate is frozen only when:

1. one exact candidate source is identified;
2. the package set has one lockstep `0.86.2-rc.N` version;
3. `pnpm release:verify` passes and canonical candidate artifact digests are retained;
4. required CI evidence is green or explicitly classified by the release contract;
5. release-prep, integration, main-promotion and workflow identities remain separately traceable;
6. owner authorization remains separate from technical readiness;
7. after publication, real registry metadata and dist-tags are observed rather than inferred.

## Publication channels

- `0.86.2-rc.N` → `next`.
- during the `0.86.2` prerelease line, `latest` → the newest complete, verified RC, moved by the owner for all four packages in one 2FA operation after publication and verification, then observed and recorded here.
- stable `0.86.2` is staged/verified as a complete set before owner-controlled promotion to `latest`.
- package staging order is `core` → `tokens` → `ui` → `cli`.
- npm package versions are immutable; never overwrite an already-published version.

## Current package set

- `@beemvp/beeui-core`
- `@beemvp/beeui-tokens`
- `@beemvp/beeui-ui`
- `@beemvp/beeui-cli` (`beeui` binary)

## References

- `docs/release.md`
- `docs/dist-tag-policy.md`
- `docs/decisions/015-package-version-0-86-2.md`
- `docs/beeui-1.0-owner-gates.md`
- `docs/rc-ci-matrix.md`
- `docs/rollback-runbook.md`
