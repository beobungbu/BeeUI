# Version-bump literal inventory and CI-scope report — `0.86.2-rc.1` → next

Scout output (read-only agent, 2026-09-23). Repo worktree branch `docs/release-flow-improvement-plan` == `origin/development` @ `8c63c9d`. Paths relative to repo root.

## 1. Literal inventory

`grep -rn "0\.86\.2-rc\.1"` (excluding node_modules, dist, .artifacts, .git): **236 occurrences in 122 files**.
`grep -rn "0\.86\.2\b"`: 171 files; the 49 extra files are almost all false positives (`react-native: "0.86.2"` peer/dev pins that coincidentally share BeeUI's number, e.g. `packages/ui/package.json:975`, `apps/demo/package.json:32,44`, `apps/showcase/package.json:32,43`, all `examples/*/package.json`, `pnpm-lock.yaml`) plus durable stable-line policy prose. Any bump must key on the exact `0.86.2-rc.N` string, never bare `0.86.2`.

| Class | Files | Occurrences |
|---|---|---|
| (a) manifests / app.json | 8 | 8 |
| (b) generated outputs | 69 | ~130 |
| (c) hand-maintained CURRENT-state prose | 29 | ~75 |
| (d) hand-maintained HISTORY/evidence | 7 | ~19 |
| (e) test fixtures in `scripts/__tests__` | 11 | ~40 |
| (f) generator/checker source | 4 | 4 |
| (g) examples/ + packages/*/README.md | 10 (subset of c) | 10 |

### (a) Manifests
`package.json:4`, `packages/cli/package.json:3`, `packages/core/package.json:3`, `packages/tokens/package.json:3`, `packages/ui/package.json:3`, `apps/demo/app.json:5`, `apps/showcase/app.json:5`, `web/worker/package.json:4`.

### (b) Generated
| Generator | Files | Count |
|---|---|---|
| `scripts/public-component-reference.mjs` (`distributionStatusNote()` ~1362-1387) | `apps/docs/src/content/docs/components/*.md` | 63 |
| `scripts/generate-component-reference.mjs` (reuses `buildStatusNote`) | `docs/component-reference.md` | 1 |
| `scripts/generate-llms-txt.mjs` (`buildStatusNote()` ~235-239, packages note ~327, hardcoded historical sentence at 388) | `llms*.txt` | 4 |
| `scripts/public-reference.mjs` (reads `docs/reference.content.json`) | `apps/docs/src/content/docs/reference/cli.md` | 1 |

All read `docs/dist-tag-policy.md`'s JSON block. Also generated but **gitignored** (`.gitignore:23-26`) and therefore invisible to a repo grep: `apps/docs/public/release-state.json`, `apps/docs/public/route-manifest.json`, `apps/docs/src/content/docs/compatibility/current.md`, `apps/docs/src/content/docs/guides/current-release.md` (apps/docs `predev`/`prebuild`/`pretypecheck`).

### (c) Hand-maintained current-state prose — 29 files
`README.md:7,16,41,101` · `docs/ai-agent-cookbook.md:6,9,42,47,52,54,224,226,235,259,262,337` · `docs/registry-cli.md:5,21,104,115` · `docs/consumer-compatibility-report.md:5,7,37,67,76` · `docs/release.md:3,7,17,40,41,170,175` · `docs/dist-tag-policy.md` (JSON block + prose) · `docs/reference.content.json:36` · `apps/docs/src/content/docs/ai/index.md:27` · `apps/docs/src/content/docs/index.md:9,15,59,63` · `theming/index.md:36,103` · `release-security/index.md:6,8,15` · `reference/index.md:42` (hand-maintained inside a generator-owned directory; drifted in the rc.2 bump) · `guides/migration-versioning.md:6,19,20,30,101` · `guides/troubleshooting.md:28,189,222,225,491,496,499` · `guides/cli-source-ownership.md:8,26,91` · `start/index.md:6,9,26,45,54,145` · `start/web.md:6,21,25,31` · `start/expo.md:6,25,30` · `start/bare-react-native.md:6,18,23` · `examples/README.md:29` · `examples/agent-reference-app/README.md:16` · `examples/bare-rn-consumer/README.md:13` · `examples/demo-reproduction-records/README.md:18` · `examples/expo-package-consumer/README.md:10` · `examples/web-consumer/README.md:11` · `packages/{cli,core,tokens,ui}/README.md:7`.

All 29 restate the same narrative that `docs/dist-tag-policy.md` is supposed to own; each is a separate hand edit per bump.

### (d) History/evidence — 7 files
`CHANGELOG.md`, `docs/rc-candidate.md` (SHAs/digests at 16-33, 89-100; **its line-3 status banner "no public npm package has been published yet" is false today**), five closed `plans/` artifacts.

### (e) Tests — 11 files
Only `check-distribution-policy.test.mjs` (real-file self-consistency test ~174) and `release-control-plane.test.mjs` (real-workflow tests at 86 and 217) read repo files, and both derive expectations dynamically. **No test needs a manual literal edit on a bump.** All other hits are synthetic fixtures (`generate-llms-txt.test.mjs:166`, `public-doc-truth.test.mjs`, `public-site-contract.test.mjs`, `beeui.test.mjs` consumer RN pins, `benchmark-runner.test.mjs`, `check-compatibility-matrix.test.mjs`, `check-public-surface-diff.test.mjs`, `public-portal-shell.test.mjs`, `public-worker.test.mjs`).

### (f) Generator/checker source
- `scripts/public-component-reference.mjs:1362` comment (historical, harmless).
- `scripts/generate-llms-txt.mjs:388` hand-written "verified against `@0.86.2-rc.1`" sentence baked into output (kept by policy as evidence).
- `examples/scripts/pack-beeui-packages.mjs:6` comment, hand-edited on every bump.
- `scripts/check-distribution-policy.mjs:76` probes the regex with a synthetic `-rc.2`; all bump sensitivity lives in the JSON block, not the checker.

## 2. Phrases that encode registry state
| Phrase | Where (excl. generated components/patterns) | Claim type |
|---|---|---|
| "publicly published" | README, registry-cli, consumer-compatibility-report, theming, troubleshooting, reference/index, release-security, ADR-011 (generic), agent-execution-contract (generic), `check-public-doc-truth.mjs` | registry, hand-written |
| "is public on npm" | component-reference (gen), ai-agent-cookbook, start/index, ai/index, llms*.txt (gen), generator templates, `check-ai-agent-contract.mjs` | registry, mixed |
| "currently resolves" | README, component-reference (gen), cookbook, index, start/index, migration-versioning, cli-source-ownership, release-security, troubleshooting, llms*.txt (gen), generators | registry |
| "same RC" | 22 files: every (c) file + 4 llms + both generators | registry; the rc.2 follow-up pass rewrote all of these |
| "by coincidence" | start/index.md | registry |
| "first public release candidate" | release.md, index.md, dist-tag-policy.md | candidate history, keep forever |

No automated check validates these narrative sentences; `docs:public-truth:check` validates only registry-command pins and three version sentences.

## 3. Generated-surface freshness vs PR CI
| Surface | Generator | Checker | On PR CI? |
|---|---|---|---|
| components/*.md, patterns/*.md | docs:portal-pages:generate | docs:portal-pages:check | **No** (only `pnpm typecheck` in environment-ci) |
| reference/*.md | docs:reference:generate | docs:reference:check | **No**; `reference/index.md` checked by nothing |
| current-release.md, compatibility/current.md, release-state.json, route-manifest.json (gitignored) | apps/docs pre* → generate-docs-foundation / public-guide-data | docs:foundation:check | Yes (verify-docs, gated) |
| docs/public-surface-owners.json | docs:surface:acknowledge | docs:surface:check / :diff | **No** (release-control-plane:check in verify-fast covers only part) |
| social card | generate-og-image | docs:social-card:check | **No** |
| registry/ | beeui.mjs | registry:verify/test | Yes (verify-runtime, gated) |
| ui exports map | ui-exports:generate | ui-exports:check | Yes (verify-runtime, gated) |
| tokens | tokens:generate | tokens:check | Yes (verify-tokens, gated) |
| docs/component-reference.md | docs:contract:generate | docs:contract:check | Yes (verify-docs) |
| llms*.txt | llms:generate | llms:check | Yes (verify-docs) |
| docs:a11y / search / budget / vitals | — | check-* | **No** |
| portal-shell:test | — | test | **No** |

## 4. CI scope for bump files
| File(s) | Rule | Lanes |
|---|---|---|
| root `package.json` | BUILD_CONFIG_EXACT | package only (not release) |
| `packages/{core,ui,tokens}/package.json` | PACKAGE_MANIFEST_RE + package-boundary sensitive | release, visual, docs, tokens, package, showcase, consumer, expoConsumer |
| `packages/cli/package.json` | BUILD_ONLY_PREFIXES | package only |
| `apps/demo/app.json` | VISUAL + WEB prefixes | visual, web |
| `apps/showcase/app.json` | EXPO_EXACT + showcase prefix | expoConsumer, visual, showcase |
| `web/worker/package.json` | WEB_PREFIXES | web |
| `docs/*.md` | DOC_PREFIXES | docs, web |
| `apps/docs/src/content/docs/**` | DOC + VISUAL_A11Y prefixes | docs, web, visual |
| `llms*.txt` | DOC_ARTIFACT_RE | docs |
| `README.md`, `CHANGELOG.md` | DOC_EXACT (+ RELEASE_EXACT for CHANGELOG) | docs (+ release) |
| `.github/workflows/npm-release.yml` | CI_CONTROL_PLANE_PREFIXES | **forces full-ci** |

Gates absent from every PR lane (only in `pnpm typecheck`/`pnpm test` via environment-ci on push): `docs:surface:{check,test,diff,diff:test}`, `docs:reference:{check,test}`, `docs:portal-pages:{check,test}`, `docs:{a11y,search,budget,vitals}:*`, `docs:social-card:*`, `portal-shell:test`. Unconditional on every PR (verify-fast): `dist-policy:check`, `release-control-plane:check`, `release-ruleset:check`, `compat:check`.

## 5. Bump cost (rc.1 → rc.2 reference, `origin/release/0.86.2-rc.2`)
116 files, +656/−191. Manifests 8; regenerated 68 (63 component pages, component-reference, 4 llms); generator templates 2 (`generate-llms-txt.mjs` +5/−4, `public-component-reference.mjs` +3/−3); hand-edited prose ~34 files, roughly **35–40 individually judged sentence edits across two passes** (mechanical bump, then a "latest-tag anchoring" pass that re-touched ~15 files because the first pass missed the current-vs-historical distinction; one reversal at `start/index.md:145`; `reference/index.md` initially left inconsistent); `docs/public-surface-owners.json` regenerated by `docs:surface:acknowledge` after `release-control-plane:check` failed on the manifest blob change.

Scripts run in order: manual manifest edits → `version:sync` → prose sweep → `public-guide-data.mjs` → portal-pages/contract/llms/foundation/reference generate → gates: `release-control-plane:check` (fail) → `docs:surface:acknowledge` → retry → `dist-policy:check` → `docs:public-truth:check` → `docs:portal-pages:check` → `docs:reference:check` → `docs:contract:check` → `docs:foundation:check` → `llms:check` → `web:check` → `docs:surface:check` → `release:verify` (needs GNU tar on macOS) → second pass re-running the docs gates → full `pnpm typecheck` (~26 min) + `pnpm test`.

Status: DONE
Summary: 236 hits in 122 files classified; 29 hand-maintained current-state files with no drift check; eight gate families never run on PR CI; a bump costs ~35–40 judged sentence edits plus two regeneration/gate passes.
Concerns/Blockers: `docs/rc-candidate.md:3` status banner is false today (says nothing published).
