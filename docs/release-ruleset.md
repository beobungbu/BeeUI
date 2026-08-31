# Branch, tag and release ruleset (R6.10, #196)

This documents the live GitHub configuration that protects `main`, protects
release tags, and gates the eventual publish workflow (#254) behind an
explicit human approval. It is the audit trail for the `gh api` calls that
were applied, and the contract enforced by `scripts/check-release-ruleset.mjs`
(wired into `pnpm typecheck`) and
`scripts/__tests__/release-ruleset-contract.test.mjs` (wired into `pnpm test`).

## The skip-trap this avoids

`ci.yml`'s `classify` job decides whether `bare-native` and `ios-native` run
at all (see `docs/ci-native-classification.md`). On a JS-only/docs pull
request those jobs report **skipped**, not success. GitHub treats a skipped
required status check as unsatisfied, so requiring a conditionally-skipped
job would deadlock every PR that legitimately skips it.

The same applies to `runtime-native.yml`'s `ios-runtime`/`android-runtime`
(gated by label/head-ref/schedule) and `compat-rn-0-87.yml`'s
`bare-android-rn87`/`bare-ios-rn87` (gated by the `ci:rn-0.87` label).

Required status checks are therefore restricted to jobs whose `if:`
condition is nothing more than the plain same-repo fork-guard (or that guard
wrapped in `always()`, as `visual-web-report` does to bypass the default
needs-skip propagation from its shard matrix) — i.e. jobs that always attempt
to run on an ordinary same-repo pull request, native or not.

```json release-ruleset
{
  "requiredStatusChecks": ["classify", "verify", "web-a11y", "visual-web-report", "web-consumer"],
  "requiredApprovingReviewCount": 0,
  "tagRefPattern": "refs/tags/v*",
  "releaseEnvironment": "release"
}
```

### Required status checks (validated against live workflow runs)

| Check | Workflow | Why it is always present |
| --- | --- | --- |
| `classify` | `ci.yml` | Runs unconditionally (only the fork-guard); it is what produces the native-required flags. |
| `verify` | `ci.yml` | `needs: [classify]` but its own `if:` is only the fork-guard — typecheck, unit tests, release-contract verification, web/Android/iOS Expo export always run. |
| `web-a11y` | `web-a11y.yml` | Only the fork-guard; the axe-core/Playwright a11y gate always runs. |
| `visual-web-report` | `visual-web.yml` | `if: always() && (<fork-guard>)` — the merge/report job for the `visual-web` shard matrix. It always runs and is the single authoritative signal for the whole workflow. |
| `web-consumer` | `web-consumer.yml` | Only the fork-guard; the independent Vite + react-native-web consumer check always runs. |

### Intentionally excluded (conditional/native/per-shard jobs)

These are real, blocking gates **when they run** — they are excluded from
the *required-check* list only because GitHub reports "skipped" for them on
PRs that do not need them, and a skipped required check blocks merge:

- `ci.yml`: `bare-native`, `ios-native` — gated on
  `needs.classify.outputs.*-required`.
- `runtime-native.yml`: `ios-runtime`, `android-runtime` — gated on
  schedule/workflow_dispatch/label/head-ref.
- `compat-rn-0-87.yml`: `bare-android-rn87`, `bare-ios-rn87` — gated on the
  `ci:rn-0.87` label.
- `visual-web.yml`: the per-shard `visual-web (1/2/3)` matrix checks —
  always run, but requiring each shard by name is fragile against a future
  shard-count change; `visual-web-report` already depends on the full matrix
  (`needs: [visual-web]`) and always runs after it, so it is the required
  signal instead.

A push to `main` (not a PR) always forces the full native graph
(`BEEUI_FORCE_NATIVE` in `ci.yml`), so merged commits on `main` still get the
full native compile proof; only PR-time required-check gating is narrowed to
avoid the skip-trap.

## `main` branch ruleset

Applied as a repository ruleset (`gh api repos/beobungbu/BeeUI/rulesets`,
target `branch`, `refs/heads/main`) layered on top of the pre-existing legacy
branch protection (which already set `dismiss_stale_reviews`,
`required_linear_history`, `required_conversation_resolution`, and disabled
force-push/deletion — left untouched, non-conflicting, and independently
reversible from the ruleset). The ruleset adds:

- **Require a pull request before merging** — `required_approving_review_count: 0`.
  `beobungbu` is BeeUI's sole owner/maintainer and cannot approve their own
  pull request; requiring >=1 approval would deadlock every merge. The
  no-bypass guarantee for ordinary contributors instead comes from: PR
  required (no direct push), dismiss-stale-reviews, required status checks,
  and no self-bypass for anyone without the repository's `admin` role. The
  owner reviewing and merging their own PR is the accepted single-maintainer
  path documented here, not an oversight.
- **Dismiss stale reviews on push** — any new commit invalidates prior
  approval state.
- **Required status checks** — the five checks above, `strict` (branch must
  be up to date before merging).
- **Block force pushes**, **block deletion**, **required linear history**.
- **Bypass actors**: `RepositoryRole` `admin` (role id `5`, i.e. the owner),
  `bypass_mode: always`. This is the explicit emergency-recovery exception:
  only the repository owner/admin can merge or push past these checks
  (e.g. to recover from a stuck runner or infrastructure outage), and no
  other collaborator or bot identity is listed. Ordinary contributors and
  agents cannot bypass.

## Tag protection ruleset (`v*`)

Applied as a repository ruleset, target `tag`, `refs/tags/v*`:

- **Block tag creation, update and deletion** by anyone other than the
  bypass list.
- **Require signed commits** (`required_signatures`) on the tagged ref —
  the chosen signed/verified-release posture: release tags must point at a
  signed commit. This costs the owner nothing today (the owner bypasses the
  ruleset entirely as `admin`) but is a real, non-bypassable rule for any
  future non-admin collaborator, and documents intent ahead of the publish
  workflow.
- **Bypass actors**: `RepositoryRole` `admin`, `bypass_mode: always` — same
  emergency-recovery exception as `main`. A release tag is a stronger action
  than an ordinary merge, so it is deliberately not delegated to anyone
  without repository admin.

## Release environment (`release`)

Created via `gh api repos/beobungbu/BeeUI/environments/release` with
**required reviewers = `beobungbu`** (the owner) and `prevent_self_review:
false`. Self-review cannot be prevented in a single-maintainer repository —
the same rationale as `required_approving_review_count: 0` above: the
person triggering a release and the person authorized to approve it are
necessarily the same account until BeeUI has more than one maintainer.

This environment has **no branch/tag policy configured yet** beyond the
default (`custom_branch_policies` disabled) because #254 (the publish
workflow) does not exist yet and there is nothing to scope it to. **#254's
publish job MUST set `environment: release`** on whichever job performs the
actual `npm publish`/GitHub Release creation, so that job cannot run without
an explicit approval from `beobungbu` in the GitHub Actions UI — separate
from, and narrower than, the merge permission granted by the `main` ruleset
above (an approved, merged PR is necessary but not sufficient to publish).

