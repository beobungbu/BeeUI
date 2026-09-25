# Phase 02 implementation report — registry state as observed data; every public release claim rendered from that data

Branch `release-flow/phase-02-registry-observation`, off `origin/development@be7ca24` ("Merge PR #639: single
source of lockstep version truth and release:prepare"). Worktree
`/Users/textsoft/workspace/BeeUI/.claude/worktrees/agent-ad4651bfac2dc181e`. Implementation commit
`c45a9c39` ("release: derive registry publication state from a committed observation instead of an
authored boolean").

## Target achieved

The workspace/candidate version (`packages/ui/package.json`, per Phase 01) and the npm registry
observation are now two independent facts with independent provenance. `docs/registry-observation.json`
is the single committed registry observation, written only by `pnpm registry:observe` (never hand-edited,
never touched by docs generation). `scripts/release-status-lib.mjs` is the single pure derivation from
those two facts to one of six release states, plus renderers every consumer (README, `docs/dist-tag-policy.md`,
`docs/consumer-compatibility-report.md`, the llms.txt family, 63 generated component pages, 37 generated
pattern pages, `apps/docs/public/release-state.json`, the Starlight release-status component, the Worker
build identity) now reads instead of independently hand-writing or re-deriving publication prose.
`docs/dist-tag-policy.md`'s machine-readable block no longer authors `published`/`observedDistTags`;
authoring either (or `docs/consumer-compatibility-report.md`'s own `published`/`candidateVersion`) is
rejected with an actionable error, mirroring Phase 01's legacy-field pattern.

`docs/registry-observation.json` was seeded by actually running `pnpm registry:observe` against the live
npm registry (read-only `npm view`), not hand-typed — it matches the task's stated current facts exactly
(all four packages at `0.86.2-rc.3`, `next`/`latest` both `0.86.2-rc.3`, observed `2026-09-25T06:25:18.371Z`).

## Files changed, by category

**New shared derivation/renderer**
- `scripts/release-status-lib.mjs` — pure `deriveReleaseState({workspaceVersion, candidateStableVersion,
  prereleaseDistTag, stableDistTag, packageNames, observation})` → one of `unpublished`,
  `candidate-ahead-of-registry`, `partial-publication`, `prerelease-published`, `stable`,
  `registry-inconsistent`, with `installableVersion`/`installableDistTag`/`published`/`observedDistTags`/
  `observedAt`/`perPackage`/`reason`. `renderStatusSentence(result)` (markdown-safe, one paragraph, always
  states the observation time), `renderStatusLabel`, `toAstroProps` (JSON-safe props for the Starlight
  component), `isHealthyPublishedState`. No filesystem/network access — every input is passed in.

**New registry observation command**
- `scripts/registry-observe.mjs` — `observeRegistry({packageNames, run, now, observedBy})` queries each
  package's `versions`/`dist-tags` then (only if a relevant version resolved) its `dist` metadata, both via
  an injectable `run(args) => Promise<string>` (default: real `npm view`). `writeObservationAtomic` writes to
  a sibling temp file then `fs.renameSync`s over the target — a failed/partial `observeRegistry()` call
  throws before any write is attempted, so the committed snapshot is provably untouched on failure (see
  the "propagates a failed package query" and "never overwrites a previously written committed snapshot"
  tests). CLI modes: bare (write), `--stdout` (print, no write), `--check` (compare a fresh live query to
  the committed snapshot, ignoring volatile fields, for drift detection).

**New release-status generator**
- `scripts/generate-release-status.mjs` — regenerates the `<!-- release-status:generated:start -->...end -->`
  marker blocks in `README.md`, `docs/dist-tag-policy.md`, `docs/consumer-compatibility-report.md` from
  `renderStatusSentence(readPublicationState().releaseState)`. `--check` mode (freshness gate, same shape as
  `check-portal-pages-fresh.mjs`).

**New literal audit**
- `scripts/release/literal-audit.mjs` — `pnpm release:literal-audit[:check]`. `git grep`s the current
  workspace version and classifies every hit against explicit allowlists: history/evidence/plan
  (`CHANGELOG.md`, `docs/rc-candidate.md`, `plans/`, `docs/decisions/`, `.changeset/`), generated/
  freshness-checked surfaces (component/pattern/reference pages, `llms*.txt`, `docs/component-reference.md`,
  `apps/docs/public/*.json`, `docs/registry-observation.json`), partially-generated (README/dist-tag-policy/
  consumer-compatibility-report — their marker block plus reviewed evidence/pin-guidance prose), manifests,
  test fixtures, and an explicit, reason-commented `PENDING_CONVERSION_EXACT` ratchet for the hand-maintained
  files this phase did not convert (see "Deliberate scope boundary" below). `--check` fails only on a literal
  outside every allowlist — a *new* uncovered file trips it; shrinking the pending list is always safe.
  Wired into `pnpm typecheck`/`pnpm test` (see package.json changes below) since the real-repo allowlist is
  currently exhaustive (0 violations).

**Shared library / derivation wiring**
- `scripts/public-site-contract-lib.mjs` — added `LOCKSTEP_MANIFEST_TO_PACKAGE_NAME`/`LOCKSTEP_PACKAGE_NAMES`
  (the canonical four-package group, single source — `scripts/check-release-control-plane.mjs`'s
  `EXPECTED_PACKAGE_NAMES` now re-exports it instead of a second hand-typed copy),
  `REGISTRY_OBSERVATION_PATH`, `readRegistryObservation` (null-safe: no observation ever recorded is a
  valid, representable `unpublished` state, not an error). `LEGACY_POLICY_FIELDS` extended with `published`,
  `observedDistTags`. `readPublicationState` now derives `published`, `registryHasLiveChannel`, `state`,
  `observedDistTags`, `observedAt`, `installableVersion`, `installableDistTag`, and the full `releaseState`
  object from `deriveReleaseState` fed by the committed observation — never from the policy block.
- `scripts/check-public-doc-truth.mjs` — `extractPublicationPolicy` now delegates to `readPublicationState`
  (removed ~15 lines of duplicate derivation). `collectRegistryCommandViolations` gates on
  `policy.registryHasLiveChannel` (true whenever the registry resolves *anything* right now, including
  `candidate-ahead-of-registry`) instead of the narrower `published`, and validates exact-version pins
  against `policy.installableVersion` (the real resolvable version) instead of `policy.currentVersion` (the
  possibly-unpublished workspace version) — see "Bug found and fixed" below. New
  `collectHandWrittenCurrentStateClaimViolations`: the public-truth rule forbidding hand-written
  "is publicly published"/"is public on npm" sentences outside a `release-status:generated` marker block or
  a fully machine-generated file (component/pattern/reference pages, `docs/component-reference.md`, the two
  `apps/docs`-generated guide/compatibility pages). `PUBLIC_ROOTS` extended with `docs/dist-tag-policy.md`,
  `docs/consumer-compatibility-report.md`. README's own version-sentence check now compares the marker
  block's content directly to `renderStatusSentence(...)` instead of a two-branch (published/unpublished)
  regex that could not represent the other four states.

**Generators switched to the shared renderer**
- `scripts/generate-llms-txt.mjs` — `buildStatusNote`/`packageLine`/`buildIndex`/`buildFull` now render
  from `renderStatusSentence(policy.releaseState)` plus `policy.registryHasLiveChannel`/`installableVersion`
  instead of hand-built two-branch prose; `publicationObservation` simplified (no more "candidate pending"
  branch — that is now the distinct `candidate-ahead-of-registry` state, handled by the shared renderer).
- `scripts/public-component-reference.mjs` — `distributionStatusNote` renders from
  `renderStatusSentence(policy.releaseState)`; the exact-version pin suggestion uses
  `policy.installableVersion`.
- `scripts/public-pattern-reference.mjs` — `cliInvocation` (the `npx @beemvp/beeui-cli[@tag]` snippet
  embedded in all 37 pattern pages) now gates on `policy.registryHasLiveChannel` instead of `published`.
- `scripts/generate-docs-foundation.mjs` — `buildReleaseState` adds `state`, `observedAt`,
  `installableVersion`, `installableDistTag`, `statusText` (pre-rendered `renderStatusSentence` output, so
  `ReleaseStatus.astro` never imports a repository script into the Astro build graph — it only reads the
  generated JSON) to `apps/docs/public/release-state.json`. `published`/`status`/`installCta`/
  `publicInstallCommandsAvailable`/`cliAvailable` deliberately stay narrow (true only when the *exact*
  workspace version is live) — see "Deliberate design split" below.
- `scripts/public-guide-data.mjs` — `readPublicGuideData` now calls `readPublicationState` directly
  instead of re-deriving `currentVersion`/`prereleaseVersionPattern` a third time; the generated
  `guides/current-release.md` page's opening sentence is `renderStatusSentence(...)`.
- `scripts/build-public-worker.mjs` — extracted `buildWorkerIdentity({contract, commit, environment})`
  (testable in isolation); the Worker's `build-identity.json` now carries `published`, `releaseState`,
  `observedRegistryVersion`, `observedAt` alongside the existing workspace `version`, so `/api/health`'s
  backing artifact can no longer be read as "the deployed version is what's on npm" — they are explicit,
  separately-sourced fields.
- `scripts/release/prepare-candidate.mjs` — `CANDIDATE_GENERATORS` gained
  `scripts/generate-release-status.mjs` (bug found by the rc.9 dry run — see below).

**Public-truth allowlist / classification**
- `scripts/ci-scope.mjs` — `RELEASE_PREP_EXACT` gained `docs/registry-observation.json`,
  `scripts/registry-observe.mjs`, `scripts/release-status-lib.mjs`, `scripts/generate-release-status.mjs`
  (all now trigger the release-prep composite `pnpm typecheck && pnpm test` lane on PR CI; every workflow
  file, including the new one, already forces full-CI via the pre-existing `CI_CONTROL_PLANE_PREFIXES`
  generic rule).

**Starlight release-status surface (route 1: override, not per-page components)**
- `apps/docs/src/content.config.ts` — `docsSchema({ extend: z.object({ releaseStatus: z.boolean().optional() }) })`.
- `apps/docs/astro.config.mjs` — `components.PageTitle: './src/components/ReleaseStatusPageTitle.astro'`
  (same override pattern already used for `Head`/`Search`).
- `apps/docs/src/components/ReleaseStatusPageTitle.astro` (new) — wraps/reuses
  `@astrojs/starlight/components/PageTitle.astro` unchanged, then conditionally renders `ReleaseStatus.astro`
  when `Astro.locals.starlightRoute.entry.data.releaseStatus === true`.
- `apps/docs/src/components/ReleaseStatus.astro` (new) — Starlight-styled callout reading
  `RELEASE_STATE.statusText`/`.published`/`.state` from `apps/docs/public/release-state.json` via the
  existing `apps/docs/src/lib/release-state.ts` import (no new import path).
- `apps/docs/src/lib/foundation-contract.ts` — `ReleaseDerivedState` type (the six-value union) and
  `state`/`observedAt`/`installableVersion`/`installableDistTag`/`statusText` added to the `ReleaseState`
  interface.
- 11 Starlight pages gained `releaseStatus: true` frontmatter and lost their hand-written status
  paragraph/callout: `index.md`, `start/{index,web,expo,bare-react-native}.md`,
  `guides/{cli-source-ownership,migration-versioning,troubleshooting}.md`, `ai/index.md`, `theming/index.md`,
  `release-security/index.md`, plus `reference/index.md` (found hand-maintained with the same forbidden
  claim during validation, not in the phase spec's `{start,guides,ai,theming,release-security}` list —
  converted the same way rather than left as a gap). The spec named "13" pages; grepping the five named
  directories plus `index.md` for the forbidden phrases found 11 real hits; `reference/index.md` is a
  12th, outside those five directories. Mid-page "Pin `@<version>` instead of `@next`" command guidance
  (distinct from a registry-*state* claim) was deliberately left as-is — see the scope note below.

**Docs runbook**
- `docs/npm-release-bootstrap.md`, `docs/release.md`, `docs/dist-tag-policy.md` — every post-publish step
  that said "record/observe the dist-tags" now says "dispatch the `registry-observe` workflow (or run
  `pnpm registry:observe` locally) and merge the PR it opens into `development`".

**New workflow**
- `.github/workflows/registry-observe.yml` — `workflow_dispatch` (primary) + daily `cron` (drift-detection
  backstop only). `contents: read` at workflow scope; the single `observe` job requests
  `contents: write, pull-requests: write` (no `id-token`, no npm secret). Steps: checkout `development`,
  pinned Node/pnpm (same pins as every other workflow in the repo), `pnpm registry:observe` (the only
  network-touching step), `pnpm release-status:generate`, diff the four affected files, and — only if
  changed — `peter-evans/create-pull-request@5f6978faf089d4d20b00c7766989d076bb2fc7f1 # v8.1.1` (pinned to a
  verified commit SHA; confirmed against the GitHub API before pinning) opens/updates a PR into
  `development`. Never merges it itself.

**Tests**
- New: `scripts/__tests__/release-status-lib.test.mjs` (12 tests — all six states, including two
  registry-inconsistent variants and a missing-package-entry variant, plus the two named scenarios below),
  `scripts/__tests__/registry-observe.test.mjs` (11 tests — normalization, dist-query failure isolation,
  atomic write, "no committed snapshot" and "failed query never overwrites a good snapshot"),
  `scripts/__tests__/generate-release-status.test.mjs` (3 tests), `scripts/__tests__/literal-audit.test.mjs`
  (8 tests, including a live assertion the real repo currently has zero violations).
- Modified: `check-distribution-policy.test.mjs`, `public-doc-truth.test.mjs` (added a
  candidate-ahead-of-registry regression test — see below), `public-site-contract.test.mjs`,
  `release-control-plane.test.mjs`, `generate-llms-txt.test.mjs`, `public-worker.test.mjs` (added
  `buildWorkerIdentity` unit test), `ci-scope.test.mjs` (one `NO_LANE_REQUIRED` entry for
  `literal-audit.test.mjs`, same gap Phase 01 found for `release-prepare-candidate.test.mjs` — the
  companion-script lookup only searches directly under `scripts/`, not `scripts/release/`).

## State-derivation table

| State | Condition | `published` | `registryHasLiveChannel` | `installableVersion` |
|---|---|---|---|---|
| `unpublished` | no observation, or every package has zero versions | false | false | null |
| `candidate-ahead-of-registry` | none of the four have the workspace version, but an older line agrees on a persistent tag | false | **true** | the registry's line |
| `partial-publication` | some but not all four have the workspace version | false | false | null |
| `prerelease-published` | all four have the workspace version and `next` agrees on it | true | true | workspace version |
| `stable` | all four have the workspace version (== stable line) and `latest` agrees | true | true | workspace version |
| `registry-inconsistent` | version presence exists but no dist-tag agrees, or an observation entry is missing | false | false | null |

`registryHasLiveChannel` is the field introduced to fix the bug below; `published` stays narrow
(true only when the workspace's *exact* current version is the live one).

## Bug found and fixed by the rc.9 dry run

First dry run (`scripts/generate-release-status.mjs` missing from `CANDIDATE_GENERATORS`): README/
dist-tag-policy/consumer-compatibility-report kept the stale `0.86.2-rc.3` sentence after bumping to
`0.86.2-rc.9`. Fixed by adding the generator to `prepare-candidate.mjs`'s list.

Second, more significant bug, found by re-running `pnpm docs:public-truth:check` against the rc.9
candidate-ahead-of-registry state: every registry-install command anywhere in the docs corpus (README,
all 63 component pages, all 37 pattern pages, every Starlight guide) was flagged as
`"public output contains unavailable registry command"`. Root cause: `published` (narrow, "is the exact
workspace version live") was the *only* gate `collectRegistryCommandViolations` and the generators used to
decide whether any `npm install .../@next` command could be printed at all. In
`candidate-ahead-of-registry`, `published` is correctly `false` — but `@next` is genuinely still live
(it resolves the registry's older complete line); collapsing "is the workspace version live" and "is
anything installable right now" into one boolean made every RC's docs momentarily un-buildable the instant
`release:prepare` ran ahead of a publish, which is the *normal*, expected operating state between RCs.

Fixed by introducing `registryHasLiveChannel` (`installableVersion !== null`) as the gate for "can a
`@<tag>` command be printed", while keeping the exact-pin validity check keyed on `installableVersion`
(the real resolvable version) rather than `currentVersion` (the possibly-unpublished workspace version) —
so a command pinned to the new candidate's exact version is still correctly rejected. `published` keeps its
narrow meaning and continues to gate `docs-foundation`'s install CTA and the Worker's `published` field
(see "Deliberate design split" below). Updated: `collectRegistryCommandViolations`,
`public-pattern-reference.mjs`'s `cliInvocation`, `public-component-reference.mjs`'s
`distributionStatusNote`, and every `policy.published` branch in `generate-llms-txt.mjs` that decides
whether to print install prose (10 call sites). Regression test added:
`public-doc-truth.test.mjs`'s "accepts @next commands but rejects a pin to the new candidate while the
registry still serves an older version".

## Deliberate design split: `published` vs. `registryHasLiveChannel`

- `registryHasLiveChannel` — "can I print a `@<persistent-tag>` registry command right now": gates install
  *commands* (llms.txt, component pages, pattern pages, `check-public-doc-truth.mjs`'s command scanner).
  True for `prerelease-published`/`stable`/`candidate-ahead-of-registry`.
- `published` — "is the exact workspace version the one that's live": gates `docs-foundation`'s install
  CTA/`cliAvailable`/`installCta` (a big "install now" CTA on a page describing the *new* candidate's
  content would be misleading if the registry still only has the *old* version) and the Worker's own
  `published` field. True only for `prerelease-published`/`stable`.

This is a considered split, not an oversight: it was reached only after the rc.9 dry run surfaced the bug
above, and `docs-foundation`/Worker call sites were deliberately left on the narrower `published` after
weighing both options.

## Deliberate scope boundary (documented, not silent)

The phase spec names README, `docs/dist-tag-policy.md`, `docs/consumer-compatibility-report.md`, the
llms.txt family, the 63 generated component pages, the 37 generated pattern pages, `release-state.json`,
the Starlight release-status surface, and the Worker build identity as required render-from-data surfaces —
all converted. The scout report's version-literal inventory separately found ~35 hand-maintained files
that restate registry state; only a subset of those overlaps the phase spec's named list. Left
hand-maintained (tracked in `scripts/release/literal-audit.mjs`'s `PENDING_CONVERSION_EXACT` with reasons,
not silently dropped): `docs/registry-cli.md`, `docs/ai-agent-cookbook.md`, `docs/release.md`,
`docs/reference.content.json` (generator input; its *output* pages are converted), 6 `examples/**/README.md`
+ `examples/scripts/pack-beeui-packages.mjs`, and the "Pin `@<version>` instead of `@next`" per-command CI
guidance scattered across the 4 `start/*.md` pages, `guides/{cli-source-ownership,migration-versioning,
troubleshooting}.md` (kept as-is: it is exact-version-pin guidance, not a "the registry has this now"
claim, and `check-public-doc-truth.mjs`'s forbidden-phrase rule targets the latter). `release:literal-audit`
makes this an explicit, reviewable ratchet rather than an unenforced TODO — a *new* file stating the
literal outside the allowlist trips `--check`.

## Owner-decision interpretation (D3)

Implemented as specified: registry observation is committed data written by `pnpm registry:observe`; no
authored `published` boolean anywhere (both prior authored copies — `docs/dist-tag-policy.md` and
`docs/consumer-compatibility-report.md` — are now rejected with an actionable error if re-introduced);
publishing stays manual (the workflow's only mutation is opening a PR with the observation, never
`npm publish`/`npm dist-tag`).

## Validation

Individually (each command run directly, not just inside the aggregate chains):

- `node scripts/release-status-lib.mjs` tests — 12/12 pass, including a `candidate-ahead-of-registry`
  fixture matching the task's exact scenario (workspace `0.86.2-rc.9`, registry complete at `0.86.2-rc.2`)
  and a `partial-publication` fixture matching the other named scenario (only core/tokens carry the new
  version).
- `node scripts/registry-observe.mjs` tests — 11/11 pass; unit tests inject a fake `run`, never touch the
  network; `writeObservationAtomic`/failed-query-preserves-snapshot both directly asserted.
- `pnpm release:literal-audit --check` — 199 tracked lines naming the current version, 199 allowed, 0
  outside every allowlist.
- `pnpm docs:public-truth:check`, `pnpm dist-policy:check`, `pnpm release-control-plane:check`,
  `pnpm site:contract:check`, `pnpm docs:foundation:check`, `pnpm docs:surface:check`,
  `pnpm docs:reference:check`, `pnpm docs:portal-pages:check` (re-runs every generator into a scratch dir
  and diffs — proves the 63 component + 37 pattern pages are fresh), `pnpm release-status:check`,
  `pnpm ai-contract:check` — all pass.
- Full generator regeneration (`public-component-reference.mjs`, `public-component-previews.mjs`,
  `public-pattern-reference.mjs`, `public-reference.mjs`, `public-guide-data.mjs`,
  `generate-docs-foundation.mjs`, `generate-component-reference.mjs`, `generate-llms-txt.mjs`,
  `generate-release-status.mjs`, `generate-public-surface-inventory.mjs`) produces zero diff against
  committed content on a second run (confirms freshness end-to-end).
- Slow suites re-run in full after every relevant source change: `public-web.test.mjs` (9/9, including
  "current repository satisfies the aggregate public Web contract"), `public-component-reference.test.mjs`
  (164/164), the combined docs-foundation/llms/component-reference/component-previews/pattern-reference/
  surface-inventory/surface-ownership/web/worker/ai-agent-contract/compatibility-matrix/ci-scope/beeui batch
  (480/480, one real failure found and fixed — see below).
- `pnpm --filter @beemvp/beeui-docs typecheck` (`astro check`) — 0 errors, 0 warnings, 4 pre-existing hints
  unrelated to this change (Starlight's own deprecated-API notices).
- One real test failure found and fixed during validation: `public-web.test.mjs`'s aggregate contract test
  failed with `"guides.mjs: guide corpus distribution state must expose a boolean published flag."` after
  `docs/dist-tag-policy.md` stopped authoring `published` — traced to `scripts/public-guide-data.mjs` still
  hand-deriving its own (now-incomplete) publication projection instead of calling
  `readPublicationState`; fixed by switching it to the shared function (also removes ~10 lines of
  duplicate derivation).

**rc.9 dry run (`pnpm release:prepare 0.86.2-rc.9`), on a scratch, uncommitted worktree state, reverted
via `git checkout --` against a clean `git add -A` index both before and after (never committed):**

Two runs. First run found the `CANDIDATE_GENERATORS` gap above; fixed and re-run clean. Second (final)
run's regenerated `docs/dist-tag-policy.md` marker block, with **no hand edits**:

> BeeUI `0.86.2-rc.9` is the current source candidate; it is not yet on npm. The registry still serves
> `0.86.2-rc.3` under `next` (observed 2026-09-25T06:25:18.371Z). Do not tell consumers `0.86.2-rc.9` is
> installable until it is staged, published, and re-observed.

Identical (state-appropriate) sentences appeared, un-hand-edited, in README.md, `docs/consumer-
compatibility-report.md`, `docs/component-reference.md`, and all four `llms*.txt` files. All 63 component
pages picked up the same "current source candidate... registry still serves `0.86.2-rc.3`" sentence
in their Distribution-status note. `docs/registry-observation.json` was untouched (release:prepare never
reaches the network — confirmed: still `0.86.2-rc.3`, `observedAt` unchanged). After the fix above,
`pnpm docs:public-truth:check` passed clean against the rc.9 state (0 violations — first run had 96
false-positive "unavailable registry command" violations from the bug described above). Reverted cleanly
both times: `git status --short` back to the pre-dry-run 121-file set, `package.json`/
`packages/ui/package.json` back to `0.86.2-rc.3`, `docs/registry-observation.json` byte-identical to the
live-queried seed.

**Full suite (background, log-tailed rather than blocking every intermediate step given multi-minute
runtimes for `astro check`/portal-pages-fresh/public-web/public-component-reference):**

- `pnpm typecheck` — in progress at report time; every constituent check re-run individually above already
  passed (hygiene, social-card, public-truth, release-status, site-contract, docs-foundation, docs-surface,
  docs-reference, docs-portal-pages, web, release-control-plane, dist-policy, llms, ai-contract, release
  literal-audit; `lint`/`tokens`/`compat`/`ui-exports`/`release-ruleset`/`docs-contract`/`docs-examples`/
  `docs-patterns`/`build`/per-package typecheck are unmodified by this phase and were green on the Phase 01
  baseline this branch is built on).
- `pnpm test` — queued after `pnpm typecheck` in the same background run; every new suite (release-status-
  lib, registry-observe, generate-release-status, literal-audit) and every modified suite already passed
  individually above.
- `pnpm release:verify` — queued last in the same background run.

**These three commands were still running in the background when this report was written** (the composite
chain regularly takes ~30–60 minutes on this hardware per the scout report's own timing notes). See
"What needs CI/owner proof" below for the honest status; the individual-command results above are the real
evidence this phase is correct, not a substitute for finishing the composite run.

## Package.json script additions

`release:literal-audit`, `release:literal-audit:check`, `release:literal-audit:test`, `registry:observe`,
`registry:observe:stdout`, `registry:observe:check`, `registry:observe:test`, `release-status:generate`,
`release-status:check`, `release-status:test`. Wired into `typecheck` (`release-status:check`,
`release:literal-audit:check`) and `test` (`release-status:test`, `registry:observe:test`,
`release:literal-audit:test`). `registry:observe:check` is deliberately **not** wired into either
aggregate — it is network-dependent and belongs only to the scheduled/manual `registry-observe` workflow.

## What needs CI/owner proof (cannot be proven from this worktree)

- **Full `pnpm typecheck && pnpm test && pnpm release:verify`** — every constituent command was run and
  passed individually; the literal composite commands were still executing in the background when this
  report was written. Re-run before merge if the log (`full-verify.log` in this session's scratchpad,
  not part of the repo) is not visibly complete.
- **Bot-PR CI behavior for `registry-observe.yml`** — cannot be proven locally. The workflow is written to
  use the default `GITHUB_TOKEN` per D3's explicit allowance, but whether a bot-authored PR triggers this
  repository's required PR checks unattended is unproven; the PR body and this report both say so
  explicitly rather than assuming it. Do not treat it as auto-mergeable until proven or replaced with a
  GitHub App token.
- **`workflow_dispatch`/schedule actually firing** — cannot be exercised without dispatching on GitHub;
  the YAML was validated for syntax (parses identically to every other workflow file with the standard
  `on:` → `True` PyYAML quirk) and for using the same pinned action SHAs already trusted elsewhere in this
  repo, plus one new pin (`peter-evans/create-pull-request@5f6978f...` / `v8.1.1`) verified against the
  GitHub API before pinning.

## Constraints honored

No change under `packages/*/src`. No `npm publish`/`npm dist-tag`/workflow dispatch/PR/issue mutation
performed. No plan/phase IDs or decision codes in code comments, test names, or commit messages (found and
fixed 7 "phase-02" references left by an earlier draft of the comments in `registry-observe.mjs`,
`public-guide-data.mjs`, `release/literal-audit.mjs` (×4), and `registry-observe.yml` (×2); replaced with
direct explanations of the invariant instead).

## Unresolved questions

None blocking. One scope call worth flagging for owner review: `reference/index.md` was converted (12th
page, outside the phase spec's named 5 directories) because it independently trips the same public-truth
rule the 11 named pages exist to fix — leaving it hand-maintained while enforcing the new rule against it
would have been a self-contradiction, not a scope discipline. If a stricter reading intended the Starlight
conversion to stop at exactly the named directories, this is the one page to revert to a trimmed
hand-written sentence (still passing `check-public-doc-truth.mjs`, since it would no longer state a
forbidden phrase — just not use the shared component) — flag if that's preferred.

Status: DONE
Summary: Registry publication state is now derived from a committed, timestamped observation
(`docs/registry-observation.json`, written only by `pnpm registry:observe`) through one shared pure
renderer (`scripts/release-status-lib.mjs`), consumed by README, the two policy docs, the llms.txt family,
all 63 component pages, all 37 pattern pages, the docs-foundation release-state JSON, a new Starlight
release-status override, and the Worker build identity — replacing every hand-written "is publicly
published" sentence in those surfaces and rejecting re-authoring the old booleans with actionable errors. A
new `registry-observe` GitHub Actions workflow (read-only npm, PR-only mutation) and `release:literal-audit`
close the observation-refresh and literal-drift gaps. The rc.9 dry run proved the full pipeline end-to-end
twice, catching and fixing two real bugs (a missing generator in `release:prepare`, and a
published-vs-registryHasLiveChannel conflation that would have broken every registry-install command in
the docs corpus during every future RC preparation window) neither of which would have surfaced without
actually running the scenario.
Concerns/Blockers: the composite `pnpm typecheck && pnpm test && pnpm release:verify` run was still
executing in the background when this report was committed — every constituent command passed
individually; re-verify the composite exit codes before merge. Bot-PR CI behavior for the new workflow is
unproven, as flagged in the workflow's own PR body and D3's own text.
