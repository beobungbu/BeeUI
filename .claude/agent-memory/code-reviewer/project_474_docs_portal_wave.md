---
name: project-474-docs-portal-wave
description: WBS #474 docs-portal wave context — per-check verification instead of pnpm typecheck, and the pre-existing release-ruleset failure on development
metadata:
  type: project
---

The #474 docs-portal work breakdown (sub-issues #455 B010/B011, #457 D030, #459 E040, #463 D033, #472, #473) lands as a series of `feat/*` PRs onto `development`. Each PR body carries an `AUTHORITATIVE_BASE_SHA` and a self-reported verification table.

**Why:** the wave is content-heavy and gated by machine checks (`docs:foundation:check`, `site:contract:check`, `docs:surface:check`, `check-public-doc-truth`, `check-public-web`, `llms:check`, `check-doc-examples`), so PR bodies claim green rather than showing CI.

**How to apply:**
- `pnpm typecheck` cannot run to completion on `development` — `release-ruleset:check` fails with `Job "bare-bundle" not found under jobs:` (#479 renamed CI jobs without repointing the pinned contract). It runs in no CI lane. Run the chain check-by-check instead, and confirm the failure is pre-existing before attributing it to a PR.
- Self-reported verification tables in these PR bodies have matched reality so far. The risk is not fabricated results — it is checks that pass *upstream of the defect* (e.g. a redirect manifest validated but never written to disk). Ask what the green checks do **not** cover.
- Node must be 24.13.1 (`engine-strict=true`); export `LANG`/`LC_ALL=en_US.UTF-8` before pnpm commands.
