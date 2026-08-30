# R6 security batch — #187, #193, #194

Branch `chore/r6-security-hardening`, base `71f79aa`. Config/docs/scripts only, no `packages/ui` source touched.

## #187 — secret / history / asset audit

**Scope scanned:** full working tree + full git history (757 commits).

Tools/methods used:
- `gitleaks detect --source . --log-opts="--all"` → **no leaks found** (757 commits, ~10MB scanned).
- Manual regex sweep (working tree, all non-`.git`/`node_modules` files) for AWS keys
  (`AKIA...`), PEM/private-key headers, Slack/GitHub/OpenAI-style tokens
  (`xox*`, `ghp_*`, `sk-*`), Google API keys → **0 matches**.
- `git log -p --all -S"BEGIN RSA PRIVATE KEY"` / `-S"AKIA"` → **0 matches**.
- `git log --all -- '*.env' '*.pem' '*.p12' '*.key' '*.keystore' '*.jks'` → **no such
  file ever committed** (only `.env.example` exists; `.gitignore` already excludes
  `.env`/`.env.*`).
- Email sweep across tracked files → only the project's own fixture email
  (`visual@beeui.dev`, used in visual-regression test fixtures) and an upstream npm
  package's own deprecation-notice contact (`i@izs.me`, inside `pnpm-lock.yaml`
  metadata for the `glob` package — not BeeUI-authored, not private). No personal
  emails beyond the repo owner.
- Infra/hostname sweep (IPs, `.local`, `ssh://`, "tailscale", self-hosted runner
  hints) → only harmless, already-documented items: the CI runner **labels**
  `beeui` / `beeui-macos` (labels only — no address, credential, or hostname; the
  actual runner network location is never present in any tracked file) and the
  well-known Android-emulator loopback `10.0.2.2:8081` (public Android documentation
  convention, referenced in a plan report and a runtime-smoke script, not an
  internal address).
- Screenshot/asset review: all committed binary assets are
  `apps/visual-regression/tests/__screenshots__/*.png` — generated Playwright
  visual-regression baselines of BeeUI's own component gallery (buttons, dialogs,
  forms, etc.). No customer data, no third-party brand assets beyond the design
  system's own dataviz-brand tokens, fully redistributable with the source.
- `plans/` directory (9 tracked files, committed on `main` via prior legitimate
  `docs(plans):`/report commits) reviewed for internal process leakage
  (rate cards, personal names, other infra) → clean; only technical
  implementation notes about already-public BeeUI behavior.

**Result: no secrets, credentials, or non-owner private data found in working
tree or history.** No `OWNER_ACTION_REQUIRED` rotation/history-rewrite items.
No hygiene fixes were needed beyond what already existed (`.gitignore` already
covers `.env`/`.env.*`, `!.env.example`).

## #193 — GitHub Actions hardening

Audited all 4 workflows: `ci.yml`, `runtime-native.yml`, `visual-web.yml`, `web-a11y.yml`.
No `pull_request_target` anywhere (confirmed by grep) — already safe on that axis.
No `secrets.*` reference anywhere — no release/publish workflow exists yet, so
release-credential/OIDC isolation from ordinary CI is **not applicable yet**
(flagged as forward-looking note below, not a current finding).

### Findings and fixes

1. **Missing `permissions:` everywhere (all 4 workflows).** Added a top-level
   `permissions: contents: read` to each workflow. Verified no job needs more:
   `actions/upload-artifact` / `download-artifact` use the runner's
   `ACTIONS_RUNTIME_TOKEN`, not the `GITHUB_TOKEN` `permissions:` scope, so no
   per-job elevation was required.

