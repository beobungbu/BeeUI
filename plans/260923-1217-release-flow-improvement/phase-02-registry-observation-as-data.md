# Phase 02 — registry state as observed data; all public release claims render from data

**Context:** version-truth data-flow report, literal inventory, owner decisions D3/D7.
**Depends on:** Phase 01.
**Size:** L.

## Target

Two independent facts with independent provenance:

| Fact | Source | Meaning |
|---|---|---|
| Workspace/candidate version | `packages/ui/package.json` | what this checkout intends to release |
| Registry observation | `docs/registry-observation.json` written by `pnpm registry:observe` | what npm actually exposed at a specific time |

The observation file stores raw observed facts, not conclusions:

- `observedAt` (UTC timestamp);
- `observedBy` (local actor or workflow/run id);
- per package: observed `versions[]`, `distTags`, `dist.integrity` / shasum for the relevant version when available;
- command/tool metadata sufficient to reproduce the query.

There is **no authored `published` boolean**. Publication state is derived from the workspace version plus all four package observations.

## Required derived states

The shared renderer/state calculator must support at least:

- `unpublished` — workspace version exists on none of the four packages;
- `candidate-ahead-of-registry` — registry has an older complete BeeUI line, workspace is newer;
- `partial-publication` — the workspace version exists on only a subset of the four lockstep packages during/after staged publication;
- `prerelease-published` — all four packages expose the workspace RC consistently on the prerelease channel;
- `stable` — all four expose the stable workspace version consistently on the stable channel;
- `registry-inconsistent` — all packages/version presence may exist but dist-tags/lockstep observations disagree in a way that cannot be represented as a healthy release state.

Public docs must never collapse `partial-publication` or `registry-inconsistent` into “published”.

## Shared renderer

Create `scripts/release-status-lib.mjs` with:

- a pure state derivation function;
- renderers for markdown/plain/Astro inputs;
- no network access.

Consumers include generated component notes, llms output, README generated block, package/example README status blocks where retained, the Starlight release-status surface, release-state JSON and worker build identity.

### Starlight surface: override, not per-page components

The hand-authored Starlight pages are all `.md` (`apps/docs/src/content/docs/{start,guides,ai,theming,release-security}/*.md`, `index.md`); a `.md` page cannot render an Astro component inline. Two viable routes, in order of preference:

1. **Starlight `components` override (preferred).** `apps/docs/astro.config.mjs` already overrides `Head` with `src/components/SearchFilterHead.astro`; add a second override (e.g. `PageTitle` or `Banner`) that renders the release status from `release-state.json` when the page frontmatter sets `releaseStatus: true`. The 13 pages lose their hand-written paragraph and gain one frontmatter flag; no page becomes MDX and no `*.md` glob in the check scripts changes.
2. **Rename to `.mdx`.** Starlight bundles `@astrojs/mdx` (7.0.8 in the lockfile), so `<ReleaseStatus />` works after renaming the 13 files. Costs: every script that walks `*.md` under `apps/docs/src/content/docs` (`public-guide-data.mjs`, `check-public-doc-truth.mjs` walker, public-surface ownership page scans, `ci-scope` doc rules) must accept `.mdx`, and link/route checks must be re-run.

Pick route 1 unless a page needs the status inline mid-body.

Every public registry sentence includes the observation date/time or links to a release-state surface that does.

## Observation command

Create `scripts/registry-observe.mjs` and scripts:

- `pnpm registry:observe` — query all four packages and write one atomic snapshot;
- `pnpm registry:observe --stdout` — print without writing;
- `pnpm registry:observe:check` — compare live observations to the committed snapshot for explicit drift checks.

Rules:

1. Query all required packages before replacing the committed file.
2. A network/registry error must not overwrite the last good snapshot with partial data.
3. A successful snapshot may legitimately describe `partial-publication`; that is observed registry state, not a command failure.
4. Tests inject/mock the registry command; unit tests never require npm network access.

## Workflow model

Create `.github/workflows/registry-observe.yml` with:

- `workflow_dispatch` as the **primary** post-publish refresh path;
- a daily/low-frequency schedule as drift detection/backstop;
- read-only npm access and no npm secret;
- write permission only for the branch/PR update step.

When the observation changes, the workflow opens/updates a PR into `development`. Using `GITHUB_TOKEN` is acceptable only after proving the resulting PR receives the repository’s required validation/approval behavior. Do not assume bot-created PRs execute all protected CI unattended; record the actual repository behavior in the phase report. If fully unattended observation PRs are later required, design a GitHub App token path separately.

The release runbook explicitly dispatches observation after staged publication completes. The schedule is not the primary release step.

## Files

Create:

- `scripts/registry-observe.mjs`;
- `scripts/release-status-lib.mjs`;
- `docs/registry-observation.json`;
- `apps/docs/src/components/ReleaseStatus.astro`;
- `.github/workflows/registry-observe.yml`.

Modify generators/checks, README/package/example docs, release policy docs, release-state types, worker build identity and the hand-authored Starlight pages identified by the audit. Add tests for observation parsing, atomic-write behavior, all derived states and renderer output.

## Steps

1. Define and test the observation schema and pure state derivation first.
2. Add the registry observer with injectable command runner and atomic write.
3. Switch generators/release-state JSON to the shared state model; remove workspace==published assertions.
4. Replace live registry prose with generated blocks/components.
5. Add a public-truth rule forbidding hand-written current-state release claims outside generated blocks.
6. Add the dispatch + scheduled observation workflow and prove its PR/CI behavior.
7. Add `release:literal-audit` to report/fail on current-version literals outside explicit history/evidence/plan allowlists.

## Validation

- Unit fixtures cover all states including `partial-publication` and `registry-inconsistent`.
- Scenario: workspace `0.86.2-rc.9`, registry complete at rc.2 → renderer says candidate is ahead and reports observed `next`.
- Scenario: only core/tokens have rc.9 → renderer says partial publication; it must not say BeeUI rc.9 is fully published.
- Failed npm query leaves the committed observation untouched.
- README, docs, llms and worker release-state surfaces agree for the same snapshot.
- Full `pnpm typecheck && pnpm test` passes.

## Risks / rollback

The observer is the only new network-dependent operation. Build/docs generation stays offline. Rollback can keep the pure renderer and restore a manually captured snapshot, but must not reintroduce an authored publication boolean.
