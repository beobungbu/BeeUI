# RC security & release-readiness audit (#251, R11.9)

> **Status:** Final pre-publication security / release-readiness audit performed **without
> publishing**. Every claim below cites a real file/config in-tree; nothing is asserted as
> "published".
> **Snapshot:** 2026-09-02.
> **Audited head:** `7f9decb95fc2336340819626e507420f6e63a1fc` (`main`).

## Candidate-binding caveat (affects go/no-go)

The immutable `1.0.0-rc-ready.1` candidate ([#246](https://github.com/beobungbu/BeeUI/issues/246))
is **OPEN — not yet frozen** at this snapshot. The #251 DoD requires the audit to be "tied to
exact candidate SHA/artifact hashes." This audit is therefore tied to the current `main` head
above; **it must be re-affirmed against the frozen `1.0.0-rc-ready.N` candidate manifest and its
tarball checksums once #246 produces them.** That is the single open readiness dependency (see
Go/No-Go), not a security defect.

## Summary

No unresolved release-blocking security or supply-chain issue was found. The no-publication
invariant holds structurally: **no workflow, script, or package manifest can execute
`npm publish` or mutate a dist-tag**, and the future publish path (#254) is gated behind the
owner-only `release` environment. One LOW hardening observation (action pinning) and the
candidate-binding caveat above are the only follow-ups.

| # | Area | Severity | Finding |
| --- | --- | --- | --- |
| F-1 | Secrets / tokens in tree | None | Clean — no secret patterns, no `.env`/key/credential files tracked |
| F-2 | Publish capability | None | No `npm publish` / dist-tag path exists anywhere in repo |
| F-3 | Workflow permissions | None | All 7 workflows pin `permissions: contents: read` |
| F-4 | Fork safety | None | All 7 workflows carry the same-repo fork-guard |
| F-5 | Action pinning | **Low** | Third-party actions SHA-pinned; `actions/cache` pinned by `@v6` tag only |
| F-6 | `publishConfig` / provenance | None | All 3 libs + CLI declare `access: public` + `provenance: true` |
| F-7 | Packed inventory (`files`) | None | `files: ["dist","src"]` allowlist; no internals leak; no `.npmignore` denylist reliance |
| F-8 | Branch/tag/release ruleset | None | `main` + `v*` rulesets live; `release` env owner-gated (#196) |
| F-9 | Community / policy files | None | LICENSE, SECURITY.md, CODEOWNERS, CONTRIBUTING, CoC all present |
| F-10 | Incident runbook (#256) | None | CLOSED, actionable, tabletop dry-run recorded |
| F-11 | Candidate binding (#246) | Info | Candidate not yet frozen — re-affirm audit against frozen SHA/hashes |

## Findings

### F-1 — Secrets / tokens / history (None)

`git grep` over tracked files for `sk-…`, `ghp_…`, `npm_…`, `AKIA…`, `NODE_AUTH_TOKEN`,
`NPM_TOKEN`, and `BEGIN … PRIVATE KEY` returned **no matches**; no `.env`, `*.pem`, `*.key`,
`secret`, or `credential` file is tracked. This is consistent with the closed pre-publication
audit [#187] that preceded the repo going public on 2026-08-30
([docs/roadmap.md](roadmap.md) R6). The CLI manifest's `author.email` (`lantranduc@gmail.com`)
is intentional public package metadata, not a leak.

### F-2 — No task can publish before #254 (None — core invariant)

- No workflow references `npm publish`, `dist-tag`, `id-token`, or `environment:`; `ci.yml`
  line 193 explicitly documents its release job as "artifact only — no npm publish, no dist-tag
  mutation, no version bump."
- No `package.json` (root or any package) defines a `publish` / `prepublishOnly` / dist-tag
  script; `release:verify` (`scripts/verify-release.mjs`) is verification-only.
- The publish workflow (#254) **does not exist yet**. When authored it MUST set
  `environment: release` on the publishing job, which requires explicit `beobungbu` approval in
  the GitHub Actions UI ([docs/release-ruleset.md](release-ruleset.md) "Release environment").
- `@beemvp/beeui-*` is unpublished ([docs/distribution-names.md](distribution-names.md),
  [docs/release.md](release.md)). Packed tarballs are verification artifacts, not a registry
  claim.

**No-publication dry run:** because no publish job/script/token exists in-tree, there is nothing
that could execute a publish from this candidate; the only future path is the owner-gated #254
job. This structurally satisfies the DoD's "release cannot execute without protected owner
authorization."

### F-3 / F-4 — Actions permissions & fork safety (None)

All seven workflows (`ci.yml`, `web-a11y.yml`, `visual-web.yml`, `web-consumer.yml`,
`expo-consumer.yml`, `runtime-native.yml`, `compat-rn-0-87.yml`) declare least-privilege
`permissions: contents: read` at the top level, and every one carries the fork-guard
`github.event.pull_request.head.repo.full_name == github.repository` so fork PRs never execute on
self-hosted runners. Job artifacts use the runner's `ACTIONS_RUNTIME_TOKEN`, not `GITHUB_TOKEN`
scope, so `contents: read` suffices. Required status checks are correctly restricted to
always-run jobs to avoid the skip-trap ([docs/release-ruleset.md](release-ruleset.md)).

### F-5 — Action pinning (Low — hardening opportunity)

Third-party actions are SHA-pinned (`actions/checkout@3d3c42e…`, `actions/setup-node@82076278…`,
`actions/upload-artifact@043fb46d…`). **`actions/cache` is pinned by the mutable `@v6` tag**
across all workflows rather than a commit SHA. `actions/cache` is a GitHub-owned action and only
handles build caches (not the publish path), so the practical risk is low, but the pinning is
inconsistent with the repo's own SHA-pinning posture. **Recommendation:** pin `actions/cache` to
a SHA for consistency. Not release-blocking.

### F-6 — `publishConfig` / provenance readiness (None)

`packages/{core,tokens,ui}/package.json` and `packages/cli/package.json` each declare:

```json
"publishConfig": { "access": "public", "provenance": true }
```

Scope is `@beemvp/beeui-*` throughout. Provenance/OIDC trusted publishing is *declared* but not
*exercisable* until #254 supplies the `id-token: write` job under the `release` environment —
which is the intended owner gate, not a gap. Integrity/checksum path is #207.

### F-7 — Packed package / CLI inventory (None)

Every publishable manifest uses an explicit `files` **allowlist** (`["dist","src"]` for libs;
CLI has its own list) rather than an `.npmignore` denylist — the safer default, since a new
untracked internal file cannot silently leak into a tarball. No `.npmignore` exists in any
package. `src` is intentionally published for the source-ownership path
([docs/release.md](release.md)); it contains no secrets (F-1). Packed-manifest `workspace:*`
rewriting and clean-consumer install are enforced by `release:verify`
([docs/consumer-compatibility-report.md](consumer-compatibility-report.md)).

### F-8 — Branch / tag / release ruleset (None)

Verified against [docs/release-ruleset.md](release-ruleset.md) (pinned by
`scripts/check-release-ruleset.mjs`, wired into `pnpm typecheck`, and
`release-ruleset-contract.test.mjs` in `pnpm test`):

- `main` ruleset: PR required, dismiss-stale-reviews, five always-run required checks (`strict`),
  block force-push/deletion, linear history; admin (owner) bypass is the documented single-owner
  escape valve.
- `v*` tag ruleset: block tag create/update/delete + require signed commits.
- `release` environment: required reviewer `beobungbu`; #254's publish job must bind to it.

### F-9 — LICENSE / SECURITY / community files (None)

`LICENSE` (MIT, matches all manifests' `"license": "MIT"`), `SECURITY.md`, `.github/CODEOWNERS`
(maps `packages/`, `.github/workflows/`, `scripts/`, `registry/` to `@beobungbu`),
`CONTRIBUTING.md`, and `CODE_OF_CONDUCT.md` are all present. Open owner follow-up carried from
#195: confirm GitHub private security advisories are enabled (repo setting, not in-tree).

### F-10 — Tested incident runbook (#256) (None)

[docs/rollback-runbook.md](rollback-runbook.md) exists, is actionable (8 scenarios + token/API
deprecation windows + never-rewrite rules), and records a **no-publication tabletop dry run**
(Scenario 1+2, result PASS, no registry mutated). Issue #256 is **CLOSED**, satisfying the
#251 sequence prerequisite ("#256 runbook is actionable and linked"). The runbook itself asks to
re-run its tabletop against the exact frozen candidate as part of #251 — see F-11.

### F-11 — Candidate binding (Info — the one open dependency)

#246 has not frozen `1.0.0-rc-ready.1`, so no candidate manifest / tarball checksum set exists to
bind this audit to. Once #246 freezes: (a) re-run the Web a11y gate
([docs/rc-web-a11y-acceptance.md](rc-web-a11y-acceptance.md)) and this audit against that exact
SHA; (b) re-run the runbook tabletop against the frozen artifact; (c) attach candidate tarball
hashes here.

## Go / No-Go for RC

**GO for release-readiness on security & supply-chain grounds, CONDITIONAL on candidate binding.**

- No release-blocking security or supply-chain issue (F-1…F-10).
- No-publication invariant proven structurally: nothing in-tree can publish; #254 remains a
  non-existent, owner-gated future job (F-2, F-8).
- **Blocking condition before final RC sign-off:** the frozen `1.0.0-rc-ready.N` candidate (#246)
  must exist, and this audit + the a11y acceptance + the runbook tabletop must be re-affirmed
  against its exact SHA and artifact hashes (F-11). This is a sequencing gate, not a defect.
- **Recommended (non-blocking):** SHA-pin `actions/cache` (F-5); confirm GitHub private security
  advisories enabled (F-9).

No package or CLI publication occurred during this audit.

## Cross-references

- Release ruleset & owner gate: [docs/release-ruleset.md](release-ruleset.md)
- Release contract & gates: [docs/release.md](release.md)
- Incident runbook: [docs/rollback-runbook.md](rollback-runbook.md)
- Distribution reality: [docs/distribution-names.md](distribution-names.md)
- Consumer compatibility: [docs/consumer-compatibility-report.md](consumer-compatibility-report.md)
- Web a11y acceptance: [docs/rc-web-a11y-acceptance.md](rc-web-a11y-acceptance.md)
- Evidence classes: [docs/beeui-1.0-evidence-classes.md](beeui-1.0-evidence-classes.md)
</content>
