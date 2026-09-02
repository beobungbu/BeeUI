# Branch, tag and release ruleset (R6.10, #196)

This documents the live GitHub configuration that protects `main`, protects release tags, and gates the eventual publish workflow (#254) behind an explicit human approval. It is the audit trail for the repository rules and the contract enforced by `scripts/check-release-ruleset.mjs` and `scripts/__tests__/release-ruleset-contract.test.mjs`.

## Required-check design

BeeUI optimizes CI for wall-clock latency on public GitHub-hosted runners. Expensive independent work fans out immediately; stable required status names fan results back in.

`ci.yml` starts `classify`, eight `verify-lane` jobs (`quality`, `tokens`, `contracts`, `docs`, `types`, `showcase-registry`, `bench`, `release`) and three Showcase bundle jobs (`web`, `android`, `ios`) in parallel. The branch-protection-required `verify` job is a lightweight `if: always()` aggregator over those lanes, preserving the required status name while any failed upstream lane still blocks it.

The historical top-level `pnpm typecheck` and `pnpm test` commands remain useful local commands, but CI decomposes their constituent checks across the eight lanes instead of executing the two long serial chains. The `contracts` lane also runs classifier/native-CI topology tests, so `classify` itself stays on the shortest possible path to native fan-out.

`classify` controls only conditional native/package-boundary work. `bare-bundle` and `bare-android` are independent Linux jobs; `ios-showcase` and `ios-bare` are independent macOS jobs. Legitimate docs/test-only PRs can skip those jobs, so none is branch-protection-required.

`expo-consumer.yml` stages three jobs at initial PR fan-out (`typecheck-web`, Android export, iOS export). Together with required/core workflows this targets the 20-job hosted concurrency budget instead of oversubscribing it at t=0. Expo native compiles become eligible after `typecheck-web` frees a slot.

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
| `verify` | `ci.yml` | `if: always()` fan-in over `classify`, all eight verification lanes and all three Showcase platform exports; it fails unless every required upstream lane succeeds. |
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
- Public-repository runner minutes are treated as unmetered; CI is designed around wall-clock latency and finite concurrent-job/macOS limits.
- Initial PR scheduling is shaped to fill the 20-job budget with required/core work first; optional native work enters as slots become available.
- Independent native iOS proofs use separate macOS jobs so Showcase and bare-RN compiles can overlap.
- Large Xcode DerivedData is not persisted in Actions cache; bounded dependency/tool caches remain performance hints only.

## Rollback

The protection pieces remain independently reversible by the owner through GitHub repository settings/API. File-level policy changes are ordinary reviewed commits.
