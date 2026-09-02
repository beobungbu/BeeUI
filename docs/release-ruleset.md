# Branch, tag and release ruleset (R6.10, #196)

This documents the live GitHub configuration that protects `main`, protects release tags, and gates the eventual publish workflow (#254) behind an explicit human approval. It is the audit trail for the repository rules and the contract enforced by `scripts/check-release-ruleset.mjs` (wired into `pnpm typecheck`) and `scripts/__tests__/release-ruleset-contract.test.mjs` (wired into `pnpm test`).

## Required-check design

`ci.yml`'s `classify` job decides whether `bare-native` and `ios-native` run. On a docs/test-only pull request those conditional jobs can legitimately report **skipped**, so they must not be branch-protection-required.

The same applies to `runtime-native.yml`'s `ios-runtime`/`android-runtime`, which are gated by main push, schedule/manual dispatch, or explicit PR runtime intent.

Required status checks are restricted to jobs that always attempt to run on every ordinary pull request. Standard GitHub-hosted runners are isolated, ephemeral VMs; BeeUI grants these workflows only `contents: read` and does not expose repository secrets to pull-request code. Therefore required checks also run for fork PRs instead of disappearing behind the old same-repository guard.

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
| `verify` | `ci.yml` | `needs: [classify]`, but no conditional gate; typecheck, tests, release verification and Showcase exports always run. |
| `web-a11y` | `web-a11y.yml` | No conditional gate; axe-core/Playwright accessibility verification always runs. |
| `visual-web-report` | `visual-web.yml` | `if: always()` so the aggregate status exists even when a visual shard fails; it reports/fails for the complete shard matrix. |
| `web-consumer` | `web-consumer.yml` | No conditional gate; the independent Vite + react-native-web consumer always runs. |

### Intentionally excluded conditional/per-shard jobs

These remain real gates when scheduled, but are not branch-protection-required because legitimate PRs can skip them:

- `ci.yml`: `bare-native`, `ios-native` — classifier-controlled native/package-boundary work.
- `runtime-native.yml`: `ios-runtime`, `android-runtime` — main push, weekly/manual, or explicit runtime PR intent.
- `visual-web.yml`: `visual-web (1/2/3)` — all shards run, but requiring each generated matrix name is fragile; `visual-web-report` is the stable aggregate required signal.

A push to `main` forces the full compile graph in `ci.yml`, and `runtime-native.yml` now also runs its simulator/emulator smoke on exact main. Weekly scheduled backstops catch hosted-runner/toolchain drift without duplicating the same work nightly.

## `main` branch ruleset

Applied as repository ruleset `main-required-checks-and-protections` (id `21888207`) to `refs/heads/main`, layered on top of the existing legacy protection where applicable.

The ruleset enforces:

- **Require a pull request before merging** — `required_approving_review_count: 0`. BeeUI currently has one owner/maintainer, who cannot approve their own PR; a non-zero approval count would deadlock the normal owner path.
- **Dismiss stale reviews on push**.
- **Required status checks** — the five stable checks above, strict/up-to-date.
- **Block force pushes**, **block deletion**, **required linear history**.
- **Required conversation resolution**.
- **Bypass actor**: repository admin role only, `bypass_mode: always`, retained solely as the owner emergency-recovery path.

Fork contributions do not require a bypass: their required checks run on GitHub-hosted VMs with read-only permissions. Conditional native jobs can still run when the classifier or an explicit label requires them.

## Tag protection ruleset (`v*`)

Ruleset `release-tag-protection` (id `21888212`) protects `refs/tags/v*`:

- tag creation/update/deletion is blocked outside the admin bypass path;
- tagged commits are required to be signed/verified for non-bypassing actors;
- repository admin is the sole emergency bypass role.

No tag is created by ordinary CI verification.

## Release environment (`release`)

Environment id `20896613487` exists with required reviewer `beobungbu` and `prevent_self_review: false`. A single-maintainer repository cannot require a different reviewer without deadlocking release authorization.

The eventual #254 publish job **must** set `environment: release`, so merging an approved/green PR remains necessary but insufficient to publish. Technical readiness does not authorize npm publication, a Git tag, a GitHub Release, or a dist-tag mutation.

## CODEOWNERS

`.github/CODEOWNERS` maps `packages/`, `.github/workflows/`, `scripts/` and `registry/` to `@beobungbu`. `require_code_owner_reviews` remains off while BeeUI has only one maintainer; CODEOWNERS still documents ownership and becomes useful automatically when another eligible reviewer exists.

## Hosted-runner assumptions

BeeUI's active workflows use standard `ubuntu-latest` and `macos-latest` GitHub-hosted runners. No correctness or security rule assumes a persistent self-hosted machine.

- Each job is treated as ephemeral.
- Workflow permissions default to `contents: read` unless a narrowly scoped future release job explicitly needs more.
- Pull-request workflows do not receive release/npm secrets.
- Native classification remains for latency and finite concurrency, not to save public-repository runner minutes.
- Large Xcode DerivedData is not persisted in Actions cache; bounded dependency/tool caches remain performance hints only.

## Rollback

The protection pieces remain independently reversible by the owner through GitHub repository settings/API. File-level policy changes are ordinary reviewed commits.

Live resource IDs:

- Branch ruleset `main-required-checks-and-protections`: `21888207`.
- Tag ruleset `release-tag-protection`: `21888212`.
- Environment `release`: `20896613487`.
