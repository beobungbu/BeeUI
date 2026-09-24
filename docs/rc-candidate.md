# BeeUI release candidate authority

> **Status:** `0.86.2-rc.3` is the current published BeeUI release candidate (observed 2026-09-24T09:27:49Z: `next` and `latest` → `0.86.2-rc.3` for all four packages).
>
> **Stable package line:** `0.86.2` (ADR-015).
>
> **Prerelease channel:** `0.86.2-rc.N` → `next`; during the `0.86.2` prerelease line `latest` follows the newest complete, verified RC only after the owner moves it for all four packages.

This file records the immutable source candidate, its integration/promotion lineage, the publication workflow identity and the observed npm registry result. Those identities are deliberately separate: registry integrity proves published bytes, while Git/GitHub evidence proves the release lineage.

## Current published candidate — `0.86.2-rc.3`

### Release lineage

| Identity | SHA / run | Meaning |
| --- | --- | --- |
| candidate source | `1110844adec4fbbf6ae73d2f8ed1ed12986a5047` | exact source tree frozen and verified before release-prep-only changes |
| release-prep branch head | `3ccecae3` | evidence-only commit on `release/0.86.2-rc.3` (adds this file's rc.3 freeze section and the prep report) |
| `development` integration | `f6d0d4284e6a3bd319b572772c407132198f314e` | merge of PR #634 into `development` |
| `main` promotion / workflow SHA | `9b1fb095d419198728b6389b55b9e383ba857ae6` | merge of PR #635 and exact `GITHUB_SHA` used by the npm workflow |
| npm release workflow | run `35977601708` | `stage-rc`; `preflight` and `stage-rc` both succeeded |
| registry observation | 2026-09-24T09:02:17Z | read-only post-publication observation by the release controller |

`main@9b1fb09` differs from the candidate source only in `docs/rc-candidate.md` and the preparation report; no package build input changed between the candidate and the published workflow SHA.

### Release artifact identity

The authoritative artifact digests are the canonical + reproducible tarballs produced by the `npm-release` **preflight on the exact `main` workflow SHA** (run `35977601708`, Linux). Those are the bytes that were staged:

| Package | Tarball | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `@beemvp/beeui-core` | `beemvp-beeui-core-0.86.2-rc.3.tgz` | 37,864 | `102b193c490e1da087384b75793f927af37fad7db166dee62b3f8beb9dad5585` |
| `@beemvp/beeui-tokens` | `beemvp-beeui-tokens-0.86.2-rc.3.tgz` | 137,359 | `71ea8ac13225740702a64f8544143eebca308b740391580a8604412e1f450df3` |
| `@beemvp/beeui-ui` | `beemvp-beeui-ui-0.86.2-rc.3.tgz` | 1,017,950 | `30efb68ba7ece3adc4cb97fcb67b657bead7301bd609bfcd4980fdaca5ac332a` |
| `@beemvp/beeui-cli` | `beemvp-beeui-cli-0.86.2-rc.3.tgz` | 280,038 | `cce56ed8a483110f4127ebf6428ded49fed7c4acdc6309de7d04413ee6bc0377` |

**Local, non-authoritative pre-merge build.** At freeze time `pnpm release:verify` also ran on macOS against the candidate source and recorded different bytes. These are a local smoke check only. Tarball bytes are not reproducible across build platforms, so these values were never expected to match the Linux CI build:

| Package | Bytes | SHA-256 (macOS, local) |
| --- | ---: | --- |
| `@beemvp/beeui-core` | 37,917 | `c1d72cd99af538e0154eb7b3495aa97af90d332bcb47a42035fe91b2eb130d72` |
| `@beemvp/beeui-tokens` | 137,590 | `48c02df1864be41807e8b7e7bcf20fbe4a6b32f8edb3773d00652ef506119225` |
| `@beemvp/beeui-ui` | 1,018,481 | `8275dcb91b988b9fc3cdc1ed07a20556e621e9b6a7a31b335af0f0f92ffcad05` |
| `@beemvp/beeui-cli` | 280,039 | `66ff2d83c925564ef2db7e20ecf277d033b53a240bf13a4d5bb49daac3baf209` |

Candidate-to-release identity is established by the build inputs: the candidate → `main` diff touches documentation only. It is not established by comparing tarball bytes across platforms.

Both verifier runs proved the packed manifests contain no unresolved `workspace:` protocol, package exports resolve to shipped files, the four tarballs install into a clean consumer, the CLI binary executes `help` and `list`, and the package set does not pull the Expo runtime.

### Publication path

1. GitHub Actions run `35977601708` ran `stage-rc` from `main@9b1fb095d419198728b6389b55b9e383ba857ae6`.
2. `preflight` verified the exact workflow SHA, lockstep version and release control plane, and produced the authoritative tarballs above.
3. The protected GitHub `release` environment was approved by `beobungbu`.
4. The workflow used npm Trusted Publishing/OIDC and `npm stage publish --access public --tag next --provenance` sequentially for `core` → `tokens` → `ui` → `cli`.
5. The owner approved the four npm staged packages with npm 2FA; this npm-side proof-of-presence gate is distinct from the GitHub Environment approval.
6. Read-only registry observation then verified the public package metadata, provenance and dist-tags.

### Observed npm registry evidence

Post-publication observation, 2026-09-24T09:02:17Z (intermediate record, before the owner's `latest` move):

| Package | `dist.integrity` | `dist.shasum` | `dist.unpackedSize` | Provenance (sigstore logIndex) | `next` | `latest` |
| --- | --- | --- | ---: | ---: | --- | --- |
| `@beemvp/beeui-core@0.86.2-rc.3` | `sha512-6H37vDe8Sp/pbQkkJpyogNqgcq0xBlGjx+4lomH8lANg5zGapmncfdsX27nZ3y1Zj257Fjhyw9KwNqEQmYb1fQ==` | `53bf3df9bd2d568f7958923097f0a3ef7e4cb1fc` | 153625 | 2935188175 | `0.86.2-rc.3` | `0.86.2-rc.1` |
| `@beemvp/beeui-tokens@0.86.2-rc.3` | `sha512-oJpDC2d5OE8aUJkSnvVpOaljizCIrX8N3AK5lLgX5bOeSVMtrEBXKpXgnui4VVJnyEUh6AUsEOVPAhQhYANNSw==` | `e8cd99871163245317b001a6ee45b417f8bdab8f` | 591601 | 2935189814 | `0.86.2-rc.3` | `0.86.2-rc.1` |
| `@beemvp/beeui-ui@0.86.2-rc.3` | `sha512-uoNqUlEVnQfjhjdY8e8DB8M1KHtw0QUbXqIqtEVAqRXmjc+SmszgS2VzUQuaPSnz+9v0FhA2LvJWJhmcGwJf8A==` | `5744e25f60819404d8386fd55ababe012756362d` | 4119746 | 2935190628 | `0.86.2-rc.3` | `0.86.2-rc.1` |
| `@beemvp/beeui-cli@0.86.2-rc.3` | `sha512-sJadsm06euJoE+gq7tR70UdoVUCSXVV6+HTb6kTnBL0w2yMiSi23rzvy3k1F/xyJLBc6PXoWtZFdDAoHAdJsiQ==` | `d9f5ab8764313ee8d4715fd427be8430fc9b7047` | 1112301 | 2935191279 | `0.86.2-rc.3` | `0.86.2-rc.1` |

The observed public state is complete, not `partial-publication`: all four package versions exist and all four `next` tags agree on `0.86.2-rc.3`. `latest` was still on `0.86.2-rc.1` for all four packages at that time.

### `latest` move

Under the owner decision of 2026-09-24 (issue #561), the owner moved `latest` for all four packages to `0.86.2-rc.3` with npm 2FA after the four-package set was published and verified. The release workflow did not touch dist-tags.

Controller observation at 2026-09-24T09:27:49Z (registry cache bypassed):

| Package | `next` | `latest` |
| --- | --- | --- |
| `@beemvp/beeui-core` | `0.86.2-rc.3` | `0.86.2-rc.3` |
| `@beemvp/beeui-tokens` | `0.86.2-rc.3` | `0.86.2-rc.3` |
| `@beemvp/beeui-ui` | `0.86.2-rc.3` | `0.86.2-rc.3` |
| `@beemvp/beeui-cli` | `0.86.2-rc.3` | `0.86.2-rc.3` |

An untagged `npm install @beemvp/beeui-ui @beemvp/beeui-core @beemvp/beeui-tokens` resolved `0.86.2-rc.3`, and `npx @beemvp/beeui-cli version` printed `0.86.2-rc.3`. All four `latest` tags agree, so there is no split `latest` state.

### Clean public consumption

Against the public registry: `npm install` of `@beemvp/beeui-ui`, `@beemvp/beeui-core` and `@beemvp/beeui-tokens` at `@0.86.2-rc.3` succeeded; `npx @beemvp/beeui-cli@0.86.2-rc.3 --help` and `list` succeeded; `npm audit signatures` reported 227 verified registry signatures and 59 verified attestations.

### Exact-head CI evidence

- PR #634 (`release/0.86.2-rc.3` → `development`, head `3ccecae3`): every PR check passed — `classify`, `verify` (fast/docs/runtime/tokens/release/release-prep/benchmark), `web-a11y`, `visual-web-report`, `web-consumer`, `expo-consumer`, `bare-consumer`, `build-and-local-smoke`, iOS/Android native compile.
- Post-merge `development@f6d0d428`: `beeui-environment-ci` run `35972480966`, `ci`, `visual-web`, `web-a11y`, `expo-consumer`, `web-consumer`, `beeui-web` all success.
- PR #635 (`development` → `main`, head `f6d0d428`): all required `main` checks passed, including the full `visual-web-full` matrix (canonical-and-smoke, showcase-integration, showcase-acceptance-matrix) and `environment-ci`.
- Post-merge `main@9b1fb095`: `ci`, `visual-web`, `web-a11y`, `expo-consumer`, `web-consumer`, `beeui-web` success; the npm release workflow reran the release control-plane checks and `pnpm release:verify` at this exact SHA (run `35977601708`).
- Not green on `main@9b1fb095`: `native-runtime-smoke` run `35977572695` — attempt 1 failed on iOS (`"Runtime toast" is visible`) and Android (`showcase-home` not visible); attempt 2 passed Android and failed iOS earlier at `runtime-ready`, so the iOS runtime smoke is recorded as unresolved evidence, not a pass. `beeui-web-delivery` run `35978847317` uploaded the Worker and assets for `9b1fb095` but failed updating the zone's Workers route (`No access to the specified resource`), a Cloudflare token-permission issue outside the package artifacts. Before the PR was opened, locally on the candidate tree: `pnpm typecheck` exit 0; `pnpm lint` exit 0; `pnpm test` exit 0 (1012 node:test cases and 1259 Jest tests in 146 suites, 0 failures).

Runtime workflows that were skipped by their own change/schedule/label contract remain skipped evidence, not passes. The iOS `pageSheet` / `formSheet` presentation surface remains **EXPERIMENTAL**; native runtime smoke for `Sheet` is wired for iOS only, and Android smoke and a real-device run remain open.

## Previous candidate — `0.86.2-rc.2`

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

`pnpm release:verify` passed for the frozen candidate and recorded these candidate tarballs (local macOS build; see the correction below):

| Package | Tarball | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `@beemvp/beeui-core` | `beemvp-beeui-core-0.86.2-rc.2.tgz` | 36,709 | `77d7c7a41a7dd3dfd14f1346eea9f5c0d93f54f4fed89ccce7a856325b4717d1` |
| `@beemvp/beeui-tokens` | `beemvp-beeui-tokens-0.86.2-rc.2.tgz` | 137,593 | `5b48a4156cc5e17062ed68f0a08c35b52232733f5ab364767cb6857bc3309c02` |
| `@beemvp/beeui-ui` | `beemvp-beeui-ui-0.86.2-rc.2.tgz` | 974,335 | `e12143818eeff8da271a24d08cf310f57eacef9c35fd3b036616b2c9d679ec7c` |
| `@beemvp/beeui-cli` | `beemvp-beeui-cli-0.86.2-rc.2.tgz` | 269,202 | `64c0a2d8d39ef40bfa5b11790edbc5875c05c335a788809e173f27538ffe3aec` |

These candidate SHA-256 values are source/release-verification evidence. They are not a substitute for npm's post-publication `dist.integrity`/`dist.shasum` evidence below.

**Correction (recorded 2026-09-24).** The table above came from a local macOS `pnpm release:verify` run. It is a non-authoritative pre-merge smoke build and does not match the Linux CI build: tarball bytes are not reproducible across build platforms. The authoritative rc.2 artifact digests are the ones produced by the `npm-release` preflight on the exact `main` workflow SHA (run `35846285677`). Those are the bytes that were staged:

| Package | Bytes | SHA-256 (CI preflight, authoritative) |
| --- | ---: | --- |
| `@beemvp/beeui-core` | 36,654 | `d5aa2f83dc512ea637a16f3e951b3bfff9890403b6c83ba827f1517c05e366c2` |
| `@beemvp/beeui-tokens` | 137,359 | `7a62fd30b449223dd7f0a952a202a5520ca0b311f7175d5551c5aa750d78b6e6` |
| `@beemvp/beeui-ui` | 973,982 | `0f979ce344dabffdf56d9c47bb0104cfbca57149df26da1f6c9847d5506d3e5d` |
| `@beemvp/beeui-cli` | 268,532 | `85839128a4dc26587968427f6ec536d51e5e6fcf636be5d1cfd2a4ef0cea92f0` |

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
3. `pnpm release:verify` passes; the authoritative artifact digests are retained from the CI preflight on the exact `main` workflow SHA (a local build is a smoke check, and candidate-to-release identity is proven by a documentation-only candidate → `main` diff, not by cross-platform byte comparison);
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
