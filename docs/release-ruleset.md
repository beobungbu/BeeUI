# Branch, tag and release ruleset (R6.10, #196)

This documents the live GitHub configuration that protects `main`, protects release tags, and gates the eventual publish workflow (#254) behind an explicit human approval. It is the audit trail for the repository rules and the contract enforced by `scripts/check-release-ruleset.mjs` and `scripts/__tests__/release-ruleset-contract.test.mjs`.

## Required-check design

BeeUI now optimizes CI for wall-clock latency on public GitHub-hosted runners. Expensive independent work fans out immediately; stable required status names fan the results back in.

`ci.yml` starts `classify`, three `verify-check` lanes (`static`, `tests`, `release`) and three Showcase bundle lanes (`web`, `android`, `ios`) in parallel. The branch-protection-required `verify` job is a lightweight `if: always()` aggregator over those lanes, so the required check name remains stable while failures in any parallel lane still block it.

`classify` controls only conditional native/package-boundary work. `bare-bundle` and `bare-android` are independent Linux jobs; `ios-showcase` and `ios-bare` are independent macOS jobs. Legitimate docs/test-only PRs can skip those jobs, so none is branch-protection-required.

The same applies to `runtime-native.yml`'s `ios-runtime`/`android-runtime`, which are gated by main push, schedule/manual dispatch, or explicit PR runtime intent.

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
| `classify` | `ci.yml` | No job-level `if:`; classifies optional native work for every PR. |
| `verify` | `ci.yml` | `if: always()` fan-in over `classify`, the three verification lanes and the three Showcase platform exports; it fails unless every required upstream lane succeeds. |
| `web-a11y` | `web-a11y.yml` | No conditional gate; axe-core/Playwright accessibility verification always runs. |
| `visual-web-report` | `visual-web.yml` | `if: always()` aggregate for the full visual shard matrix. |
| `web-consumer` | `web-consumer.yml` | No conditional gate; the independent Vite + react-native-web consumer always runs. |

### Intentionally excluded conditional/per-shard jobs

These remain real gates when scheduled, but are not branch-protection-required because legitimate PRs can skip them:

- `ci.yml`: `bare-bundle`, `bare-android`, `ios-showcase`, `ios-bare` — classifier-controlled package/native work, split so independent compiles run concurrently.
- `runtime-native.yml`: `ios-runtime`, `android-runtime` — main push, weekly/manual, or explicit runtime PR intent.
- `visual-web.yml`: `visual-web (1/2/3)` — matrix shards; `visual-web-report` is the stable aggregate signal.

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
- Public-repository runner minutes are treated as unmetered; CI is designed around wall-clock latency and the account's finite concurrent-job/macOS limits.
- The heaviest topology deliberately fans out until the GitHub-hosted concurrency budget is saturated instead of serializing independent work.
- Large Xcode DerivedData is not persisted in Actions cache; bounded dependency/tool caches remain performance hints only.

## Rollback

The protection pieces remain independently reversible by the owner through GitHub repository settings/API. File-level policy changes are ordinary reviewed commits.
