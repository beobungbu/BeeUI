---
name: project-474-docs-portal-wave
description: WBS #474 docs-portal wave review context — self-reported PR verification tables run on warm trees and miss cold-checkout CI failures; always check `gh pr checks` first
metadata:
  type: project
---

The #474 docs-portal work breakdown (sub-issues #455 B010/B011, #457 D030, #458 D031, #459 E040, #463 D033, #472, #473) lands as a series of `feat/*` PRs onto `development`. Each PR body carries an `AUTHORITATIVE_BASE_SHA` and a self-reported verification table.

**Why:** the wave is content-heavy and gated by machine checks (`docs:foundation:check`, `site:contract:check`, `docs:surface:check`, `check-public-doc-truth`, `check-public-web`, `llms:check`, `check-doc-examples`), so PR bodies claim green rather than showing CI.

**How to apply:**
- **Run `gh pr checks <n>` before anything else.** On PR #485 the body's table said `pnpm typecheck` PASS while `verify-docs` and `build-and-local-smoke` were red on CI. The tables are honest about what was run; they are produced on a **warm** developer tree and the author does not re-check CI.
- The recurring defect shape in this wave is **warm-tree vs cold-checkout divergence**. Four docs content families are gitignored and written only by `apps/docs`'s `prebuild` hook: `components/reference/`, `patterns/reference/`, `compatibility/current.md`, `guides/current-release.md`. CI's `verify-docs` job checks out, installs, and runs `pnpm web:check` with none of them present. Any check that walks the docs content tree must not assume they exist.
- To reproduce a cold checkout cheaply: copy `apps/docs/src` + `web/public-site.config.json` into `/private/tmp`, delete those four paths, and call the check's exported `collectViolations(shadowRoot)` directly. No full repo copy needed (a full copy is ~910 MB).
- `pnpm typecheck` now runs the full 21-step chain to exit 0, including `release-ruleset:check`. The old `bare-bundle` job-name failure is resolved — the note in an earlier version of this memory is stale.
- Node must be 24.13.1 (`engine-strict=true`); export `LANG`/`LC_ALL=en_US.UTF-8`. The shell is **zsh**, which does not word-split unquoted variables — `node ./scripts/$s` with `$s="x.mjs --check"` fails.
- Live environments exist and are reviewable: `https://beeui-dev.beemvp.com` serves the current `development` state (production `beeui.beemvp.com` does not resolve). `curl -o /dev/null -w '%{http_code}'` against dev is the cheapest way to settle a routing claim.
- Astro drops dots from content filenames (`current.generated.md` → `/currentgenerated/`), but `contentPathToRoute` in `scripts/generate-docs-foundation.mjs` does no slugification, so the route manifest lies about any dotted filename. Anything built on that manifest inherits the blind spot.
- `node_modules` paths are blocked by the scout hook, so shadow builds that need a real `astro build` are not possible. Verify Astro behavior against the live dev origin or the committed `apps/docs/dist/` instead.

Related: [[beeui-1.0-rc-ready-owner-gates]]
