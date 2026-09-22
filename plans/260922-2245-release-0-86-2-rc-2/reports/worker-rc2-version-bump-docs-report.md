# Worker report — rc.2 version bump + docs regeneration

Worktree: `/Users/textsoft/workspace/BeeUI/.claude/worktrees/beeui-portal-pages-ci-e8e1fc`
Branch: `release/0.86.2-rc.2`. No commits or pushes were made.

## 1. Environment / diff summary

```
$ node --version
v24.13.1
```

`git status --short` (111 entries) and `git diff --stat` (110 files changed, 205 insertions(+), 158 deletions(-)) are attached in full at the end of this section.

**Note:** `CHANGELOG.md` (modified) and `.changeset/consumer-audit-batch.md` (deleted) appear in `git status` but were **not touched by me** — I never ran any command that reads or writes either path. This state was already present in the worktree before/alongside my work (the spec explicitly says the controller owns these files). Flagging this so it isn't mistaken for scope creep on my part.

`git status --short`:
```
 D .changeset/consumer-audit-batch.md
 M .github/workflows/npm-release.yml
 M CHANGELOG.md
 M README.md
 M apps/demo/app.json
 M apps/docs/src/content/docs/ai/index.md
 M apps/docs/src/content/docs/components/*.md   (63 generated component pages)
 M apps/docs/src/content/docs/guides/cli-source-ownership.md
 M apps/docs/src/content/docs/guides/migration-versioning.md
 M apps/docs/src/content/docs/guides/troubleshooting.md
 M apps/docs/src/content/docs/index.md
 M apps/docs/src/content/docs/reference/cli.md
 M apps/docs/src/content/docs/release-security/index.md
 M apps/docs/src/content/docs/start/bare-react-native.md
 M apps/docs/src/content/docs/start/expo.md
 M apps/docs/src/content/docs/start/index.md
 M apps/docs/src/content/docs/start/web.md
 M apps/docs/src/content/docs/theming/index.md
 M apps/showcase/app.json
 M docs/ai-agent-cookbook.md
 M docs/component-reference.md
 M docs/consumer-compatibility-report.md
 M docs/dist-tag-policy.md
 M docs/public-surface-owners.json
 M docs/reference.content.json
 M docs/registry-cli.md
 M docs/release.md
 M examples/README.md
 M examples/agent-reference-app/README.md
 M examples/bare-rn-consumer/README.md
 M examples/demo-reproduction-records/README.md
 M examples/expo-package-consumer/README.md
 M examples/scripts/pack-beeui-packages.mjs
 M examples/web-consumer/README.md
 M llms-components.txt
 M llms-full.txt
 M llms-patterns.txt
 M llms.txt
 M package.json
 M packages/cli/README.md
 M packages/cli/package.json
 M packages/core/README.md
 M packages/core/package.json
 M packages/tokens/README.md
 M packages/tokens/package.json
 M packages/ui/README.md
 M packages/ui/package.json
 M web/worker/package.json
?? plans/260922-2245-release-0-86-2-rc-2/   (this plan directory — untracked, not edited by me)
```

No `CHANGELOG.md`, `.changeset/**`, `docs/rc-candidate.md`, `plans/**` content, or `*.ts`/`*.tsx` was edited by me. The one `*.mjs` file touched, `examples/scripts/pack-beeui-packages.mjs`, was a single-line **comment** update (`BeeUI \`0.86.2-rc.1\` is publicly published...` → `0.86.2-rc.2`), explicitly called out by the spec's step C examples as a current-state string to update — no code logic changed. `docs/public-surface-owners.json` was updated only via `npm run docs:surface:acknowledge` (see §4/§6), not hand-edited.

## 2. `0.86.2-rc.1` hits left unchanged, with reasons

Full re-grep after all edits and regeneration:
```
grep -rln "0.86.2-rc.1" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist .
```
returned only the files below (plus the explicitly-forbidden `CHANGELOG.md` / `docs/rc-candidate.md` / `plans/**`, untouched by design).

