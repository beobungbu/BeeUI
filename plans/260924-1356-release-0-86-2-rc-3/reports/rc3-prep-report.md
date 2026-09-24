# rc.3 preparation report — `0.86.2-rc.3`

Branch `release/0.86.2-rc.3`, created from `origin/development` at `f30fd8e2` ("Merge PR #633: rc.2 consumer verification fixes").
Toolchain: Node `v24.13.1`, pnpm `10.15.0`, GNU tar on `PATH`, `LC_ALL=en_US.UTF-8`; `pnpm install --frozen-lockfile` clean.

- Candidate commit: `1110844adec4fbbf6ae73d2f8ed1ed12986a5047` — `release: prepare 0.86.2-rc.3 candidate` (111 files).
- Evidence commit: `docs(release): freeze 0.86.2-rc.3 evidence`. It adds the rc.3 section to `docs/rc-candidate.md` and this report, and does not change package contents.

Nothing was pushed, published, dispatched or dist-tagged, and no issue was touched. No file under `packages/*/src` changed. The only workflow change is the `expected_version` default.

## Files changed, by category

| Category | Files |
| --- | --- |
| Version bump | `packages/{core,tokens,ui,cli}/package.json`; via `pnpm version:sync`: `package.json`, `web/worker/package.json`, `apps/demo/app.json`, `apps/showcase/app.json` |
| Pins | `docs/dist-tag-policy.md` (`currentVersion`, `prereleaseExample` → rc.3); `.github/workflows/npm-release.yml` (`expected_version` default only); `docs/consumer-compatibility-report.md` (`candidateVersion`, header line) |
| Policy (`latest` rule) | `docs/dist-tag-policy.md`, `docs/npm-release-bootstrap.md`, `docs/release.md`, `docs/release-ruleset.md`, `docs/rollback-runbook.md` (rule 4), `docs/semver-audit.md` (marked superseded for the 0.86.2 line), `docs/rc-candidate.md` (status + channels) |
| Hand-written current-state docs | `README.md`, `docs/ai-agent-cookbook.md`, `docs/registry-cli.md`, `docs/reference.content.json`, `packages/*/README.md` (these ship in the tarballs), `apps/docs/src/content/docs/{index,ai/index,start/index,start/expo,start/bare-react-native,start/web,guides/cli-source-ownership,guides/migration-versioning,guides/troubleshooting,reference/index,release-security/index}.md` |
| Generators | `scripts/generate-llms-txt.mjs` (new `publicationObservation()`, status note, package line, ADR line, packages note); `scripts/public-component-reference.mjs` (`distributionStatusNote()` reuses it) |
| Check + test | `scripts/check-public-doc-truth.mjs`, `scripts/__tests__/public-doc-truth.test.mjs` (see below) |
| Regenerated | 63 `apps/docs/src/content/docs/components/*.md`, `apps/docs/src/content/docs/reference/cli.md`, `docs/component-reference.md`, `llms.txt`, `llms-full.txt`, `llms-components.txt`, `llms-patterns.txt`; gitignored: `route-manifest.json`, `release-state.json`, guide data |
| Acknowledge | `docs/public-surface-owners.json` via `pnpm docs:surface:acknowledge` (core/tokens/ui manifest blobs) |
| CHANGELOG | `## Unreleased` became `## [0.86.2-rc.3] — 2026-09-24` with an intro and a Distribution paragraph; the Fixed/Changed/Added content is unchanged. A fresh `## Unreleased` ("No unreleased consumer-facing changes are recorded after `0.86.2-rc.3` yet.") sits above it. |

Regenerate commands: `pnpm docs:portal-pages:generate`, `docs:contract:generate`, `llms:generate`, `docs:foundation:generate`, `docs:reference:generate`, `node ./scripts/public-guide-data.mjs`, then `pnpm docs:surface:acknowledge`.

## Candidate vs. published: how the "never say rc.3 is published" rule was applied

Before this change the generators wrote `BeeUI \`${currentVersion}\` is public on npm`. After the bump, that would have claimed rc.3 is public. They now read two separate values from the policy block:

- `currentVersion` is the candidate;
- `observedDistTags` is the last registry observation.

The generated status now says:

> BeeUI `0.86.2-rc.2` is public on npm under the opt-in `next` dist-tag. The live registry was last observed resolving `next` to `0.86.2-rc.2` and `latest` to `0.86.2-rc.1`; … This repository is at release candidate `0.86.2-rc.3`, which is not published until the owner approves its staged packages.