## CODEOWNERS

`.github/CODEOWNERS` maps `packages/`, `.github/workflows/`, `scripts/` and
`registry/` to `@beobungbu`. `require_code_owner_reviews` stays **off** on
the branch ruleset/protection: turning it on today would require the sole
owner to approve their own review request on every PR touching those paths,
which deadlocks in the same way a non-zero `required_approving_review_count`
would. CODEOWNERS exists now as documentation of ownership and so it takes
effect automatically the day a second maintainer with write access joins,
without another ruleset change.

## Rollback

Every piece here is independently reversible:

- `gh api -X DELETE repos/beobungbu/BeeUI/rulesets/<id>` removes either
  ruleset without touching the other or the legacy branch protection.
- `gh api -X DELETE repos/beobungbu/BeeUI/environments/release` removes the
  release environment/approval gate.
- Deleting `.github/CODEOWNERS` or reverting this doc are ordinary file
  changes.

See the pull request body for #196 for the exact `gh api` commands and
payloads applied. Live resource IDs from that run, for direct rollback:

- Branch ruleset `main-required-checks-and-protections`: id `21888207`
  (`https://github.com/beobungbu/BeeUI/rules/21888207`).
- Tag ruleset `release-tag-protection`: id `21888212`
  (`https://github.com/beobungbu/BeeUI/rules/21888212`).
- Environment `release`: id `20896613487`.