| File:line | Kept text (excerpt) | Reason |
|---|---|---|
| `README.md:7` | "...The live registry was last observed resolving both `next` and `latest` to `0.86.2-rc.1`..." | Explicit spec instruction: reworded to mark this as the rc.1-era observation that must be re-verified after rc.2's staged publish; the "is publicly published" claim itself now reads rc.2. |
| `docs/consumer-compatibility-report.md:7` | "BeeUI `0.86.2-rc.1` is publicly published under the npm `next` dist-tag..." | Dated evidence snapshot (`**Snapshot:** 2026-09-09`) recording compatibility evidence gathered against the actually-published rc.1 build. The `candidateVersion` JSON field and the "candidate version `X` today" prose sentence (explicitly mandated by step B.3) were updated to rc.2; this separate sentence is historical evidence, not the candidate-version field. |
| `docs/release.md:7` | "BeeUI's first public release candidate, `0.86.2-rc.1`, is published on npm..." | Matches the spec's explicit keep-example: "the first public release candidate `0.86.2-rc.1` is/was published." Line 17's pin recommendation in the same file *was* changed to rc.2. |
| `docs/dist-tag-policy.md:7,11,13,19,53,54,60` | "first public release candidate...", live-registry "Verified against..." observation, "Current public distribution state...public at `0.86.2-rc.1`", persistent dist-tag table, "bootstrap path...is complete" | Spec explicitly: "Do not touch `docs/dist-tag-policy.md` lines describing the bootstrap run" and "Keep the `latest` observation section as is." Only the JSON block (`currentVersion`, `prereleaseExample`) and one new sentence after the intro paragraph were changed. |
| `docs/ai-agent-cookbook.md:226` | "The `0.86.2-rc.1` bootstrap publish under `next` is already complete;" | Historical statement about a completed event (the bootstrap publish), not a current-state claim. |
| `docs/ai-agent-cookbook.md:337` | "Known gap, verified against `@beemvp/beeui-*@0.86.2-rc.1` with Uniwind `1.10.1`:" | Historical verification record tied to a specific tested build — matches "records something that was observed." |
| `apps/docs/src/content/docs/index.md:9` | "The first public release candidate, `0.86.2-rc.1`, is published on npm..." | Same "first public release candidate" keep-example as `docs/release.md:7`. Line 59 ("Current RC:") in the same file *was* changed to rc.2. |
| `apps/docs/src/content/docs/start/index.md:145` | "Confirm `npm ls ...` resolves `0.86.2-rc.1` when using `@next` today." | Describes what the live registry's `@next` tag actually resolves to today (unaffected by the local source-tree bump; rc.2 has not been published yet) — an observed-registry-state statement, not a candidate-version claim. |
| `apps/docs/src/content/docs/start/web.md:21` | "...produces `ERESOLVE: could not resolve ... from @beemvp/beeui-ui@0.86.2-rc.1`:" | Literal reproduction of a real npm error message a consumer sees today against the actually-published package — historical/observed, not a recommendation. |
| `apps/docs/src/content/docs/theming/index.md:36` | "Verified against `@beemvp/beeui-*@0.86.2-rc.1` with Uniwind `1.10.1`:" | Same historical-verification pattern as `ai-agent-cookbook.md:337` (and the identical text the `llms:generate` generator also emits into `llms-full.txt:53`, left alone since it's sourced from generator logic, not hand-editable). |
| `apps/docs/src/content/docs/guides/migration-versioning.md:6` | "BeeUI now has its first public npm release: `0.86.2-rc.1`..." | Same "first public release" keep-example; permanently true regardless of later RCs. |
| `apps/docs/src/content/docs/guides/migration-versioning.md:19` | "Prerelease (`next`) ... currently `0.86.2-rc.1`." | Table row describing today's actual `next` dist-tag resolution — observed live-registry state, mirrors the kept persistent-dist-tag table in `docs/dist-tag-policy.md`. |
| `apps/docs/src/content/docs/guides/migration-versioning.md:20` | "Stable (`latest`) ... Currently resolves to `0.86.2-rc.1` too as an observed registry state;" | Explicit "observed registry state" wording — matches the spec's keep example verbatim. Line 30's pin recommendation in the same file *was* changed to rc.2. |
| `apps/docs/src/content/docs/reference/index.md:42` | "BeeUI `0.86.2-rc.1` is publicly published on npm under the opt-in `next` dist-tag." | **Flagged, not a clean classification** — see §6. This page lives under `apps/docs/src/content/docs/reference/`, which the spec forbids hand-editing, but `scripts/public-reference.mjs` (the `docs:reference:generate` generator) only (re)writes `cli.md`, `core.md`, `registry.md`, `styling.md`, `tokens.md` — `index.md` is a separate, apparently hand-maintained landing page that no listed generator touches. I could not update it without violating the "reference/** is generator-only" rule, so it was left as-is even though its "is publicly published" clause is a current-state claim. `docs:reference:check` still passes (it only validates the 5 generated pages). |
| `scripts/__tests__/check-distribution-policy.test.mjs`, `generate-llms-txt.test.mjs`, `public-doc-truth.test.mjs`, `public-site-contract.test.mjs`, `release-control-plane.test.mjs` | fixture literals like `currentVersion: '0.86.2-rc.1'` | Forbidden `*.mjs` source; also these are arbitrary/frozen test-fixture version strings unrelated to the real workspace version, not statements about the actual candidate. |
| `scripts/generate-llms-txt.mjs` (template text feeding `llms-full.txt:53`) | "Known gap, verified against `@beemvp/beeui-*@0.86.2-rc.1`..." | Forbidden `*.mjs` source (generator logic, not hand-editable); also a historical verified-against statement. |
| `scripts/public-component-reference.mjs` (comment) | "`0.86.2-rc.1` went public on npm under `next`" | Forbidden `*.mjs` source; comment describing a historical event. |
| `CHANGELOG.md`, `.changeset/consumer-audit-batch.md`, `docs/rc-candidate.md` | — | Explicitly forbidden — controller-owned. |
| `plans/**` (phase-01 spec itself, `ws-d1-report.md`, `phase-J-docs-dist-tag.md`, `ws-j-report.md`, two consumer-audit reports) | — | Explicitly forbidden (`plans/**` must not be edited); these are historical planning/report artifacts. |

## 3. Guide-data generator command (Step D, final item)

`apps/docs/package.json`'s `pretypecheck`/`prebuild` scripts regenerate `guides/current-release.md` and `compatibility/current.md` via `scripts/public-guide-data.mjs`. Ran exactly:

```
node ./scripts/public-guide-data.mjs
```
Output: `Generated public compatibility/release data for 0.86.2-rc.2.`
(Both output files are gitignored — `.gitignore` lines 23–26 — so they don't appear in `git status`; spot-checked and they now say `0.86.2-rc.2`.)

## 4. Gate results (Step E) — last lines of each

All ten `npm run` checks plus `release:verify` exited 0.

```
release-control-plane:check
  Release control-plane check passed (lockstep 0.86.2-rc.2, current package scope only).
  Public-surface ownership gate passed (694 derived rows; 694 owned by a published docs page, 0 by a ratified-but-unwritten page; inventory fresh; canonical source blobs explicitly acknowledged; no release-truth violations).

dist-policy:check
  Distribution-policy check passed (publication state, dist-tags, package boundary, compatibility and release environment agree).

docs:public-truth:check
  Public documentation truth check passed (registry commands, release channel and version authorities are consistent).

docs:portal-pages:check
  Portal page freshness check passed (component and pattern pages match their generators).

docs:reference:check
  Reference hub check passed (5 owner pages covering 219 public surfaces).

docs:contract:check
  ok    docs/component-reference.md is up to date
  Component documentation contract check passed.

docs:foundation:check
  Docs foundation contract passed (routes, redirects, environment SEO, source pipelines and release truth are consistent).

llms:check
  llms.txt family check passed (files match registry/exports/packages and all links resolve).

web:check
  Public Web quality gate passed.

docs:surface:check
  Public-surface ownership gate passed (694 derived rows; 694 owned by a published docs page, 0 by a ratified-but-unwritten page; inventory fresh; canonical source blobs explicitly acknowledged; no release-truth violations).

release:verify
  Release verification passed. Report: .artifacts/release-verification.json
  Canonical release tarballs: .artifacts/release-packages
  Release artifact digests recorded in .artifacts/release-verification.json.
```

**`docs:surface:acknowledge` was run once**, per the spec's contingency instruction. `release-control-plane:check` initially failed with:
```
Public-surface documentation ownership gate failed:
- packages/ui/package.json changed after documentation ownership was acknowledged (...)
- packages/tokens/package.json changed after documentation ownership was acknowledged (...)
- packages/core/package.json changed after documentation ownership was acknowledged (...)
```
because the version bump changed the manifest blobs. I ran `npm run docs:surface:acknowledge` (`node ./scripts/check-public-surface-ownership.mjs --acknowledge`), which re-acknowledged the 3 changed sources and rewrote `docs/public-surface-owners.json`'s `acknowledgedSourceBlobs` map. Re-ran `release-control-plane:check` and `docs:surface:check` — both green afterward (shown above).

## 5. `release:verify` tarball table (verbatim)

```
@beemvp/beeui-core@0.86.2-rc.2: beemvp-beeui-core-0.86.2-rc.2.tgz, 36709 bytes, sha256 77d7c7a41a7dd3dfd14f1346eea9f5c0d93f54f4fed89ccce7a856325b4717d1, canonical + reproducible
@beemvp/beeui-tokens@0.86.2-rc.2: beemvp-beeui-tokens-0.86.2-rc.2.tgz, 137593 bytes, sha256 5b48a4156cc5e17062ed68f0a08c35b52232733f5ab364767cb6857bc3309c02, canonical + reproducible
@beemvp/beeui-ui@0.86.2-rc.2: beemvp-beeui-ui-0.86.2-rc.2.tgz, 974335 bytes, sha256 e12143818eeff8da271a24d08cf310f57eacef9c35fd3b036616b2c9d679ec7c, canonical + reproducible
@beemvp/beeui-cli@0.86.2-rc.2: beemvp-beeui-cli-0.86.2-rc.2.tgz, 269202 bytes, sha256 64c0a2d8d39ef40bfa5b11790edbc5875c05c335a788809e173f27538ffe3aec, canonical + reproducible
Canonical release tarballs: .artifacts/release-packages
Release artifact digests recorded in .artifacts/release-verification.json.
```

## 6. Things I was unsure about / flagging

1. **Environment gap, fixed locally:** `npm run release:verify`'s second stage (`scripts/release/add-artifact-digests.mjs`) shells out to `tar --sort=name --format=gnu ...` (GNU-only long options). macOS ships `bsdtar` as `/usr/bin/tar`, which doesn't support those flags, so the command failed with `tar: Option --sort=name is not supported` on the first attempt. I installed `gnu-tar` via Homebrew (`brew install gnu-tar`, providing `gtar`) and prepended `/opt/homebrew/opt/gnu-tar/libexec/gnubin` to `PATH` for the `release:verify` invocation only; the script then completed cleanly and produced the canonical/reproducible digests in §5. This is a local dev-machine environment fix (Homebrew package install), not a repo content change — nothing under version control was touched by it, and `.artifacts/**` is gitignored.
2. **Pre-existing `CHANGELOG.md` / `.changeset/consumer-audit-batch.md` diff:** see §1 — this was present in the worktree without any action from me. Worth the controller double-checking this is the expected state (e.g. a `changeset version` run they intended) before this branch proceeds.
3. **`apps/docs/src/content/docs/reference/index.md`** still states `0.86.2-rc.1` is "publicly published" (§2) — it's a hand-maintained page under a directory the spec marks generator-only, and no listed Step D generator regenerates it. I left it untouched rather than hand-edit a forbidden directory; flagging so the controller can decide whether it needs its own generator pass or an explicit one-off edit.
4. **Classification calls made under the "current vs. historical" rule** where the spec gave examples but not every case verbatim (e.g., "Confirm `npm ls ...` resolves `0.86.2-rc.1` when using `@next` today" in `start/index.md:145`, and the literal `ERESOLVE` error reproduction in `start/web.md:21`) — I treated these as observed-registry-state / literal-reproduction statements (kept at rc.1) rather than candidate-version claims (changed to rc.2), since the real npm registry still serves rc.1 until the rc.2 staged publish is actually approved. `docs:public-truth:check` passed, which validates registry-command pins (`@next`/`@currentVersion`) but doesn't check this specific prose pattern, so this classification wasn't mechanically verified — a second pair of eyes on these two lines specifically would be worthwhile.

---

Status: DONE
Summary: Moved the workspace from `0.86.2-rc.2`-bumped manifests through dist-tag-policy/consumer-compatibility pins, hand-classified every `0.86.2-rc.1` prose hit as current-state (changed) or historical/observed (kept), regenerated all five doc surfaces, and got all ten Step E gates plus `release:verify` to exit 0 (required a `docs:surface:acknowledge` re-run and a local GNU-tar install to unblock `release:verify`'s digest stage).
Concerns/Blockers: `CHANGELOG.md`/`.changeset/consumer-audit-batch.md` already show a diff I didn't make (likely controller-owned, worth confirming); `apps/docs/src/content/docs/reference/index.md` still says rc.1 and isn't covered by any Step D generator; two prose lines (`start/index.md:145`, `start/web.md:21`) were classified as historical/observed by judgment rather than a mechanical check.

## Follow-up: latest-tag observation anchoring

Scope: fix the stale `0.86.2-rc.1`-era "the live registry currently (also) resolves `latest` to the same RC" / "resolves both `next` and `latest` to the same RC" / "an unqualified install currently resolves to the same RC by coincidence" sentence pattern across public prose and the three generator templates, anchoring it to the version it was actually observed at (`0.86.2-rc.1`) and stating it is re-verified after every publish, per the canonical wording supplied for this pass.

### Files changed this pass

`git diff --stat` at the end of this pass (full working-tree state, which already carried the uncommitted `0.86.2-rc.1` → `0.86.2-rc.2` version-bump diff noted in the environment context; the edits and regenerations below are layered on top of that pre-existing diff, not a clean before/after):

```
111 files changed, 174 insertions(+), 170 deletions(-)
```

Files this pass hand-edited directly for the anchoring fix:
- `scripts/public-component-reference.mjs` — `distributionStatusNote()`, the "Stable `latest` currently resolves to the same RC too" sentence
- `scripts/generate-llms-txt.mjs` — `buildStatusNote()` (STATUS line, ~L238) and the packages note (~L327)
- `README.md:16`
- `docs/dist-tag-policy.md:35`
- `docs/ai-agent-cookbook.md:7` and `:45` (also dropped the "npm's automatic first-publish default, not a deliberate stable promotion" clause at both spots — it directly contradicted the new "is not an npm rule" wording and would have made the sentence self-contradictory; `check-public-doc-truth.mjs`'s `FALSE_DIST_TAG_CAUSAL_CLAIMS` regex flags exactly that phrase, though this file isn't in that check's `PUBLIC_ROOTS` scan list so it wasn't gate-enforced)
- `apps/docs/src/content/docs/index.md:60`
- `apps/docs/src/content/docs/start/index.md:6, :9` (current-state sentences) and `:145` (per explicit instruction: changed the `npm ls ... resolves` line from the stale `0.86.2-rc.1` literal to `resolves the current candidate 0.86.2-rc.2`, overriding the previous pass's judgment call to keep it as a literal historical reproduction)
- `apps/docs/src/content/docs/start/expo.md:6`, `start/bare-react-native.md:6`, `start/web.md:6`
- `apps/docs/src/content/docs/guides/troubleshooting.md:492-493`
- `apps/docs/src/content/docs/ai/index.md:27`
- `apps/docs/src/content/docs/release-security/index.md:6`
- `apps/docs/src/content/docs/guides/cli-source-ownership.md:91`

Note: `apps/docs/src/content/docs/reference/index.md` (the one hand-maintained file allowed under `reference/`) was checked and already carried the correct "was last observed (at `0.86.2-rc.1`) resolving `latest` to the RC too" wording from an earlier pass — no further edit needed there.

Regenerated via the Step-D commands (`docs:portal-pages:generate`, `docs:contract:generate`, `llms:generate`, `docs:foundation:generate`, `docs:reference:generate`, `node scripts/public-guide-data.mjs`), which propagated the two generator-template fixes into: all 63 `apps/docs/src/content/docs/components/*.md` pages, `docs/component-reference.md`, `llms.txt`/`llms-full.txt`/`llms-components.txt`/`llms-patterns.txt`, `apps/docs/public/route-manifest.json` + `release-state.json`, and the `apps/docs/src/content/docs/reference/*.md` pages.

### Generator/test lines changed

- `scripts/public-component-reference.mjs` (~L1380-1387): the "Stable `latest` currently resolves to the same RC too." sentence → "Stable `latest` was last observed (at `0.86.2-rc.1`) resolving to the RC as well; that observation is re-verified after every publish and is not an npm rule." (bootstrap/`--tag next`/unestablished-mechanism sentence kept, just de-duplicated of the now-redundant trailing clause).
- `scripts/generate-llms-txt.mjs` `buildStatusNote()` (~L235-239): "the live registry currently resolves both `next` and `latest` to the same RC" → "the live registry was last observed (at `0.86.2-rc.1`) resolving both `next` and `latest` to that RC; that observation is re-verified after every publish and is not an npm rule."
- `scripts/generate-llms-txt.mjs` packages note (~L327): "(stable `latest` currently resolves to the same RC too; the bootstrap used ...)" → "(stable `latest` was last observed, at `0.86.2-rc.1`, resolving to the RC as well — re-verified after every publish and not an npm rule; the bootstrap used ...)".
- `scripts/generate-component-reference.mjs` needed no direct edit — it reuses `buildStatusNote` from `generate-llms-txt.mjs`, so `docs/component-reference.md`'s STATUS line is fixed via that one shared function.
- `scripts/public-guide-data.mjs` and `scripts/generate-docs-foundation.mjs` were checked and contain no instance of the pattern — no change needed.
- No test file under `scripts/__tests__/` asserted the literal old sentence text, so no test assertions needed updating.

### Gate results (last line each, all exit 0)

```
docs:portal-pages:check   → Portal page freshness check passed (component and pattern pages match their generators).
docs:portal-pages:test    → tests 283, pass 283, fail 0
docs:contract:check       → Component documentation contract check passed.
llms:check                → llms.txt family check passed (files match registry/exports/packages and all links resolve).
llms:test                 → tests 11, pass 11, fail 0
docs:foundation:check     → Docs foundation contract passed (routes, redirects, environment SEO, source pipelines and release truth are consistent).
docs:reference:check      → Reference hub check passed (5 owner pages covering 219 public surfaces).
docs:public-truth:check   → Public documentation truth check passed (registry commands, release channel and version authorities are consistent).
docs:public-truth:test    → tests 10, pass 10, fail 0
web:check                 → Public Web quality gate passed.
docs:surface:check        → Public-surface ownership gate passed (694 derived rows; 694 owned; inventory fresh; canonical source blobs acknowledged; no release-truth violations).
docs:contract:test        → tests 8, pass 8, fail 0
```

### Leftover grep hits (final check)

```
grep -rnE "same RC|currently (also )?resolves|resolves to the same|by coincidence" README.md docs llms.txt llms-full.txt apps/docs/src/content/docs scripts | grep -v node_modules
```

returns exactly three lines:

- `docs/npm-release-bootstrap.md:26` — unrelated checklist step ("set `expected_version` default to the same RC version"); explicitly out of scope per task instructions.
- `README.md:16` — the phrase "same RC" now appears inside the rewritten, correctly historical-anchored sentence itself ("...was last observed (at `0.86.2-rc.1`) resolving to the same RC as `@next`..."); this is the fixed wording, not a stale current-state claim.
- `docs/dist-tag-policy.md:35` — same situation: "same RC" is part of the new historical-anchored sentence ("An unqualified install was last observed (at `0.86.2-rc.1`) resolving to the same RC as `@next`...").

No stale current-state claims remain.

---

Status: DONE
Summary: Anchored every "latest currently (also) resolves to the same RC" / "resolves both next and latest to the same RC" / "by coincidence" sentence — in the two generator templates that produce it and all thirteen hand-maintained prose spots — to the observed `0.86.2-rc.1` state with a "re-verified after every publish, not an npm rule" qualifier, regenerated all derived docs, and confirmed all 12 required gates exit 0.
Concerns/Blockers: none. One judgment call worth noting: at `docs/ai-agent-cookbook.md:7` and `:45` I also removed the adjacent "npm's automatic first-publish default, not a deliberate stable promotion" clause since it would have directly contradicted the new "is not an npm rule" wording in the same sentence — this went slightly beyond the literal grep pattern but was necessary to avoid leaving a self-contradictory sentence, and matches the "unestablished mechanism" framing already used everywhere else in the docs.