After the owner publishes rc.3 and updates `observedDistTags`, the same generators will produce the post-publication wording with no code change. If `observedDistTags` is absent, the old behaviour is kept: the published version is taken to be `currentVersion`.

Hand-written docs follow the same pattern: rc.3 is named as the current (unpublished) candidate, and the 2026-09-23 observation is given as `next` → rc.2, `latest` → rc.1. Nothing says rc.3 is published or that any dist-tag resolves to it. The observed JSON `{latest: 0.86.2-rc.1, next: 0.86.2-rc.2}` and the persistent dist-tag table targets are unchanged.

**Pins.** Guidance of the form "Pin `@0.86.2-rc.3` instead of `@next`" was moved to rc.3. This follows the rc.2 precedent and the public-truth checker's model, which accepts pins only at `@next` or `@currentVersion`. These pins only work once rc.3 is published, and each page that carries one also says rc.3 is not published yet.

## Check changed to allow a correct README

`scripts/check-public-doc-truth.mjs` required the README to contain the literal `BeeUI \`<workspace version>\` is publicly published`. At candidate time that forces a false claim that rc.3 is published.

The regex now also accepts `BeeUI \`<version>\` is the current release candidate`. The assertion that this version must equal the workspace version is unchanged.

Two tests were added: the candidate form passes, and a candidate form with the wrong version is still rejected. No other assertion changed.

No check or test encoded the old "never move `latest` before stable" rule. `grep` over `scripts/` found it only in generator prose (`generate-llms-txt.mjs`, `public-component-reference.mjs`), which was rewritten. The `npm-release.yml` step "Do not move `latest` until this job is green" is stable-only and still correct, so it was left alone.

## `0.86.2-rc.2` literals kept on purpose

| Where | Why kept |
| --- | --- |
| `docs/dist-tag-policy.md` observation block, rc.2 provenance section, table target, `observedDistTags.next` | Registry observation and rc.2 provenance |
| `docs/rc-candidate.md` rc.2 section (lineage, tarballs, stage IDs, registry evidence) | Historical record of the published rc.2 |
| `docs/release.md` observed tags and the rc.2 provenance subsection (renamed from "Current rc.2 publication" to "rc.2 publication") | Observation / provenance |
| `docs/consumer-compatibility-report.md` lines 7 and 13 | Dated 2026-09-23 post-publication observation |
| `CHANGELOG.md` `[0.86.2-rc.2]` entry | Release history |
| `guides/migration-versioning.md` "Upgrading from 0.86.2-rc.1 to 0.86.2-rc.2" section, and "rc.2 is the second" release | Upgrade notes / history |
| "rc.2 is publicly published" sentences in `guides/troubleshooting.md:28`, `theming/index.md:103`, `examples/*/README.md`, `examples/scripts/pack-beeui-packages.mjs` comment, and the lead sentences of the start/reference/release-security pages | True registry observations; rc.3 is not published |
| Status sentences in every generated page / `llms*` (`BeeUI \`0.86.2-rc.2\` is public on npm`) | Taken from `observedDistTags.next` |
| `scripts/__tests__/*` fixtures | Arbitrary test-fixture versions |

## Policy text, before and after

**Before** (`docs/dist-tag-policy.md`):

- Table, `latest` row: "default-install channel; do not deliberately move it again until approved stable promotion".
- "Do not recommend an unqualified install for RC consumers. Today that resolves through `latest`, which remains on `0.86.2-rc.1`, while `next` resolves to `0.86.2-rc.2`."
- Subsequent RC publication ended at step 7, "verify clean public consumption."

**After**:

