# BeeUI 1.0 rollback, hotfix, and deprecation runbook (#256, R11.14)

> **Status:** Pre-publication incident-recovery and post-release compatibility runbook.
> Written and exercised **before** the RC candidate ([#246](https://github.com/beobungbu/BeeUI/issues/246))
> is frozen and **before** the final security/readiness audit ([#251](https://github.com/beobungbu/BeeUI/issues/251)),
> per the sequence rule in [docs/beeui-1.0-sequence.md](beeui-1.0-sequence.md) (S8, step 3):
> **issue number is not execution order** — #256 completes before #254 publication. It defines
> what to do if a 1.0 (or `1.0.x`) release goes wrong, consistent with
> [docs/dist-tag-policy.md](dist-tag-policy.md).
> **Snapshot:** 2026-09-02.

## Owner guard — this runbook publishes nothing

Writing and rehearsing this runbook performs **no** `npm publish`, and creates, moves, or
deletes **no** dist-tag on any registry. Publishing and every dist-tag mutation are gated
behind the `release` GitHub environment ([docs/release-ruleset.md](release-ruleset.md)) and
the #254 hard gate ([docs/beeui-1.0-owner-gates.md](beeui-1.0-owner-gates.md)). The
no-publication dry run below is a documented tabletop exercise, not a registry action.
`@beemvp/beeui-*` is unpublished today ([docs/distribution-names.md](distribution-names.md)),
so every `npm` command in this file is a **procedure the release identity will run after
publication**, not something run now.

## Core invariants (npm reality this runbook is built on)

1. **Published version content is immutable.** An already-published `@beemvp/beeui-<pkg>@x.y.z`
   cannot be overwritten. Recovery is always **forward** — a new version and/or a metadata-only
   dist-tag move — never an in-place edit.
2. **Never unpublish.** Unpublishing leaves a tombstone that cannot be cleanly reclaimed and
   carries dependency-confusion/trust baggage — the exact failure mode that makes the bare
   `beeui` name unusable ([docs/distribution-names.md](distribution-names.md)). Correct forward
   with dist-tag moves, `npm deprecate`, and a new patched version.
3. **Never rewrite published git history or move a release tag.** A published release tag
   (`v1.0.0`) and its commit are immutable once consumers can fetch the artifact it produced.
   Fix forward with a new tag/version; do not force-push over release history
   ([docs/release-ruleset.md](release-ruleset.md)).
4. **`latest` only ever points at a stable version; the atomic promotion is the commit
   point.** A partial upload never reaches `latest` because `latest` is promoted last, together,
   only after the whole lockstep set verifies ([docs/dist-tag-policy.md](dist-tag-policy.md)).
5. **Lockstep group.** `@beemvp/beeui-core`, `@beemvp/beeui-tokens`, and `@beemvp/beeui-ui`
   share one version and are corrected together; the CLI (`@beemvp/beeui-cli`) tracks the
   matching line.

## Scenario 1 — bad npm artifact or partial multi-package publication

**Symptom.** The publish job uploaded some but not all of the lockstep group (e.g. `core` and
`tokens` published at `1.0.0`, `ui` failed), or a package published with a defect.

**Because `latest` is promoted last (dist-tag policy step 4), a partial upload never reached
`latest`** — default consumers still resolve the previous good stable (or, for the very first
1.0.0, resolve nothing yet). Recovery:

1. **Do not unpublish** the packages that did upload (invariant 2). npm rejects republishing an
   already-present version, so completing the set is idempotent.
2. **Re-run the same plan at the same version** for the missing/failed package(s). Publishing
   `@beemvp/beeui-ui@1.0.0` to complete the set is safe precisely because the others at `1.0.0`
   cannot be overwritten.
3. **Re-verify the full set is present and intact** — every package of the group at the
   candidate version, tarball hashes matching the retained candidate artifact, provenance
   present (dist-tag policy step 3; integrity path [#207](https://github.com/beobungbu/BeeUI/issues/207)).
4. **Only then promote `latest`** for all three (and the CLI, if in the release) in one
   `npm dist-tag add` batch (dist-tag policy step 4).

If a defect is discovered in an already-published version, it cannot be recalled — proceed to
Scenario 3 (dist-tag correction) and/or Scenario 4 (deprecate + hotfix).

## Scenario 2 — wrong version promoted to `latest`

**Symptom.** `latest` points at a version it should not (e.g. a broken `1.0.1`, or an
accidental promotion).

Dist-tag moves are **metadata-only and reversible** (dist-tag policy). Re-point `latest` to the
last-good stable for **all three** packages atomically:

```sh
npm dist-tag add @beemvp/beeui-core@<last-good> latest
npm dist-tag add @beemvp/beeui-tokens@<last-good> latest
npm dist-tag add @beemvp/beeui-ui@<last-good> latest
# and the CLI, if it participates in the release line:
npm dist-tag add @beemvp/beeui-cli@<last-good> latest
```

This is immediate and needs no republish or version bump. Keep the group aligned — never leave
`latest` split across versions within the lockstep set. Then deprecate the bad version
(Scenario 4) so installers who pinned it are warned.

## Scenario 3 — stray or wrong `next` (prerelease) tag

`next` points only at the newest `1.0.0-rc.N` prerelease and is never a resolution default.
If `next` points at an unintended prerelease, re-point it to the intended `1.0.0-rc.N`, or
remove it entirely when no valid prerelease should be current:

```sh
npm dist-tag add @beemvp/beeui-ui@1.0.0-rc.<N> next   # re-point
npm dist-tag rm  @beemvp/beeui-ui next                # or remove
```

`latest` is unaffected — default consumers on a caret/tilde range never receive a prerelease
by accident ([docs/dist-tag-policy.md](dist-tag-policy.md)).

## Scenario 4 — deprecate a bad published version

Deprecation is **additive metadata** — it warns installers, it does not remove the version
(invariants 1–2). Use it for a version you cannot recall but must steer consumers off:

```sh
npm deprecate @beemvp/beeui-ui@1.0.1 "Regression in <area>; upgrade to @beemvp/beeui-ui@1.0.2. See CHANGELOG."
```

Guidance:

- Deprecate the **whole lockstep group** at the bad version, with a message that names the
  reason and the exact upgrade target.
- A deprecation is **not** a substitute for a fix — pair it with a forward patch (Scenario 5).
- To lift a mistaken deprecation, `npm deprecate @beemvp/beeui-<pkg>@<v> ""` clears the message.

## Scenario 5 — emergency `1.0.x` hotfix (forward fix)

The only correct recovery from a bad published version is a **new patched version** (invariant
1). Standard hotfix flow:

1. Branch from the released tag (`v1.0.0`), apply the **minimal** fix, keep the public contract
   ([docs/semver-audit.md](semver-audit.md): a patch must not intentionally change documented
   public behavior).
2. Add a `CHANGELOG.md` entry under the new version; add migration notes only if the fix
   unavoidably adjusts behavior.
3. Run the exact-candidate gates that apply to the change (release verification, clean
   consumers, and the runtime/native matrices when native paths are touched —
   [docs/release.md](release.md)). A P0/P1 fix means a **new candidate**: rerun every affected
   exact-candidate gate ([docs/beeui-1.0-sequence.md](beeui-1.0-sequence.md) S8).
4. Bump the lockstep group to `1.0.x` (all three together), publish in dependency order
   (`core`/`tokens` before `ui`), verify the full set, then promote `latest` last
   ([docs/dist-tag-policy.md](dist-tag-policy.md)).
5. Deprecate the bad version (Scenario 4) so pinned installers are warned.

## Scenario 6 — security fix

A security fix follows the Scenario 5 forward-fix flow with these additions:

- Coordinate disclosure through [SECURITY.md](../SECURITY.md); do not publish exploit detail
  ahead of the fixed version.
- Prefer the **smallest** patch that closes the issue; ship as `1.0.x` (or `1.x.y` if the fix
  requires a documented additive change).
- `npm deprecate` the affected versions with a message pointing at the fixed version and the
  advisory.
- Retain evidence (advisory, patch, verification run) per "Evidence retention" below; the
  final readiness audit (#251) verifies this runbook was followed.

## Scenario 7 — CLI rollback / version skew

The CLI ships a **bundled, frozen registry snapshot** per release — no remote registry, no
network fetch ([docs/registry-cli.md](registry-cli.md) "Registry delivery and integrity"). A
given installed `@beemvp/beeui-cli@x.y.z` always pins one registry+sources+checksum triple.
Consequences for rollback:

- A consumer who already ran `add` **owns the copied source**; a later or rolled-back CLI
  version cannot change files already in their project. They only see a change by explicitly
  upgrading the CLI and re-running `add`/`update`.
- A bad CLI release is corrected exactly like a library: re-point `latest` to the last-good CLI
  version (Scenario 2), `npm deprecate` the bad one (Scenario 4), publish a forward `@beemvp/beeui-cli`
  patch (Scenario 5). A `latest` CLI must target the matching `latest` libraries; a `next` CLI
  targets `next` libraries ([docs/dist-tag-policy.md](dist-tag-policy.md)).
- A checksum/integrity mismatch on a packed CLI fails loudly at runtime and tells the caller to
  reinstall — a tampered/corrupt install is detected, never silently applied.

## Scenario 8 — source-owned consumer advisory path

Consumers who own copied source are not reached by a dist-tag move or a library version bump —
they have the code in-tree. Advise them through:

- **`CHANGELOG.md`** (the durable record) and the relevant `docs/` note describing the fixed
  source and how to pull it.
- **`beeui diff` / `beeui update`**: a source-owner runs `beeui diff` to see what changed
  upstream and `beeui update` to re-sync safely (never overwriting a local edit without
  `--force`) ([docs/registry-cli.md](registry-cli.md) "Source-owned update/diff assistance").
  For a security fix, the advisory should name the exact items to `diff`/`update`.
- A GitHub Security Advisory / release note for anything security-relevant, since source-owners
  will not receive an `npm audit` signal for vendored code.

## Token and API deprecation windows (post-release)

- **Tokens.** A stable public token is **deprecated** (kept generating as a compatibility
  alias — TS `@deprecated` JSDoc, CSS `--color-*` alias) before removal, and removed only in a
  MAJOR once its `removal.target`, migration evidence, and compatibility window are satisfied,
  enforced by `pnpm tokens:check` ([docs/token-lifecycle.md](token-lifecycle.md)). Experimental
  tokens carry lighter notice. `pnpm tokens:migration-report` generates the deterministic
  deprecation report so release notes cannot drift from source.
- **Component / CLI API.** Removing or incompatibly changing a public export, subpath, prop
  contract, or CLI command/flag is a MAJOR ([docs/semver-audit.md](semver-audit.md)). Where an
  aliasing/deprecation window is feasible, deprecate first (types/docs), then remove in the
  next major. Do not silently repurpose a name.

## When history and tags must never be rewritten

- A **published npm version** — immutable content; fix forward (invariants 1–2).
- A **published release git tag/commit** (`v1.0.0`) — never force-move or rebase once its
  artifact is fetchable; cut a new tag/version instead (invariant 3).
- The **retained candidate artifact** and its `<version>-rc-ready.<sha>` metadata — evidence of
  reproducibility; never re-stamp or overwrite ([docs/dist-tag-policy.md](dist-tag-policy.md)).

Metadata-only, reversible actions that are **allowed** (and are the correct tools): dist-tag
moves (`latest`/`next`), `npm deprecate`/un-deprecate, and publishing a new forward version.

## Communication channels and evidence retention

**Channels.** For any incident: (1) `CHANGELOG.md` entry for the corrected/patched version;
(2) a GitHub release note on the forward version; (3) a GitHub Security Advisory for
security-relevant fixes (see [SECURITY.md](../SECURITY.md)); (4) the `npm deprecate` message on
each affected version pointing at the fix; (5) for source-owners, the `beeui diff`/`update`
advisory (Scenario 8).

**Evidence retention.** Retain, for each incident: the exact bad version(s) and SHAs, the
dist-tag state before/after, the forward-fix PR and its exact-head gate results, the retained
candidate artifact + checksums, and the deprecation messages issued. This packet is what the
final readiness audit (#251) and the post-publication verification (#255) check against; if
#255 finds an incident after publication, execute this runbook rather than patching immutable
artifacts or rewriting history ([docs/beeui-1.0-sequence.md](beeui-1.0-sequence.md) S9).

## Required pre-release exercise — no-publication dry run

Per #256's DoD, at least one incident scenario is rehearsed **without any publication** before
the RC candidate is frozen. Recorded tabletop run:

**Scenario exercised: #1 (partial multi-package publication) + #2 (`latest` correction),
tabletop, no registry action.**

| Step | Action (not executed against any registry) | Expected outcome | Invariant relied on |
| --- | --- | --- | --- |
| 0 | Baseline: `latest` at last-good (or absent for first 1.0.0); candidate `1.0.0` verified in `.artifacts/pack/` with checksums | Known-good starting state | 4 |
| 1 | Simulate: `core@1.0.0` + `tokens@1.0.0` uploaded, `ui@1.0.0` upload fails | `latest` unmoved; default installs unaffected | 4 |
| 2 | Do **not** unpublish `core`/`tokens` | No tombstone created | 2 |
| 3 | Re-run plan for `ui@1.0.0` only | Idempotent completion; `core`/`tokens@1.0.0` reject overwrite | 1 |
| 4 | Verify full set present + hashes match retained artifact + provenance | Set intact | — |
| 5 | Promote `latest` for all three atomically | Consumers see 1.0.0 only now | 4, 5 |
| 6 | Inject a defect hypothesis: `latest` promoted to a bad version | — | — |
| 7 | Re-point `latest` to last-good for all three; `npm deprecate` the bad group | Immediate reversible correction; installers warned | 1, 2 |

**Result: PASS (tabletop).** The procedure recovers using only metadata-only moves and forward
publication; at no step is unpublish, history rewrite, or in-place edit required, and at no step
was a registry mutated. This satisfies the "practice/document at least one no-publication dry-run
incident scenario before #246/#251" requirement. Re-run this tabletop against the exact frozen
candidate as part of #251.

## Cross-references

- Tag/version/prerelease mechanics: [docs/dist-tag-policy.md](dist-tag-policy.md)
- Semver classification and `1.x` policy: [docs/semver-audit.md](semver-audit.md)
- Consumer migration: [docs/migration-guide.md](migration-guide.md)
- Release contract and gates: [docs/release.md](release.md)
- Execution sequence (S8/S9): [docs/beeui-1.0-sequence.md](beeui-1.0-sequence.md)
- Owner gates: [docs/beeui-1.0-owner-gates.md](beeui-1.0-owner-gates.md)
- Branch/tag/release ruleset: [docs/release-ruleset.md](release-ruleset.md)
- CLI delivery/integrity: [docs/registry-cli.md](registry-cli.md)
- Token lifecycle: [docs/token-lifecycle.md](token-lifecycle.md)
- Security policy: [SECURITY.md](../SECURITY.md)
- Distribution names / npm reality: [docs/distribution-names.md](distribution-names.md)
