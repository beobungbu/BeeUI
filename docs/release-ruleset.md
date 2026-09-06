# Branch, tag and release ruleset (R6.10, #196)

This documents the live GitHub configuration that protects `main`, protects release tags, and gates the eventual publish workflow (#254) behind an explicit human approval. It is the audit trail for the repository rules and the contract enforced by `scripts/check-release-ruleset.mjs` and `scripts/__tests__/release-ruleset-contract.test.mjs`.

## Required-check design

BeeUI optimizes CI for wall-clock latency on public GitHub-hosted runners. Expensive independent work fans out immediately; stable required status names fan results back in.

`ci.yml` starts `classify`, then fans out `verify-fast` plus the change-scoped lanes `verify-docs`, `verify-tokens`, `verify-runtime`, `verify-release`, `verify-benchmark`, `bare-consumer`, `android-native` and `ios-native`. The branch-protection-required `verify` job is a lightweight `if: always()` aggregator over all of them, preserving the required status name while any failed upstream lane still blocks it.

The historical top-level `pnpm typecheck` and `pnpm test` commands remain useful local commands, and still run in full on every `development`/`staging` push (`beeui-environment-ci.yml`). On pull requests CI decomposes their constituent checks across the lanes above instead of executing the two long serial chains. `verify-fast` runs unconditionally and owns the CI policy contracts — including `release-ruleset:check`/`release-ruleset:test`, which pin this document to the real workflow topology — so a change to the required-check graph cannot land without re-validating it.

`classify` controls which lanes run at all. Every lane except `verify-fast` carries a job-level `if:`, so legitimate docs/test-only PRs skip the expensive work; none of them is branch-protection-required, because GitHub reports a skipped required check as unsatisfied.

`expo-consumer.yml` runs one combined JS proof job (typecheck plus the Web/Android/iOS Metro exports) and gates its native compiles on the same classifier.

The same conditional-status rule applies to `runtime-native.yml`'s `ios-runtime`/`android-runtime`, which are gated by main push, schedule/manual dispatch, or explicit PR runtime intent.

Standard GitHub-hosted runners are isolated, ephemeral VMs; BeeUI grants these workflows only `contents: read` and does not expose repository secrets to pull-request code. Required checks therefore also run for fork PRs.

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
| `classify` | `ci.yml` | No job-level `if:`; emits optional native-work decisions for every PR. |
| `verify` | `ci.yml` | `if: always()` fan-in over `classify` and every verification lane; it fails unless each selected lane succeeded or was legitimately skipped, and it fails outright if `classify` did not succeed. |
| `web-a11y` | `web-a11y.yml` | No conditional gate; axe-core/Playwright accessibility verification always runs. |
| `visual-web-report` | `visual-web.yml` | Gated only on `github.event_name == 'pull_request'`, which every pull request satisfies, so the context is always reported where branch protection evaluates it. |
| `web-consumer` | `web-consumer.yml` | No conditional gate; the independent Vite + react-native-web consumer always runs. |

### Intentionally excluded conditional/per-shard jobs

These remain real gates when scheduled, but are not branch-protection-required because legitimate PRs can skip them:

- `ci.yml`: `verify-docs`, `verify-tokens`, `verify-runtime`, `verify-release`, `verify-benchmark`, `bare-consumer`, `android-native`, `ios-native` — classifier-controlled work, split so independent compiles run concurrently.
- `runtime-native.yml`: `ios-runtime`, `android-runtime` — main push, weekly/manual, or explicit runtime PR intent.
- `visual-web.yml`: `visual-web-full` — the push-only, duration-balanced lane matrix; `visual-web-report` is the stable pull-request signal.

A push to `main` forces the full compile graph in `ci.yml`, and `runtime-native.yml` also runs simulator/emulator smoke on exact main. Weekly scheduled backstops catch hosted-runner/toolchain drift without duplicating the same work nightly.

## `main` branch ruleset

Applied as repository ruleset `main-required-checks-and-protections` (id `21888207`) to `refs/heads/main`.

The ruleset enforces pull-request merging, stale-review dismissal, the five strict required checks above, linear history, conversation resolution, force-push/deletion protection, and the repository-admin emergency bypass path.

## Tag protection ruleset (`v*`)

Ruleset `release-tag-protection` (id `21888212`) protects `refs/tags/v*`. No tag is created by ordinary CI verification.

## Release environment (`release`)

Environment id `20896613487` exists with required reviewer `beobungbu` and `prevent_self_review: false`. Every job that mutates the npm registry must set `environment: release`; green CI alone never authorizes npm publication or staging, a Git tag, GitHub Release, or dist-tag mutation. The owner/admin gate in [docs/beeui-1.0-owner-gates.md](beeui-1.0-owner-gates.md) stays authoritative even when the environment approval technically permits execution.

## npm release workflow

`.github/workflows/npm-release.yml` is the prepared npm transport. It is `workflow_dispatch` only and defaults to the non-mutating `verify` operation, so merely having the workflow in the repository publishes nothing.

Its registry-mutating operations are:

- `bootstrap-rc` — the one-time first-package prerelease bootstrap under `next`, because npm staged publishing cannot create a package that does not exist yet. It runs behind `environment: release`. Registry authentication is the temporary environment secret `NPM_BOOTSTRAP_TOKEN`, and the workflow exposes that secret to the final direct-publish step only: dependency install, release verification, builds, packing and registry probes do not inherit it. The job also grants job-local `id-token: write`, but solely because `npm publish --provenance` needs OIDC to mint the attestation — that grant is not Trusted Publisher authentication.
- `stage-rc` — steady-state prerelease staging once the packages exist. It runs behind `environment: release` with `contents: read` plus job-local `id-token: write`, authenticates to npm through Trusted Publishing/OIDC, and uses no long-lived publish token.

Both mutation paths require all of: dispatch from `refs/heads/main`; a checkout of the exact `GITHUB_SHA`; a workspace version matching the prerelease form pinned in [docs/dist-tag-policy.md](dist-tag-policy.md); the operator-entered `expected_version` equal to that workspace version; and the confirmation string `BEEUI_RC_RELEASE`. Preflight runs `pnpm release-control-plane:check`, `pnpm dist-policy:check` and `pnpm release:verify` before the environment-gated job can reach the registry. Registry existence probes treat only `E404`/404 as absence; any other probe failure stops the workflow instead of being read as "package missing".

The workflow does **not** implement stable `latest` publication. That remains #254 and requires an exact owner-approved candidate plus the promotion and recovery contract in [docs/dist-tag-policy.md](dist-tag-policy.md).

The npm-side owner handoff — token creation, teardown, and Trusted Publisher binding — is [docs/npm-release-bootstrap.md](npm-release-bootstrap.md).

## Trusted Publishing security boundary

After the first bootstrap, each `@beemvp/beeui-*` package binds an npm Trusted Publisher to GitHub owner `beobungbu`, repository `BeeUI`, workflow filename `npm-release.yml`, environment `release`, and the allowed action `npm stage publish` only. Staged publishing keeps a human 2FA approval between a green workflow and a public package.

Ordinary CI has neither publication credentials nor `id-token: write`. The temporary bootstrap token lives only in the protected `release` environment and is revoked once OIDC Trusted Publishing is configured and proven.

## CODEOWNERS

`.github/CODEOWNERS` maps `packages/`, `.github/workflows/`, `scripts/` and `registry/` to `@beobungbu`. `require_code_owner_reviews` remains off while BeeUI has only one maintainer.

## Hosted-runner assumptions

BeeUI's active workflows use standard `ubuntu-latest` and `macos-latest` GitHub-hosted runners. No correctness or security rule assumes a persistent self-hosted machine.

- Each job is treated as ephemeral.
- Workflow permissions default to `contents: read`.
- Pull-request workflows do not receive release/npm secrets.
- Registry-mutating jobs receive `id-token: write` only at job scope, and only where provenance or Trusted Publishing requires it.
- Public-repository runner minutes are treated as unmetered; CI is designed around wall-clock latency and finite concurrent-job/macOS limits.
- Initial PR scheduling is shaped to fill the 20-job budget with required/core work first; optional native work enters as slots become available.
- Independent native iOS proofs use separate macOS jobs so Showcase and bare-RN compiles can overlap.
- Large Xcode DerivedData is not persisted in Actions cache; bounded dependency/tool caches remain performance hints only.

## Rollback

The protection pieces remain independently reversible by the owner through GitHub repository settings/API. File-level policy changes are ordinary reviewed commits. Repository rulesets, tag protections, environment approvals, npm package settings, Trusted Publisher bindings and environment secrets stay owner/admin-controlled.

A failed or partial registry operation is never retried automatically. Stop, inventory the exact package/version state, artifact hashes and provenance, and get the recovery explicitly authorized before touching the registry again.
