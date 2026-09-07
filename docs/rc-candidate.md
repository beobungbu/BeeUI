# BeeUI release candidate authority

> **Status:** candidate preparation in progress; no public npm package has been published.
>
> **Stable package line:** `0.86.2` (ADR-015).
>
> **Prerelease naming:** `0.86.2-rc.N`, published only under `next` after owner authorization.

This file is the human release-candidate authority for BeeUI. It intentionally does **not** reuse the historical `5cb061f` / `0.1.0` evidence set: that candidate predates ADR-015 and later package/runtime fixes and is not publishable as the current package set.

## Superseded evidence

The former candidate at `5cb061f60df312e04036c1f6108ef0f099307bd9` proved an earlier release-verification path, but its tarballs encoded the old `0.1.0` package version. It remains useful only as historical evidence. It MUST NOT be published, promoted, or described as the current BeeUI npm candidate.

The later date-version proposal `20260902.0.0` was also never published and is superseded by ADR-015. BeeUI 1.0 is the product milestone name; the stable npm package version is `0.86.2`.

## Current candidate-freeze rule

A public prerelease candidate is frozen only after all of the following are true on one integrated source SHA:

1. the release-control-plane and package manifests agree on one lockstep `0.86.2-rc.N` version;
2. `pnpm release:verify` passes from that exact source;
3. release-equivalent tarballs are rebuilt from source and their SHA-256 values are retained;
4. required Web, clean-consumer, Android/native compile and scheduled iOS/native evidence is green for the exact candidate or explicitly classified by the release contract;
5. `CHANGELOG.md`, migration/support documentation, distribution policy and npm workflow all describe the same version authority;
6. no `@beeui/*`, `0.1.0`, `1.0.0`-as-npm-version, or `20260902.0.0` instruction remains in an active release path;
7. the repository owner explicitly authorizes registry mutation.

Any package/CLI/registry/token source change after freeze invalidates the candidate and requires a new `rc.N`. Evidence-only documentation may describe an already-frozen source candidate but must never silently change its package contents.

## Publication channels

- `0.86.2-rc.N` → `next` only.
- stable `0.86.2` → `latest` only after the full four-package set is published and verified.
- package publication order is `core` → `tokens` → `ui` → `cli`.
- npm package versions are immutable; never attempt to overwrite an already-published version.

## Current package set

- `@beemvp/beeui-core`
- `@beemvp/beeui-tokens`
- `@beemvp/beeui-ui`
- `@beemvp/beeui-cli` (`beeui` binary)

All four release together on one lockstep version.

## Evidence to record when the next candidate is frozen

The freeze record must include:

- exact candidate source SHA;
- exact lockstep version (`0.86.2-rc.N`);
- four tarball names, byte sizes and SHA-256 hashes;
- exact-head required CI results;
- clean-consumer install/CLI evidence;
- provenance/trusted-publishing status;
- npm registry state and intended dist-tag;
- any explicitly quarantined or experimental runtime dimension.

Until those fields are populated from a fresh candidate, this document makes **no claim that an RC has been frozen**.

## References

- `docs/release.md`
- `docs/dist-tag-policy.md`
- `docs/decisions/015-package-version-0-86-2.md`
- `docs/beeui-1.0-owner-gates.md`
- `docs/rc-ci-matrix.md`
- `docs/rollback-runbook.md`
- issue #254
