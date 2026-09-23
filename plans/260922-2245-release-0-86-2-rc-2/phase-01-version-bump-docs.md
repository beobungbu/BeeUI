# Phase 01 — prepare the `0.86.2-rc.2` candidate: version bump + docs

Worktree (run everything from here, absolute paths only):
`/Users/textsoft/workspace/BeeUI/.claude/worktrees/beeui-portal-pages-ci-e8e1fc`
Branch: `release/0.86.2-rc.2` (already checked out, == origin/development 8c63c9d). **Do not commit, do not push, do not run git write commands.**

Node must be `v24.13.1` (run `node --version` first; if it differs, report BLOCKED). Use `npm run <script>` for every workspace script (root `package.json`). Never invoke `pnpm` directly.

## Goal

Move the workspace from `0.86.2-rc.1` to `0.86.2-rc.2` exactly the way `docs/npm-release-bootstrap.md` lines 19-31 ("When intentionally moving the source tree to an RC version") prescribe, regenerate every generated surface, and make every listed gate green. Only *current-state* statements change to rc.2; *historical/observed* statements about rc.1 stay untouched.

## Files you must NOT edit

- `CHANGELOG.md`, `.changeset/**`, `docs/rc-candidate.md` (the controller owns these)
- anything under `apps/docs/src/content/docs/components/`, `apps/docs/src/content/docs/patterns/`, `apps/docs/src/content/docs/reference/`, `llms*.txt`, `docs/component-reference.md`, `apps/docs/public/release-state.json`, `apps/docs/src/content/docs/guides/current-release.md`, `apps/docs/src/content/docs/compatibility/current.md` **by hand** — these are generated; only the generators in step D may change them
- `plans/**`, `.github/workflows/**` except the single line in step B
- any `*.ts`/`*.tsx`/`*.mjs` source

## Steps

### A. Manifests
1. Set `"version": "0.86.2-rc.2"` in `packages/core/package.json`, `packages/tokens/package.json`, `packages/ui/package.json`, `packages/cli/package.json`.
2. `npm run version:sync` (propagates to root `package.json`, `web/worker/package.json`, `apps/demo/app.json`, `apps/showcase/app.json`). Verify with `grep -n '"version"' package.json web/worker/package.json`.

### B. Pins (machine-checked authorities)
1. `docs/dist-tag-policy.md`, the ```json dist-tag-policy``` block: `currentVersion` → `0.86.2-rc.2`, `prereleaseExample` → `0.86.2-rc.2`. Leave `published: true`, `candidateStableVersion: "0.86.2"`, the regex, and every other key unchanged.
2. `.github/workflows/npm-release.yml`: only the `expected_version` input `default:` value → `0.86.2-rc.2`. Nothing else in that file.
3. `docs/consumer-compatibility-report.md`: the `candidateVersion` field in its JSON block and the prose sentence matching `candidate version \`X\` today` → `0.86.2-rc.2`.

### C. Hand-maintained prose — current vs. historical
Run `grep -rn "0.86.2-rc.1" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist .` and classify **every** hit outside the generated files listed above and outside `CHANGELOG.md` / `docs/rc-candidate.md` / `.changeset/`:

**Change to `0.86.2-rc.2`** when the sentence states what the workspace/candidate version *is now*, or tells a consumer which version to pin/install today (e.g. "pin `@0.86.2-rc.1`", "the release candidate is `0.86.2-rc.1`", "candidate version", install commands, `examples/scripts/pack-beeui-packages.mjs` if it hardcodes the current version, package READMEs describing the current package version).

**Keep unchanged** when the sentence records something that happened or was observed: the rc.1 bootstrap publish on 2026-09-09 (run 34294238899), tarball SHA-256 values, "the first public release candidate `0.86.2-rc.1` is/was published", the live-registry observation that `next` and `latest` both resolve to `0.86.2-rc.1` (that is still the observed state until rc.2 is approved on npm), ADRs under `docs/decisions/`, evidence blocks in `docs/release.md`, anything dated.

Specific rules:
- `README.md` line 7 must keep the exact phrase `BeeUI \`0.86.2-rc.2\` is publicly published` (regex in `scripts/check-public-doc-truth.mjs` line 117). Change the date to `2026-09-22`, change the pin suggestion to `@0.86.2-rc.2`, and reword the `latest` sentence so it says the `latest`/`next` observation was recorded for `0.86.2-rc.1` and must be re-verified after the rc.2 staged publish is approved. `README.md` line 101: pin → rc.2.
- `docs/reference.content.json` line ~36 (pin sentence): → rc.2 (this feeds `docs:reference:generate`).
- `docs/dist-tag-policy.md` prose outside the JSON block: sentences saying "the first public release candidate `0.86.2-rc.1` is published on npm" are history — keep. Add one sentence right after the intro paragraph: "`0.86.2-rc.2` is the current candidate prepared from `development`; it is published under `next` only once the owner approves the staged publish." Keep the `latest` observation section as is.
- Do not touch `docs/dist-tag-policy.md` lines describing the bootstrap run, and do not touch `docs/decisions/**`.

Write down every hit you left unchanged with a one-line reason; that list goes in the report.

### D. Regenerate (in this order)
```
npm run docs:portal-pages:generate
npm run docs:reference:generate
npm run docs:contract:generate
npm run docs:foundation:generate
npm run llms:generate
```
Then the apps/docs guide data: open `apps/docs/package.json`, find the `pretypecheck`/`prebuild` script that regenerates `guides/current-release.md` + `compatibility/current.md` (it calls `scripts/public-guide-data.mjs` or similar) and run exactly that generator command from the repo root with `node`. Report the command you ran.

### E. Gates — all must pass (fix and re-run until green; do not weaken any check)
```
npm run release-control-plane:check
npm run dist-policy:check
npm run docs:public-truth:check
npm run docs:portal-pages:check
npm run docs:reference:check
npm run docs:contract:check
npm run docs:foundation:check
npm run llms:check
npm run web:check
npm run docs:surface:check
npm run release:verify
```
If `docs:surface:check` explicitly instructs you to run `docs:surface:acknowledge`, run `npm run docs:surface:acknowledge`, re-run the check, and say so in the report. `release:verify` prints packed-tarball identities (name, bytes, SHA-256) for the four packages; copy that table verbatim into the report. **Do not run `npm run typecheck` or `npm run test`** (the controller runs those).

### F. Report
Write `/Users/textsoft/workspace/BeeUI/.claude/worktrees/beeui-portal-pages-ci-e8e1fc/plans/260922-2245-release-0-86-2-rc-2/reports/worker-rc2-version-bump-docs-report.md` containing:
1. `node --version`, `git status --short`, `git diff --stat`
2. The full list of `0.86.2-rc.1` hits left unchanged, each with its reason
3. The exact generator command used for guide data
4. Last 3 lines of output of every gate in E
5. The `release:verify` tarball table (name / bytes / SHA-256) verbatim
6. Anything you were unsure about

End the report with:
```
Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
Summary: <one or two sentences>
Concerns/Blockers: <optional>
```

## Acceptance criteria
- Every gate in E exits 0.
- `git diff --name-only` contains no forbidden file from the list above.
- `grep -rn "0.86.2-rc.1"` leaves only historical/observed statements, each justified in the report.
- No source (`*.ts`, `*.tsx`, `*.mjs`) changed.