- Table, `latest` row: "default-install channel; during the `0.86.2` prerelease line it follows the newest complete, verified RC once the owner moves it; at stable promotion it moves to `0.86.2`".
- New section **"`latest` during the `0.86.2` prerelease line"** (owner decision 2026-09-24, issue #561):
  - The owner moves `latest` only after the whole four-package set is published and verified.
  - The move is one 2FA operation of `npm dist-tag add @beemvp/beeui-<pkg>@<version> latest` ×4.
  - The owner then observes the four tags and records them in the policy and in `rc-candidate.md`.
  - `latest` never points at a partial set: a partial move is completed or reverted in the same session.
  - The workflow never mutates dist-tags.
  - Stable `0.86.2` still moves `latest` at stable promotion.
  - Consumer docs keep `@next` or an exact version, because `latest` lags `next`.
- The unqualified-install sentence now describes that lag, and gives the 2026-09-23 observation as the last recorded state.
- The candidate is stated separately from the observation ("`0.86.2-rc.3` … is not published and no dist-tag resolves to it until …").
- Subsequent RC publication gains:
  - step 8: after publication and verification, the owner moves `latest` ×4 with npm 2FA;
  - step 9: observe and record;
  - a note that the `latest` move is not inferred from intent.

**`docs/npm-release-bootstrap.md`:**

- The Subsequent RCs sequence gains step 6 (owner `latest` move ×4 after all four packages are public and verified) and step 7 (observe and record `latest`/`next`), plus "The workflow never performs step 6."
- The "manual promotion" rationale now covers RC-line moves.
- Partial recovery now reads "keep `latest` untouched until the full four-package set (RC or stable) is public and verified".

No dist-tag automation was added.

## Command results

| Command | Result |
| --- | --- |
| `pnpm version:sync` | Synced package.json, web/worker, demo, showcase to 0.86.2-rc.3 |
| `pnpm docs:surface:acknowledge` | re-acknowledged 3 sources (ui, tokens, core package.json) |
| `release-control-plane:check` | pass (lockstep 0.86.2-rc.3) |
| `dist-policy:check` | pass |
| `docs:public-truth:check` | pass |
| `docs:surface:check` | pass (694 rows) |
| `docs:portal-pages:check` | pass |
| `docs:reference:check` | pass (5 pages, 219 surfaces) |
| `docs:contract:check` | pass |
| `docs:foundation:check` | pass |
| `llms:check` | pass |
| `web:check`, `site:contract:check` | pass |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm test` | exit 0; 1012 node:test cases, 0 failures; Jest 146 suites / 1259 tests passed |
| `pnpm release:verify` on `1110844a` | exit 0, "Release verification passed", 0 failed probes |
| After the evidence section: release-control-plane, dist-policy, public-truth, surface, foundation, llms, web, site-contract, portal-pages checks + release-control-plane/dist-policy/public-truth tests | all exit 0 |

## Tarballs (`pnpm release:verify` on candidate `1110844adec4fbbf6ae73d2f8ed1ed12986a5047`)

| Package | Tarball | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `@beemvp/beeui-core` | `beemvp-beeui-core-0.86.2-rc.3.tgz` | 37,917 | `c1d72cd99af538e0154eb7b3495aa97af90d332bcb47a42035fe91b2eb130d72` |
| `@beemvp/beeui-tokens` | `beemvp-beeui-tokens-0.86.2-rc.3.tgz` | 137,590 | `48c02df1864be41807e8b7e7bcf20fbe4a6b32f8edb3773d00652ef506119225` |
| `@beemvp/beeui-ui` | `beemvp-beeui-ui-0.86.2-rc.3.tgz` | 1,018,481 | `8275dcb91b988b9fc3cdc1ed07a20556e621e9b6a7a31b335af0f0f92ffcad05` |
| `@beemvp/beeui-cli` | `beemvp-beeui-cli-0.86.2-rc.3.tgz` | 280,039 | `66ff2d83c925564ef2db7e20ecf277d033b53a240bf13a4d5bb49daac3baf209` |

All four are canonical and reproducible.

## Open points for the controller / owner

1. The CI evidence in `docs/rc-candidate.md` is a placeholder. Fill it in after the PR run, together with the PR number and the integration and promotion SHAs.
2. The widened README regex in `check-public-doc-truth.mjs` is a gate change. It still enforces the version, but please confirm the phrasing is acceptable.
3. rc.3 pins in the docs only become installable once rc.3 is published.
4. After publication and the `latest` move, a post-publication docs commit must update:
   - `observedDistTags` and the persistent dist-tag table;
   - the observation sentences in `README.md`, `docs/release.md`, `docs/consumer-compatibility-report.md`, the apps/docs start/reference/release-security/index/migration/troubleshooting pages, `docs/ai-agent-cookbook.md` and `docs/registry-cli.md`;
   - then regenerate the generated surfaces, which follow `observedDistTags` automatically.
5. Optional, not done: the migration guide has no "Upgrading from rc.2 to rc.3" section. The CHANGELOG `Changed` items (FormGroup `requiredAccessibilityLabel`, native toast docking) may need consumer action.