2. **Self-hosted runner + fork PR exposure — the real finding.** `ci.yml`'s
   `verify` job, `visual-web.yml`, and `web-a11y.yml` ran `pull_request`
   (including from forks) directly on `[self-hosted, beeui]` with **no
   same-repo guard**. Unlike the token-permission risk, this is a code-execution
   risk regardless of token scope: a fork PR's checked-out code runs `pnpm
   install`/`pnpm test`/etc. directly on our infrastructure. Only `ci.yml`'s
   `ios-native` job already had a same-repo check
   (`github.event.pull_request.head.repo.full_name == github.repository`).
   Fixed by adding a job-level `if:` gate (never-fork-on-`pull_request`,
   always-true for `push`/`schedule`) to:
   - `ci.yml` → `verify` (which cascades: `bare-native` and `ios-native` already
     key off `needs.verify.outputs.*`/`needs.verify.result`, so they
     automatically no-op when `verify` is skipped — verified this cascade holds
     by inspection, no `always()` override bypasses it on `bare-native`).
   - `visual-web.yml` → `visual-web` job.
   - `web-a11y.yml` → `web-a11y` job.
   - `runtime-native.yml` → `ios-runtime` / `android-runtime`: these were
     already restricted to `schedule`/`workflow_dispatch`/a magic branch name
     or `ci:runtime` label, but a fork branch could reuse that branch name, or
     a maintainer could label a fork PR without realizing runtime-smoke runs on
     the self-hosted Mac. Added the explicit same-repo check as
     defense-in-depth alongside the existing gate.

   This is purely an added `if:` condition — **no `runs-on:` label, trigger, or
   currently-green same-repo behavior changed** (the repo is private today, so
   the new condition evaluates true for every PR that currently runs; behavior
   only diverges once a fork PR becomes possible, which is exactly the case
   this closes before the repo goes public). Confirmed with
   `node --test ./scripts/__tests__/classify-ci-changes.test.mjs
   ./scripts/__tests__/ios-build-cache-contract.test.mjs` (32/32 pass — these
   assert on the workflow's text/behavior) and full `pnpm typecheck` + `pnpm
   test` (66 suites / 716 tests pass).

3. **Third-party/GitHub actions not pinned to commit SHAs.** All 6 distinct
   `uses:` (`actions/checkout@v5`, `actions/setup-node@v5`,
   `actions/setup-java@v5`, `actions/upload-artifact@v6`,
   `actions/download-artifact@v7`, `android-actions/setup-android@v4`) pinned
   to the commit SHA the tag currently resolves to, with a trailing
   `# vX.Y.Z` comment for readability (resolved via `gh api
   repos/<owner>/<repo>/git/refs/tags/<tag>`, all confirmed `type: commit`).
   Chose to pin GitHub-owned `actions/*` too, not just the third-party
   `android-actions/setup-android`, for uniform supply-chain protection against
   a compromised/re-tagged release — the review-checklist policy explicitly
   prefers SHA pinning over major-tag trust.

4. **Script injection via `${{ github.event.* }}` in `run:`.** Reviewed every
   interpolation. All existing uses were already safe: SHAs/booleans passed
   through `env:` (never string-substituted directly into a `run:` script
   body), or used only inside workflow-expression `if:`/`contains(...)`
   contexts (evaluated by the Actions expression engine, not the shell). No
   PR title/body/label free-text is ever interpolated into a `run:` string.
   No changes needed here; documented as an audit pass, not a fix.

5. **Cache poisoning boundary.** `ci.yml`'s iOS pod-install cache is a custom
   `rsync`-based snapshot under a fixed `~/Library/Caches/BeeUI` path on the
   self-hosted Mac, keyed by a hash of the entire post-prebuild `ios/` tree +
   lockfile + app config — not GitHub's `actions/cache` service (which has
   known cross-branch/cross-fork poisoning exposure on public repos). Since
   fork PRs can no longer reach this runner at all (finding 2), this local
   cache is only reachable by same-repo, already-trusted branches. No change
   made; documented as reviewed.

6. **Release credentials / OIDC isolation.** Not applicable: no
   publish/release automation exists in `.github/workflows/` yet. Flagged as a
   forward-looking requirement for whichever future issue adds npm
   publish/GitHub release automation — that workflow should get its own
   `permissions:` (e.g. `id-token: write` only on that job) and never share a
   trigger surface with `pull_request`.

All 4 edited YAML files re-validated with `python -c "import yaml; yaml.safe_load(...)"` — all parse.
`git diff --check` clean (no whitespace errors).

## #194 — dependency/vulnerability automation

Added `.github/dependabot.yml` (Dependabot, not Renovate — chosen because it's
zero-infrastructure on GitHub-hosted infra, the repo already lives entirely on
GitHub, and the review checklist/contract already assumes GitHub-native
tooling; Renovate would need its own bot/app installation for no added benefit
at this repo's current size).

- `npm` ecosystem, `directory: "/"`: this is a pnpm monorepo
  (`pnpm-workspace.yaml`: `apps/*`, `packages/*`) with one root
  `pnpm-lock.yaml`; Dependabot's npm updater auto-detects pnpm from the
  lockfile and resolves the whole workspace from a single root entry.
- `safe-patch-minor` group: patch/minor only, explicitly excluding
  `expo*`/`react-native*`/`@react-native/*`/`react`/`react-dom` so native-graph
  and React-major-sensitive bumps always land as individually reviewable PRs,
  never silently batched.
- `ignore` block: blocks Dependabot from proposing (not just grouping) major
  bumps of `react-native`/`expo`/`react` — those are owner-gated per
  `docs/agent-execution-contract.md`.
- Security-update behavior is untouched (Dependabot always opens immediate,
  ungrouped PRs for vulnerability alerts regardless of the `updates:`
  schedule) — grouping only applies to `version-updates`, so security PRs stay
  highest-priority/visible by default.
- Verified the native-compile-gate requirement is **already satisfied without
  new CI wiring**: `scripts/classify-ci-changes.mjs` already lists
  `pnpm-lock.yaml` and root `package.json` in `SHOWCASE_NATIVE_EXACT_PATHS`, so
  *any* Dependabot PR (any dependency, any bump size) already forces the Expo
  Prebuild + iOS Simulator compile gate in `ci.yml`'s `verify`/`ios-native`
  jobs — confirmed by reading the classifier source, not just assuming labels.
- `github-actions` ecosystem, `directory: "/"`, single `github-actions` group
  (all patch/minor bumps batched — low risk since these are dev-time-only and,
  post-#193, SHA-pinned so Dependabot's PR body will show the exact commit
  diff being proposed).
- No auto-merge configured anywhere (Dependabot config has no `automerge`/
  merge-related keys) — every PR requires human review per the
  lockfile-determinism requirement.

## Self-test

- `node ./scripts/check-repo-hygiene.mjs` → pass.
- All 5 edited/added YAML files → parse clean (`yaml.safe_load`).
- `git diff --check` → clean.
- `pnpm typecheck` (hygiene + tokens + tokens-consumption + compat-matrix + 5
  workspace `tsc` projects) → green.
- `pnpm test` → 66 suites / 716 tests pass; registry verify (67 items) +
  registry test suite (29/29) pass.
- `node --test classify-ci-changes.test.mjs ios-build-cache-contract.test.mjs`
  → 32/32 pass (proves the `ci.yml` edits didn't disturb the classifier
  contract the workflow depends on).

## OWNER_ACTION_REQUIRED

None. No secrets found (#187), no credential rotation needed, no history
rewrite needed. The only forward-looking note is non-blocking: when a future
issue adds npm-publish/GitHub-release automation to Actions, give that
workflow its own least-privilege `permissions:` (isolated from this batch's
`contents: read` default) rather than reusing `ci.yml`.

## Files changed

- `.github/workflows/ci.yml` — `permissions:`, fork guard on `verify`, SHA-pin 8 `uses:`.
- `.github/workflows/runtime-native.yml` — `permissions:`, same-repo guard on both jobs, SHA-pin 6 `uses:`.
- `.github/workflows/visual-web.yml` — `permissions:`, fork guard, SHA-pin 3 `uses:`.
- `.github/workflows/web-a11y.yml` — `permissions:`, fork guard, SHA-pin 4 `uses:`.
- `.github/dependabot.yml` — new.
