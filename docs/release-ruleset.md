# Branch, tag and release ruleset (R6.10, #196)

This document records the GitHub controls that protect `main`, protect release tags, and gate registry mutation behind explicit human approval. It is the audit trail consumed by `scripts/check-release-ruleset.mjs` and `scripts/__tests__/release-ruleset-contract.test.mjs`.

## Required-check design

BeeUI fans independent CI work out early and uses stable aggregate status names for branch protection.

`ci.yml` starts `classify`, eight verification lanes (`quality`, `tokens`, `contracts`, `docs`, `types`, `showcase-registry`, `bench`, `release`) and Showcase export work. The required `verify` job is an `if: always()` fan-in so an upstream failure still produces a stable blocking status.

Conditional native/runtime jobs remain real evidence when scheduled but are not branch-protection-required because legitimate PRs may skip them. Standard GitHub-hosted runners are isolated, ephemeral VMs; ordinary PR workflows receive only `contents: read` and no npm/release credentials.

```json release-ruleset
{
  "requiredStatusChecks": ["classify", "verify", "web-a11y", "visual-web-report", "web-consumer"],
  "requiredApprovingReviewCount": 0,
  "tagRefPattern": "refs/tags/v*",
  "releaseEnvironment": "release"
}
```

### Required status checks

| Check | Workflow | Why it is always present |
| --- | --- | --- |
| `classify` | `ci.yml` | No job-level conditional gate; emits optional native/package-boundary decisions. |
| `verify` | `ci.yml` | `if: always()` fan-in over verification/export work. |
| `web-a11y` | `web-a11y.yml` | Always-run browser accessibility verification. |
| `visual-web-report` | `visual-web.yml` | Stable `if: always()` aggregate for visual shards. |
| `web-consumer` | `web-consumer.yml` | Always-run independent Vite + react-native-web consumer. |

### Intentionally excluded conditional/per-shard jobs

- `ci.yml`: `bare-bundle`, `bare-android`, `ios-showcase`, `ios-bare`
- `runtime-native.yml`: `ios-runtime`, `android-runtime`
- `visual-web.yml`: `visual-web` matrix shards; `visual-web-report` is the required aggregate

A push to `main` forces the full compile graph in `ci.yml`; runtime smoke has its own schedule/manual/main policy.

## `main` branch ruleset

Repository ruleset `main-required-checks-and-protections` (id `21888207`) targets `refs/heads/main`. It enforces pull-request merging, stale-review dismissal, the five strict required checks above, linear history, conversation resolution, force-push/deletion protection, and the repository-admin emergency bypass path.

## Tag protection ruleset (`v*`)

Ruleset `release-tag-protection` (id `21888212`) protects `refs/tags/v*`. Ordinary CI verification does not create release tags.

## Protected release environment

GitHub environment `release` (id `20896613487`) exists with required reviewer `beobungbu` and `prevent_self_review: false`. Green CI alone never authorizes npm publication/staging, Git tag creation, GitHub Release creation, or dist-tag mutation.

Any workflow job that mutates the npm registry must set:

```yaml
environment: release
```

The owner/admin gate in `docs/beeui-1.0-owner-gates.md` remains authoritative even when the environment approval technically permits execution.

## npm release workflow

`.github/workflows/npm-release.yml` is the prepared npm transport. It is intentionally `workflow_dispatch` only and defaults to the non-mutating `verify` operation.

Its registry-mutating operations are:

- `bootstrap-rc`: one-time first-package prerelease bootstrap under `next`; protected by `environment: release`; uses only the temporary environment secret `NPM_BOOTSTRAP_TOKEN`; no OIDC permission is granted to this token path.
- `stage-rc`: steady-state prerelease staging after package bootstrap; protected by `environment: release`; grants `contents: read` plus job-local `id-token: write`; uses npm Trusted Publishing/OIDC and no long-lived publish token.

Both mutation paths require an exact `20260902.0.0-rc.N` workspace version and the explicit confirmation string `BEEUI_RC_RELEASE`; preflight runs release-control-plane, distribution-policy and packed-release verification before the environment-gated job can mutate the registry.

The workflow does **not** implement stable `latest` publication. Stable publication remains #254 and requires an exact owner-approved candidate plus the stable transaction/recovery contract in `docs/dist-tag-policy.md`.

The detailed npm owner handoff is `docs/npm-release-bootstrap.md`.

## Trusted Publishing security boundary

After the first package bootstrap, each `@beemvp/beeui-*` package should bind npm Trusted Publisher to:

- GitHub owner/user `beobungbu`
- repository `BeeUI`
- workflow filename `npm-release.yml`
- environment `release`
- allowed action `npm stage publish` only

Only the OIDC staging job has `id-token: write`. Ordinary CI and bootstrap-token jobs do not. The temporary bootstrap token must live only in the protected `release` environment and must be revoked/deleted after OIDC is configured and proven.

## CODEOWNERS

`.github/CODEOWNERS` maps `packages/`, `.github/workflows/`, `scripts/` and `registry/` to `@beobungbu`. `require_code_owner_reviews` remains off while BeeUI has one maintainer.

## Hosted-runner assumptions

BeeUI release correctness/security assumes standard GitHub-hosted runners for OIDC publication work.

- jobs are treated as ephemeral;
- ordinary workflow permissions default to `contents: read`;
- PR workflows receive no npm publication authority;
- the OIDC publish/stage job uses `id-token: write` only where required;
- no correctness rule assumes persistent self-hosted state;
- release builds do not depend on mutable local runner caches for evidence.

## Rollback and owner control

Repository rulesets, tag protections, environment approvals, npm package settings, Trusted Publisher bindings, and environment secrets remain owner/admin-controlled. File-level policy/workflow changes are ordinary reviewed commits.

A failed or partial registry operation is not automatically retried. Stop and reconcile exact package/version state, artifact hashes and provenance before any recovery action.
