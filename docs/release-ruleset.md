# Branch, tag and release ruleset (R6.10, #196)

This documents the live GitHub configuration that protects `main`, protects release tags, and gates the eventual publish workflow (#254) behind an explicit human approval. It is the audit trail for the repository rules and the contract enforced by `scripts/check-release-ruleset.mjs` and `scripts/__tests__/release-ruleset-contract.test.mjs`.

## Required-check design

BeeUI optimizes CI for wall-clock latency on public GitHub-hosted runners. Expensive independent work fans out immediately; stable required status names fan results back in.

`ci.yml` starts `classify` and then fans out one always-on lane (`verify-fast`) plus six affected-first lanes (`verify-docs`, `verify-tokens`, `verify-runtime`, `verify-release`, `verify-benchmark`, `bare-consumer`) and two conditional native compile lanes (`android-native`, `ios-native`). The branch-protection-required `verify` job is a lightweight `if: always()` aggregator over every one of those lanes, preserving the required status name while any failed or skipped-but-required upstream lane still blocks it.

The historical top-level `pnpm typecheck` and `pnpm test` commands remain useful local commands, but CI decomposes their constituent checks across the lanes instead of executing the two long serial chains. `verify-fast` carries the repository-policy and CI-contract checks with no `if:` gate, so classifier/native-CI topology tests run on every pull request and `classify` itself stays on the shortest possible path to native fan-out.

`classify` selects which verification and native lanes a pull request actually needs. `bare-consumer` and `android-native` are independent Linux jobs; `ios-native` is an independent macOS job. Legitimate docs-only or test-only PRs can skip those jobs, so none of the classifier-gated lanes is branch-protection-required — only `classify` and the `verify` fan-in are.

Affected-first selection applies **only to pull requests targeting `development`**. Every other event — a push to `development`, `staging` or `main`, the weekly schedule, and manual dispatch — sets `full-ci`, so integration checkpoints and promotion candidates always get the whole graph. That is what makes #474 rule 12 ("verify the integrated exact head, not the sibling PR head") mechanically enforceable rather than aspirational.

`expo-consumer.yml` stages three jobs at initial PR fan-out (`typecheck-web`, Android export, iOS export). Together with required/core workflows this targets the 20-job hosted concurrency budget instead of oversubscribing it at t=0. Expo native compiles become eligible after `typecheck-web` frees a slot.

The same conditional-status rule applies to `runtime-native.yml`'s `ios-runtime`/`android-runtime`, which are gated by a `staging`/`main` push, schedule/manual dispatch, or explicit PR runtime intent.

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

- `ci.yml`: `verify-docs`, `verify-tokens`, `verify-runtime`, `verify-release`, `verify-benchmark`, `bare-consumer`, `android-native`, `ios-native` — classifier-controlled verification and package/native work, split so independent lanes and compiles run concurrently.
- `runtime-native.yml`: `ios-runtime`, `android-runtime` — main push, weekly/manual, or explicit runtime PR intent.
- `visual-web.yml`: `visual-web-full` matrix shards; `visual-web-report` is the stable aggregate signal.

A push to `development`, `staging` or `main` forces the full compile graph in `ci.yml` and re-runs `expo-consumer.yml` on the exact integrated head; `runtime-native.yml` additionally runs simulator/emulator smoke on the `staging` promotion candidate and on exact `main`. Weekly scheduled backstops catch hosted-runner/toolchain drift without duplicating the same work nightly.

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
