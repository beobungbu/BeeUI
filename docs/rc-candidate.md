# BeeUI 1.0 RC-ready candidate — `1.0.0-rc-ready.1` (#246, R11.4)

> **Status:** FROZEN evidence candidate. This document declares the single immutable
> release-candidate-equivalent artifact set the BeeUI 1.0 RC gates are evaluated against. It is
> **evidence only** — it publishes nothing.
> **Candidate SHA:** `a58abe71a179a395f7ace35c1e73adf8515737bc` (`main`).
> **Candidate commit:** `docs: freeze 1.0 public API inventory + token vocabulary (#243, #244) (#400)`, 2026-09-02.
> **Snapshot:** 2026-09-02. Generated with Node 24.13.1, pnpm 10.15.0.

## Owner guard — nothing was published, tagged, or promoted

This candidate is an **evidence artifact set**, not a release. Producing it did **not**:

- publish any package or the CLI to npm (no `npm publish`);
- create, move, or delete any dist-tag (`latest` / `next` are untouched — the `@beemvp` scope
  is unpublished and all four names resolve `404`, per
  [docs/distribution-names.md](distribution-names.md));
- create a `v*` git tag or a `1.0` GitHub Release;
- bump any package version (every manifest stays `0.1.0`).

Publishing and every dist-tag mutation remain gated behind the owner-only `release` environment
and the [#254](https://github.com/beobungbu/BeeUI/issues/254) hard gate
([docs/beeui-1.0-owner-gates.md](beeui-1.0-owner-gates.md),
[docs/dist-tag-policy.md](dist-tag-policy.md)). Technical readiness is not release authorization.
The generated tarballs are retained, gitignored build artifacts — a "what we would ship"
reproducibility proof, **not** a registry claim.

## The immutable candidate binding

`1.0.0-rc-ready.1` is the evidence-candidate **label** (the `.N` counter from
[#246](https://github.com/beobungbu/BeeUI/issues/246)); it is bound to exactly one commit:

| Field | Value |
| --- | --- |
| Candidate label | `1.0.0-rc-ready.1` |
| Candidate SHA | `a58abe71a179a395f7ace35c1e73adf8515737bc` |
| Lockstep package version | `0.1.0` (unbumped; `1.0.0` is owner-gated at #254) |
| Machine-stamped artifact version | `0.1.0-rc-ready.a58abe71a179` |
| Frozen public API surface | [docs/api-freeze.md](api-freeze.md) (#243) |
| Frozen token vocabulary | [docs/token-freeze.md](token-freeze.md) (#244) |

### The label vs. the machine-stamped artifact version (do not conflate)

Three distinct version strings are in play; keeping them separate is deliberate
([docs/dist-tag-policy.md](dist-tag-policy.md), "`1.0.0-rc.N` vs. the internal `-rc-ready.<sha>`
artifact version"):

- **`1.0.0-rc-ready.1`** — this document's human evidence label for the candidate (the `.N`
  counter). It names the candidate; it is **not** written into any `package.json`.
- **`0.1.0-rc-ready.a58abe71a179`** — the version `scripts/pack-artifacts.mjs` deterministically
  stamps into the generated manifest, derived as `<rootVersion>-rc-ready.<sha12>`. It lives only
  in artifact metadata and test staging.
- **`1.0.0-rc.N`** — the future, owner-gated **published** prerelease name (never created here).

The `-rc-ready.<sha>` form is intentionally distinct from `1.0.0-rc.N` precisely so a retained
build artifact can never be mistaken for, or promoted as, a real published prerelease.

## Candidate artifact set (4 tarballs)

Produced by `pnpm pack:artifacts` (`scripts/pack-artifacts.mjs`, #203) at the candidate SHA.
The generator rebuilds every package from source, packs each with `pnpm pack`, verifies the
packed manifest name and that no unresolved `workspace:*` reference survives, and records
`sha256` + byte size into `.artifacts/pack/manifest.json`. `.artifacts/` is gitignored — the
tarballs are **not** committed; the authoritative checksums are recorded here:

| Package | Version | Tarball | sha256 | Bytes |
| --- | --- | --- | --- | --- |
| `@beemvp/beeui-core` | `0.1.0` | `beemvp-beeui-core-0.1.0.tgz` | `b509450efa80dc318ec64021efca37ac92b36b4bdda9d940a3e6fa86f9cebb33` | 26630 |
| `@beemvp/beeui-tokens` | `0.1.0` | `beemvp-beeui-tokens-0.1.0.tgz` | `b0dbbed94b7fe5fc702975556f39acb41d5d0641e7feaf3ab632e2c963cbe1b9` | 101012 |
| `@beemvp/beeui-ui` | `0.1.0` | `beemvp-beeui-ui-0.1.0.tgz` | `887ec148fb303a41245fcdcb682c791c1361c381458e7813e32e7c3c9dd01083` | 521167 |
| `@beemvp/beeui-cli` | `0.1.0` | `beemvp-beeui-cli-0.1.0.tgz` | `79b743bb621b3d0db947fe077776d112fc18128f4f7ddbfcbf61c8cc1d6a5f61` | 188267 |

The three libraries (`core`, `tokens`, `ui`) are one lockstep-versioned group; `@beemvp/beeui-cli`
is a standalone bin-only package on the same release surface (ADR-011 D6). The candidate manifest
records `publish: { executed: false, registry: null, distTag: null }` as a machine-checkable
statement of the owner guard.

## Reproducibility (rebuildable from the SHA to the same checksums)

The candidate is **reproducible**: packing twice from the same SHA produces byte-identical
tarballs with identical `sha256` checksums and byte sizes. Verified at the candidate SHA
(2026-09-02, Node 24.13.1): two independent `pnpm pack:artifacts` runs yielded the four
checksums above unchanged. This is the property that lets an independent reviewer rebuild the
candidate and confirm the artifacts, rather than trusting the retained tarballs.

### Exact rebuild + verify command

From a clean checkout of the candidate SHA (Node 24.13.1, pnpm 10.15.0):

```bash
git checkout a58abe71a179a395f7ace35c1e73adf8515737bc
pnpm install --frozen-lockfile
pnpm pack:artifacts     # rebuilds + repacks; writes .artifacts/pack/manifest.json
# Confirm the four sha256 values match the table above:
python3 - <<'PY'
import json
m = json.load(open('.artifacts/pack/manifest.json'))
for p in m['packages']:
    print(p['name'], p['version'], p['sha256'], p['bytes'])
assert m['commit'] == 'a58abe71a179a395f7ace35c1e73adf8515737bc'
assert m['publish'] == {'executed': False, 'registry': None, 'distTag': None}
PY
pnpm release:verify     # independent packed-contract + clean-consumer + CLI-bin proof
```

`pnpm release:verify` (`scripts/verify-release.mjs`, #202) is the sibling contract check: it
re-packs into a temp dir, asserts each tarball excludes build junk / test fixtures /
repository-private config, ships LICENSE + README, resolves every declared export target
(including all 62 `@beemvp/beeui-ui` granular subpaths) from inside the tarball, installs the set
into a clean consumer, and runs the packed `beeui` bin (`help` + `list button`). It passed green
at the candidate SHA.

## What this candidate is (and is not) evidence of

Per [docs/beeui-1.0-evidence-classes.md](beeui-1.0-evidence-classes.md), this document is the
**Release-evidence** anchor: it ties the exact SHA, the four package/CLI tarballs, and their
hashes together, and the automated gate results are recorded in
[docs/rc-ci-matrix.md](rc-ci-matrix.md) (#247). It does **not** by itself prove native-runtime or
assistive-technology behavior — those are separate evidence classes tracked in the CI-matrix
record and in the owner-gated device/AT dimensions ([#248](https://github.com/beobungbu/BeeUI/issues/248),
[#249](https://github.com/beobungbu/BeeUI/issues/249)).

## Invalidation rule

This candidate is immutable. Any candidate-changing fix (a change to package/CLI/registry/token
source or to a freeze dependency) **invalidates** `1.0.0-rc-ready.1` and requires a **new**
candidate (`1.0.0-rc-ready.2`, …) built from a new SHA — evidence is never mutated silently.
Docs-only edits that do not alter the frozen public surface, the packed tarball contents, or the
checksums above do not invalidate the candidate. Because the freeze dependencies
([docs/api-freeze.md](api-freeze.md), [docs/token-freeze.md](token-freeze.md)) are frozen at this
candidate's parent surface and unchanged here, the candidate is consistent with them.

## Cross-references

- Automated CI matrix on this candidate: [docs/rc-ci-matrix.md](rc-ci-matrix.md) (#247)
- Security / release-readiness audit (bound to this SHA): [docs/rc-security-readiness-audit.md](rc-security-readiness-audit.md) (#251)
- Public API freeze: [docs/api-freeze.md](api-freeze.md) (#243)
- Token vocabulary freeze: [docs/token-freeze.md](token-freeze.md) (#244)
- Dist-tag / prerelease policy: [docs/dist-tag-policy.md](dist-tag-policy.md) (#206)
- Incident / rollback runbook: [docs/rollback-runbook.md](rollback-runbook.md) (#256)
- Owner gate (publish): [docs/beeui-1.0-owner-gates.md](beeui-1.0-owner-gates.md), [#254](https://github.com/beobungbu/BeeUI/issues/254)
- Evidence classes: [docs/beeui-1.0-evidence-classes.md](beeui-1.0-evidence-classes.md)
