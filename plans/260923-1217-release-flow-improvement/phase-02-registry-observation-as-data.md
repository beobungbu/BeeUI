# Phase 02 — registry state as observed data; all public sentences rendered from data

**Context:** `reports/scout-version-truth-data-flow-report.md` §3, §4, §6; `reports/scout-version-literal-inventory-and-ci-scope-report.md` §1(c), §2; owner decisions D3, D7. Depends on Phase 01.
**Size:** L. This is the phase that removes the ~29 hand-maintained narrative files and the "published while only staged" window.

## Target

Two facts, two provenances:

| Fact | Source | Field |
|---|---|---|
| Workspace / candidate version | `packages/ui/package.json` | `workspaceVersion` |
| Published state | `docs/registry-observation.json`, written by `pnpm registry:observe` (`npm view <pkg> versions dist-tags --json` for the four packages), with `observedAt` and `observedBy` (local user or workflow run id) | `published`, `publishedVersions[]`, `distTags.{latest,next}` per package |

`published` is no longer authored anywhere. `apps/docs/public/release-state.json` carries both facts and the equality assertion at `generate-docs-foundation.mjs:362-364` is removed; `status` becomes one of `unpublished | prerelease-published | candidate-ahead-of-registry | stable`.

Every public sentence about npm is rendered from these fields by one shared renderer (`scripts/release-status-lib.mjs`, exporting `renderDistributionStatus({ workspaceVersion, observation, format })` for markdown/plain/astro). Consumers: `distributionStatusNote` (component pages), `buildStatusNote` (llms), `docs/component-reference.md`, `README.md` (generated block between markers, checked by `docs:public-truth:check`), `packages/*/README.md` (generated block or no literal, per D7), an Astro component `<ReleaseStatus />` used by the 13 hand-authored Starlight pages in place of their paragraphs, `web/worker` `build-identity.json` gains `publishedVersion`/`observedAt`.

The `latest` observation stops being prose: the renderer prints "observed <date>: next → X, latest → Y" and, when `latest` points at a prerelease, the fixed sentence about the unestablished mechanism from the policy doc.

## Files

Create: `scripts/registry-observe.mjs` (+ `registry:observe`, `registry:observe:check` scripts), `docs/registry-observation.json`, `scripts/release-status-lib.mjs`, `apps/docs/src/components/ReleaseStatus.astro`, `.github/workflows/registry-observe.yml` (schedule daily + `workflow_dispatch`; opens/updates a PR into `development` when the snapshot changes; read-only registry access, no secrets).
Modify: `scripts/generate-docs-foundation.mjs`, `scripts/public-component-reference.mjs` (`distributionStatusNote`), `scripts/generate-llms-txt.mjs` (`buildStatusNote`, packages note), `scripts/generate-component-reference.mjs`, `scripts/check-public-doc-truth.mjs` (README block freshness; registry-command channel check reads observation), `scripts/check-distribution-policy.mjs` ("a published prerelease must use next" reads observation), `scripts/build-public-worker.mjs`, `web/worker/src/index.mjs`, `docs/dist-tag-policy.md` (prose points to the observation file; JSON keeps policy only), `README.md`, `packages/*/README.md`, `examples/**/README.md`, `docs/ai-agent-cookbook.md`, `docs/registry-cli.md`, `docs/release.md`, `docs/consumer-compatibility-report.md`, `docs/reference.content.json`, the 13 Starlight pages listed in the inventory report §1(c), `apps/docs/src/lib/release-state.ts` (now actually used), `scripts/generate-llms-txt.mjs:388` (move the "verified against rc.1" evidence sentence to a dated evidence field, or delete), `examples/scripts/pack-beeui-packages.mjs:6` comment. Tests for every touched script; new tests for the renderer (all four `status` states) and for `registry-observe --check`.

## Steps

1. Renderer + observation schema + `registry:observe` (with `--check` that diffs the live registry against the committed snapshot and exits non-zero on drift). Land with tests; no consumer change yet.
2. Switch generators and `release-state.json` to the renderer; remove the equality assertion; regenerate; `docs:portal-pages:check` etc. green.
3. README and package READMEs: generated block with `<!-- release-status:start/end -->` markers; `docs:public-truth:check` verifies the block equals renderer output.
4. Astro component; replace paragraphs in the 13 pages; `docs:public-truth:check` gains a rule: no hand-written sentence matching `/is publicly published|is public on npm|currently resolves|same RC/` outside generated blocks.
5. Observation workflow: daily schedule + dispatch; on change, commit `docs/registry-observation.json` and open a PR (uses `GITHUB_TOKEN` only). After every `stage-rc` approval the owner dispatches it once.
6. Inventory gate: `pnpm release:literal-audit` (in `release:prepare`) fails if a version literal other than the workspace version appears outside `CHANGELOG.md`, `docs/rc-candidate.md`, `docs/decisions/`, `plans/`.

## Validation

- Unit: renderer snapshots for the four states; `registry-observe --check` against a fixture registry (mock `npm view` via injectable runner).
- Scenario: set workspace to `0.86.2-rc.9` with observation at rc.2 → docs say "candidate 0.86.2-rc.9 ahead of registry; published next → 0.86.2-rc.2 (observed 2026-…)"; README block and llms agree.
- `grep -rn "publicly published\|same RC\|currently resolves" README.md docs apps/docs/src/content/docs llms*.txt` returns only generated blocks and the renderer.
- Full `pnpm typecheck && pnpm test`.

## Risks / rollback

Network in the observe workflow only; docs builds stay offline (D3 committed snapshot). If npm rate-limits, the workflow retries later; nothing else depends on it. Rollback: keep the renderer but seed the observation file by hand once.
