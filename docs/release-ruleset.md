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

Environment id `20896613487` exists with required reviewer `beobungbu` and `prevent_self_review: false`. The eventual #254 publish job must set `environment: release`; green CI alone never authorizes npm publication, a Git tag, GitHub Release, or dist-tag mutation.

## CODEOWNERS

`.github/CODEOWNERS` maps `packages/`, `.github/workflows/`, `scripts/` and `registry/` to `@beobungbu`. `require_code_owner_reviews` remains off while BeeUI has only one maintainer.

## Hosted-runner assumptions

BeeUI's active workflows use standard `ubuntu-latest` and `macos-latest` GitHub-hosted runners. No correctness or security rule assumes a persistent self-hosted machine.

- Each job is treated as ephemeral.
- Workflow permissions default to `contents: read`.
- Pull-request workflows do not receive release/npm secrets.
- Public-repository runner minutes are treated as unmetered; CI is designed around wall-clock latency and finite concurrent-job/macOS limits.
- Initial PR scheduling is shaped to fill the 20-job budget with required/core work first; optional native work enters as slots become available.
- Independent native iOS proofs use separate macOS jobs so Showcase and bare-RN compiles can overlap.
- Large Xcode DerivedData is not persisted in Actions cache; bounded dependency/tool caches remain performance hints only.

## Rollback

The protection pieces remain independently reversible by the owner through GitHub repository settings/API. File-level policy changes are ordinary reviewed commits.
