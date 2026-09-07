---
title: Migration & versioning
description: What BeeUI's version number means today, which channel you are on, and what a future upgrade will and will not do to your code.
---

**There is nothing to migrate from yet.** BeeUI has never been published, so no released
version exists to upgrade away from and no historical migration guide exists. What this page
gives you is the *policy* — the rules an upgrade will follow once there is one — so you can
depend on BeeUI today without guessing.

Start with [Current release status](/docs/guides/current-release/). That page is
generated from the workspace manifest plus the canonical distribution policy, so it is the
only place that states the live version and channel. Never hand-edit it, and prefer linking
it over copying its numbers.

:::caution[Release-ready is not released]
Technical readiness is not release authorization. The repository can produce and verify
artifacts, but no package, CLI, dist-tag, Git tag, or GitHub Release exists. Publication is
an explicit owner action behind the `release` environment and the
[#254](https://github.com/beobungbu/BeeUI/issues/254) gate. Retained build artifacts are
deliberately stamped with a version shape that can never be mistaken for a published
prerelease.
:::

## Which channel am I on?

| Channel | Exists today | What it means |
| --- | --- | --- |
| **Development / unpublished** | Yes — this is the only channel | You consume BeeUI from a repository checkout, or from a tarball you packed yourself from that checkout. There is no registry resolution and no dist-tag. |
| **Prerelease (`next`)** | No | Reserved for future opt-in prereleases. It will never be a resolution default. |
| **Stable (`latest`)** | No | Reserved for the first stable release. It will only ever point at a stable version, never a prerelease. |

Because a normal semver range excludes prerelease identifiers, a consumer on an ordinary
caret or tilde range will never receive a prerelease by accident once publication opens —
prereleases are reachable only by explicitly asking for the prerelease channel or an exact
prerelease version.

## Version authority

- **One number, three libraries.** `@beemvp/beeui-core`, `@beemvp/beeui-tokens`, and
  `@beemvp/beeui-ui` share a single lockstep version and move as a fixed group. Their
  versions must not drift, and packed manifests must not expose unresolved workspace
  ranges — both are machine-enforced by the repository's release verification.
- **The CLI follows the library line.** `@beemvp/beeui-cli` uses the same channel scheme,
  and a given CLI line targets the matching library line: the registry snapshot the CLI
  bundles and the token dependency it records into a consumer must resolve to library
  versions compatible with that CLI.
- **The canonical number lives in one place.** The root workspace manifest holds the
  version; the distribution policy document holds the channel contract; the generated
  release page renders both. Documentation does not restate the number, so it cannot drift.
- **Owner gate.** Nothing is published — and no dist-tag is created, moved, or deleted — before
  [#254](https://github.com/beobungbu/BeeUI/issues/254). Until then the distribution policy
  is documentation only.

## Stability terminology

BeeUI uses one small vocabulary across tokens, components, and behaviors.

| Status | Promise | Removal path |
| --- | --- | --- |
| **stable** | Part of the public contract. The default for anything not explicitly annotated. | Deprecate first, keep generating through a compatibility window, remove only in a major. |
| **experimental** | Available, but the contract is not settled. Not covered by the stability promise until promoted. | May change or be removed with lighter notice. |
| **deprecated** | Still generated for compatibility; migrate to the declared replacement where one exists. | On a declared path to removal, gated on migration evidence and a satisfied compatibility window. |

Two things are deliberately kept apart and are never conflated in metadata: an **authoring
alias** (a naming bridge with no deprecation meaning) and a **deprecated-compatibility
alias** (a token kept alive during its window). Promoting an experimental surface to stable
is a minor change, not a silent one.

## What each release level will mean

Once a stable line exists, BeeUI follows standard semver against its inventoried public
surface — package export entries, component subpaths, barrel exports and typed prop
contracts, CLI commands and their exit-code contract, the governed public token set, and the
config/registry schema versions.

| Level | Applies to |
| --- | --- |
| **Major** | Removing or renaming an export entry, subpath, or barrel export; changing a typed prop contract incompatibly; removing a CLI command or flag or changing its exit-code contract; removing a stable public token past its window; narrowing a peer range that drops a still-supported tested version; a non-backward-compatible schema bump. |
| **Minor** | Adding a component, an optional prop, a CLI command or flag, or a token; widening a peer range to admit a newly tested version; promoting a documented experimental surface to stable after it earns runtime evidence. |
| **Patch** | Behavior fixes that keep the documented contract; build and dependency fixes with no consumer-visible API change; documentation. |

Standing carve-outs: experimental behaviors are outside the stability promise until
promoted, optional native peers may have their ranges widened in a minor because they are
never required, and a peer range is never widened past what the compatibility matrix has
actually tested. Read [Compatibility](/docs/compatibility/) for the difference between the
promised range and the tested pin.

## Where the changelog lives

Release notes live at [`/changelog/`](/changelog/). Token deprecations additionally have a
machine-generated migration report produced from canonical lifecycle metadata rather than
hand-maintained prose, so release notes cannot drift from the token source.

## The future migration-guide contract

No published migration guide exists, and none will be invented retroactively. When one is
written, it will be scoped to a real published transition and will state, at minimum:

1. **What changed**, split by the levels above, with the removed or renamed symbol named
   exactly.
2. **The replacement** for each removed surface, or an explicit statement that there is none.
3. **The mechanical steps** — import rewrites, config field renames, theme CSS entry
   changes — in the order they must be applied.
4. **What is unaffected**, so you can bound the review.
5. **The evidence class** behind each compatibility claim, matching the discipline the rest
   of these docs use.

Until then, the repository's own upgrade notes are the working draft, and they describe a
transition that has not been published.

## Upgrading as a package consumer

Your dependency is the packed package boundary. An upgrade is:

1. Read the changelog entry and, if the release is a major, its migration guide.
2. Move all three libraries together — they are lockstep, so a partial bump is unsupported.
3. Re-check your peer set against [Compatibility](/docs/compatibility/); a widened range is
   an opportunity, never an obligation.
4. Re-run your own build and tests for each platform you ship.

## Upgrading as a source owner

Source ownership inverts the model: once the CLI copies a component into your project, that
file is **your code**. Nothing upstream can silently change it, and nothing upstream is
automatically applied.

An upgrade is therefore a review, not an install:

```bash
pnpm beeui diff
```

`diff` never mutates your project. It compares what you own against the current registry
source, so you see exactly which upstream files moved.

```bash
pnpm beeui update --dry-run
```

`update` re-syncs only files whose upstream source actually changed, and it never touches a
file you edited locally unless that same file also changed upstream. When both changed, it
refuses until you pass `--force`, which discards your local edit — so read the diff first.

The one thing you should keep taking wholesale is the token layer, because semantic token
*names* are the contract that keeps your owned components upgradable:

```bash
pnpm beeui add theme
```

See [CLI & source ownership](/docs/guides/cli-source-ownership/) for the full command
contract and [Branding](/docs/guides/branding/) for what you may safely change.

## Deprecation expectations you can rely on

- A stable public token is deprecated — and keeps generating as a compatibility alias —
  before it is removed. Removal additionally requires a declared removal target, a
  replacement that still resolves (when one is declared), recorded migration evidence, and a
  satisfied compatibility window. The repository's token checks reject removals that skip
  any of these.
- Experimental tokens carry no window guarantee.
- A bad published version will be corrected **forward** — re-point the channel, mark the bad
  version deprecated, publish a patched version — never by unpublishing.
- Channel moves are metadata-only and reversible; published version *content* is immutable.

## Related

- [Current release status](/docs/guides/current-release/) — the generated, authoritative version and channel table.
- [Compatibility](/docs/compatibility/) — promised peer ranges versus tested pins.
- [CLI & source ownership](/docs/guides/cli-source-ownership/) — `diff`, `update`, and owned-file rules.
- [Troubleshooting](/docs/guides/troubleshooting/) — schema-mismatch and CLI drift symptoms.
- [Release & security](/docs/release-security/) — publication state, channels, and reporting.

## Canonical sources

- [Dist-tag and prerelease policy](https://github.com/beobungbu/BeeUI/blob/main/docs/dist-tag-policy.md)
- [Semver and breaking-change audit](https://github.com/beobungbu/BeeUI/blob/main/docs/semver-audit.md)
- [Token lifecycle and deprecation policy](https://github.com/beobungbu/BeeUI/blob/main/docs/token-lifecycle.md)
- [Upgrade notes for the unreleased line](https://github.com/beobungbu/BeeUI/blob/main/docs/migration-guide.md)
- [Distribution architecture (ADR-011)](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/011-distribution-architecture.md)
