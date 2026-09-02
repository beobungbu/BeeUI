# BeeUI dist-tag and prerelease policy (#206, R7.10)

This document defines the eventual npm release semantics for BeeUI — how the `latest` and
`next` dist-tags will be used, how prerelease versions are named and promoted, how the three
library packages and the CLI stay version-aligned, and how a bad tag or a failed partial
publication is corrected — **without publishing anything**.

It is a policy document that the release workflow ([#254](https://github.com/beobungbu/BeeUI/issues/254))
and the integrity/provenance path ([#207](https://github.com/beobungbu/BeeUI/issues/207))
will follow. The distribution architecture authority is
[ADR-011](decisions/011-distribution-architecture.md); the current release contract and
gates are [docs/release.md](release.md); the branch/tag/`release`-environment configuration
is [docs/release-ruleset.md](release-ruleset.md); the package/CLI names are
[docs/distribution-names.md](distribution-names.md).

## Owner guard — nothing is published before #254

Before the repository owner explicitly commands the BeeUI 1.0 release, this policy is
**documentation only**. No package or CLI is published, and **no dist-tag is created, moved,
or deleted** on any registry. Publishing and every dist-tag mutation are gated behind the
`release` GitHub environment ([docs/release-ruleset.md](release-ruleset.md)) and the #254
hard gate ([docs/beeui-1.0-owner-gates.md](beeui-1.0-owner-gates.md)). Technical readiness is
not release authorization. `release-ready` / `publication-ready` artifacts, dry runs, and
retained tarballs do **not** mean BeeUI has been published.

## Dist-tag semantics

BeeUI 1.0 uses exactly two npm dist-tags. No other floating tag is published for 1.0.

| Dist-tag | Consumer opt-in | Points at | Constraint |
| --- | --- | --- | --- |
| `latest` | default — `npm i @beemvp/beeui-ui` | the current **stable** release (`x.y.z`, no prerelease identifier) | never points at a prerelease version |
| `next` | explicit — `npm i @beemvp/beeui-ui@next` | the newest **prerelease** (`20260902.0.0-rc.N`) | never used as a resolution default; only an opt-in channel |

- A default install (`npm i @beemvp/beeui-ui`) resolves `latest`. Because semver ranges exclude
  prerelease identifiers unless a prerelease is requested explicitly, a consumer on a normal
  caret/tilde range **never** receives a `20260902.0.0-rc.N` build by accident. Prereleases are
  reachable only via `@next` or an exact `@1.0.0-rc.N` request. This is the mechanism by
  which consumers "opt into prereleases only after publication is authorized" (#206 DoD).
- `latest` is only ever promoted to a stable version. The first `latest` BeeUI ever
  publishes is `20260902.0.0` (owner-gated at #254). Until then, `latest` does not exist for
  `@beemvp/beeui-*` — the scope is unpublished ([docs/distribution-names.md](distribution-names.md)).

## Prerelease versioning

> **2026-09-02 owner decision (#407):** BeeUI 1.0 remains the product milestone name, while npm artifacts use the date-version label `20260902`, encoded as SemVer `20260902.0.0`. If a prerelease is needed for this release line, use `20260902.0.0-rc.N`. This supersedes the earlier operational `1.0.0[-rc.N]` package-version examples.


- Prerelease candidates are named **`20260902.0.0-rc.N`** (`rc.1`, `rc.2`, …), a standard semver
  prerelease. `1.0.0-rc.1 < 1.0.0-rc.2 < … < 1.0.0` in semver precedence, so `20260902.0.0` (once
  published) supersedes every `rc.*` automatically.
- Prereleases publish under the **`next`** dist-tag only, never `latest`.
- The stable `20260902.0.0` is published, verified, and only then promoted to `latest`.

### `20260902.0.0-rc.N` vs. the internal `-rc-ready.<sha>` artifact version

Do not confuse the published prerelease name with the internal artifact-metadata version.
`scripts/pack-artifacts.mjs` ([#203](https://github.com/beobungbu/BeeUI/issues/203)) stamps
retained, **never-published** tarballs with a deterministic
`<version>-rc-ready.<commit-sha12>` version used only inside artifact metadata and test
staging. That string is intentionally distinct from `20260902.0.0-rc.N` precisely so a retained
build artifact can never be mistaken for, or promoted as, a real published prerelease. The
`-rc-ready.<sha>` artifacts prove reproducibility; `20260902.0.0-rc.N` is the (future, owner-gated)
public prerelease.

## Lockstep version and CLI alignment

- `@beemvp/beeui-core`, `@beemvp/beeui-tokens`, and `@beemvp/beeui-ui` share **one lockstep version** and are
  released together as a fixed group (ADR-011 D6; [docs/release.md](release.md) versioning
  policy). A prerelease bumps all three to the same `20260902.0.0-rc.N`; the stable release bumps
  all three to `20260902.0.0`. Package versions must not drift, and packed manifests must not expose
  unresolved `workspace:*` ranges — `pnpm release:verify` enforces both.
- The CLI (recommended name `@beemvp/beeui-cli`, binary `beeui` —
  [docs/distribution-names.md](distribution-names.md); packaged under the R8 tranche,
  [#209](https://github.com/beobungbu/BeeUI/issues/209)) uses the **same** `latest`/`next`
  dist-tag scheme. A given `@beemvp/beeui-cli` `latest` (or `next`) must target the matching library
  `latest` (or `next`) line: the registry snapshot the CLI bundles, and the `@beemvp/beeui-tokens`
  runtime dependency it records into a consumer for the source-ownership path (ADR-011 D5),
  must resolve to library versions compatible with that CLI. A `next` CLI scaffolds against
  the `next` libraries; a `latest` CLI scaffolds against the `latest` libraries.

## The atomic tag/version plan (or fail safe)

The release workflow applies **one unambiguous tag/version plan** whose commit point is a
single atomic dist-tag promotion, so a partial upload can never present a half-published
release to `latest` consumers (#206 DoD).

1. **Compute one plan.** Pick the single lockstep version for the candidate (`20260902.0.0-rc.N` or
   `20260902.0.0`) from an exact SHA. Validate changelog/migration/version inputs
   ([docs/release.md](release.md) release-candidate checklist; #203 inputs).
2. **Upload dependency order.** Publish `@beemvp/beeui-core` and `@beemvp/beeui-tokens` before `@beemvp/beeui-ui`
   (ui depends on both). A prerelease uploads with `--tag next`; a stable upload uses no
   promotion yet (see step 4). npm version content is **immutable**: an already-published
   version cannot be overwritten.
3. **Verify the full set is present and intact** before any `latest` move — checksums and
   provenance/integrity per [#207](https://github.com/beobungbu/BeeUI/issues/207): every
   package of the group is published at the candidate version, tarball hashes match the
   retained candidate artifact, and metadata points at the canonical repository/source.
4. **Promote `latest` last, together.** For a stable release, only after step 3 passes, move
   `latest` for all three packages (and the CLI, when part of the release) in one
   `npm dist-tag add` batch. This promotion is the atomic "commit": it is the moment
   consumers on `latest` see the new release.

**Fail-safe property.** If any upload in step 2 or check in step 3 fails, `latest` is never
moved, so default consumers keep resolving the previous good stable release. Recovery is to
re-run the plan for the missing package(s) at the **same** version — npm rejects re-publishing
an already-present version, so completing the set is idempotent and safe — then re-verify
(step 3) and promote (step 4). A prerelease that fails partway leaves only `next` affected,
never `latest`.

## Dist-tag correction and deprecation

Dist-tag moves are metadata-only and reversible; published version **content** is immutable.

- **Wrong version tagged `latest`.** Re-point `latest` to the last-good stable for all three
  packages atomically (`npm dist-tag add @beemvp/beeui-core@<good> latest`, same for `tokens`/`ui`).
  Because the move is metadata-only, this is an immediate, reversible correction — no
  republish, no version change.
- **Bad published version.** Use `npm deprecate @beemvp/beeui-<pkg>@<bad> "<reason + upgrade path>"`
  to warn installers. Deprecation is additive metadata; it does not remove the version.
- **Do not unpublish.** Unpublishing creates a tombstone that cannot be cleanly reclaimed and
  carries dependency-confusion/trust baggage — the exact failure mode that makes the bare
  `beeui` name unusable ([docs/distribution-names.md](distribution-names.md)). Correct
  forward with dist-tag moves, deprecation, and a new patched version, never by unpublishing.
- **Stray `next`.** If `next` points at an unintended prerelease, re-point it to the intended
  `20260902.0.0-rc.N` (or remove it with `npm dist-tag rm` if no valid prerelease should be current).
  `latest` is unaffected.

## Machine-readable policy contract

The block below is parsed verbatim by `scripts/check-distribution-policy.mjs` (run via
`pnpm dist:policy:check`, part of `pnpm typecheck`). It pins the lockstep/prerelease/tag
invariants to the repository's actual package versions and the live `release` environment so
this policy cannot silently drift from reality: `published` must stay `false` and
`currentVersion` must match every package version until the owner publishes.

```json dist-tag-policy
{
  "published": false,
  "currentVersion": "20260902.0.0",
  "candidateStableVersion": "1.0.0",
  "prereleaseVersionPattern": "^1\\.0\\.0-rc\\.(0|[1-9][0-9]*)$",
  "prereleaseExample": "1.0.0-rc.1",
  "distTags": ["latest", "next"],
  "prereleaseDistTag": "next",
  "stableDistTag": "latest",
  "atomicPromotionTag": "latest",
  "lockstepPackages": ["@beemvp/beeui-core", "@beemvp/beeui-tokens", "@beemvp/beeui-ui"],
  "releaseEnvironment": "release"
}
```

## Revisit trigger

Revisit if: a second maintained major/minor line requires an additional maintenance dist-tag
beyond `latest`/`next`; the CLI is split from the library dist-tag scheme; or npm changes its
immutability/unpublish semantics in a way that affects the correction procedures above.
