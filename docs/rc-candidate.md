# BeeUI release candidate authority

> **Status:** `0.86.2-rc.1` is frozen as the first npm release candidate; no public npm package has been published yet.
>
> **Stable package line:** `0.86.2` (ADR-015).
>
> **Prerelease channel:** `0.86.2-rc.N` → `next` only after explicit owner authorization.

This file is the human release-candidate authority for BeeUI. It intentionally does **not** reuse the historical `5cb061f` / `0.1.0` evidence set: that candidate predates ADR-015 and later package/runtime fixes and is not publishable as the current package set.

## Frozen candidate — `0.86.2-rc.1`

The first current-line RC is frozen from exact verified source SHA:

- candidate source SHA: `58d038dfd63267a0760b6eb1b5749e96939edb28`;
- lockstep package version: `0.86.2-rc.1`;
- PR: #528 (`release/0.86.2-rc.1` → `development`);
- integration merge SHA: `0b46eac123a91e509570380124f400aa27369822`;
- ancestry-only `main` sync SHA: `11c357188282d0d872902b0b5bf4b82e9568000d` via #529;
- #529 changed zero files; neither integration commit changed package/runtime contents relative to the verified candidate tree.

Any package/CLI/registry/token source change after this freeze invalidates `0.86.2-rc.1` and requires a new `rc.N`. Evidence-only documentation may describe this frozen source candidate without changing the candidate package contents.

### Release artifact identity

`pnpm release:verify` passed for the exact candidate source and the retained release-verification report recorded these fresh `pnpm pack` artifacts:

| Package | Tarball | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `@beemvp/beeui-core` | `beemvp-beeui-core-0.86.2-rc.1.tgz` | 26,727 | `e136d987d4742d1aef21c441a01ee855c74f66d5cb03457683d9cea58d34944a` |
| `@beemvp/beeui-tokens` | `beemvp-beeui-tokens-0.86.2-rc.1.tgz` | 101,225 | `3c775837fd28299df5b35d47e5f18781bb61a2edc0254d57a0320ba61507a65a` |
| `@beemvp/beeui-ui` | `beemvp-beeui-ui-0.86.2-rc.1.tgz` | 554,388 | `75b89707af5860dd8a5ae3bf025f13e02ae48a226869fa1bb51b6936ea7aa32b` |
| `@beemvp/beeui-cli` | `beemvp-beeui-cli-0.86.2-rc.1.tgz` | 201,500 | `c53404a57528c5c6e936cbf604b54e40bece773b3b70dbb2c390468c02122d5e` |

The verifier also proved the packed manifests contain no unresolved `workspace:` protocol, package exports resolve to shipped files, the four tarballs install into a clean consumer, the CLI binary executes `help` and `list`, and the package set does not pull the Expo runtime.

### Exact-head CI evidence

For candidate SHA `58d038dfd63267a0760b6eb1b5749e96939edb28`:

- primary `ci` workflow: **PASS**;
- aggregate `verify` fan-in: **PASS**;
- `verify-fast`: **PASS**;
- `verify-docs`: **PASS**;
- `verify-runtime`: **PASS**;
- `verify-release`: **PASS**;
- `verify-tokens`: **PASS**;
- `verify-benchmark`: **PASS**;
- bare React Native consumer bundle: **PASS**;
- Android native compile: **PASS**;
- iOS native compile for Showcase and bare consumer: **PASS**;
- Expo consumer workflow: **PASS**;
- Web consumer workflow: **PASS**;
- Web accessibility workflow: **PASS**;
- visual Web workflow: **PASS**;
- public BeeUI Web workflow: **PASS**.

The separate `native-runtime-smoke` workflow was skipped by its own change/schedule contract; this is not treated as a pass. Runtime/device dimensions that require scheduled/live-device evidence remain governed by `docs/rc-ci-matrix.md` and the experimental/quarantine rules below.

### Publication / provenance state

At freeze time:

- npm scope `@beemvp` exists and the owner account has 2FA enabled;
- GitHub `release` environment exists with owner review protection;
- the RC workflow is manual-only and registry mutation is restricted to `main`;
- package manifests request public access and provenance;
- first publication uses `bootstrap-rc` with the temporary environment-scoped `NPM_BOOTSTRAP_TOKEN` under `next`;
- after packages exist, each package still needs its npm Trusted Publisher binding to `beobungbu/BeeUI`, workflow `npm-release.yml`, environment `release` before `stage-rc` can replace the bootstrap path;
- the temporary bootstrap token must then be revoked and removed;
- no package or dist-tag has been created or moved yet.

Registry mutation remains blocked until the repository owner explicitly authorizes publication under issue #254.

### Experimental / quarantined runtime dimension

The iOS `pageSheet` / `formSheet` presentation surface remains **EXPERIMENTAL** for the 1.0 product milestone. Compile and deterministic evidence do not claim full live-device placement/swipe parity. Its quarantine does not convert unverified device behavior into a pass.

## Superseded evidence

The former candidate at `5cb061f60df312e04036c1f6108ef0f099307bd9` proved an earlier release-verification path, but its tarballs encoded the old `0.1.0` package version. It remains useful only as historical evidence. It MUST NOT be published, promoted, or described as the current BeeUI npm candidate.

The later date-version proposal `20260902.0.0` was also never published and is superseded by ADR-015. BeeUI 1.0 is the product milestone name; the stable npm package version is `0.86.2`.

## Candidate-freeze rule

A public prerelease candidate is frozen only after all of the following are true on one reviewed source candidate:

1. the release-control-plane and package manifests agree on one lockstep `0.86.2-rc.N` version;
2. `pnpm release:verify` passes from that exact source;
3. release-equivalent tarballs are rebuilt from source and their SHA-256 values are retained;
4. required Web, clean-consumer, Android/native compile and iOS/native evidence is green for the exact candidate or explicitly classified by the release contract;
5. `CHANGELOG.md`, migration/support documentation, distribution policy and npm workflow all describe the same version authority;
6. no superseded package scope or old package-version authority remains in an active release path;
7. registry mutation remains separately gated by explicit owner authorization.

## Publication channels

- `0.86.2-rc.N` → `next` only.
- stable `0.86.2` is staged under `next`, verified as a complete four-package set, then promoted to `latest` only by the owner after verification.
- package publication order is `core` → `tokens` → `ui` → `cli`.
- npm package versions are immutable; never attempt to overwrite an already-published version.

## Current package set

- `@beemvp/beeui-core`
- `@beemvp/beeui-tokens`
- `@beemvp/beeui-ui`
- `@beemvp/beeui-cli` (`beeui` binary)

All four release together on one lockstep version.

## References

- `docs/release.md`
- `docs/dist-tag-policy.md`
- `docs/decisions/015-package-version-0-86-2.md`
- `docs/beeui-1.0-owner-gates.md`
- `docs/rc-ci-matrix.md`
- `docs/rollback-runbook.md`
- issue #205
- issue #254
