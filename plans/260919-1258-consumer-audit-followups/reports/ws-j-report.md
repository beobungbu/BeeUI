# WS-J — #585 prose passes + dist-tag policy aligned with real npm state — report

Branch: `ws/j-docs-dist-tag`, created from `origin/fix/consumer-audit-followups` (the worktree's
own checkout had drifted to an unrelated `worktree-agent-*` head with no plan files — same drift
pattern earlier workstreams recorded — so the branch was created directly from the remote ref).

## Item 2 — #561 dist-tag truth (done)

Verified real npm state before editing anything:

```
npm view @beemvp/beeui-ui dist-tags --json      → {"next":"0.86.2-rc.1","latest":"0.86.2-rc.1"}
npm view @beemvp/beeui-cli dist-tags --json     → {"next":"0.86.2-rc.1","latest":"0.86.2-rc.1"}
npm view @beemvp/beeui-core dist-tags --json    → {"next":"0.86.2-rc.1","latest":"0.86.2-rc.1"}
npm view @beemvp/beeui-tokens dist-tags --json  → {"next":"0.86.2-rc.1","latest":"0.86.2-rc.1"}
```

`docs/dist-tag-policy.md` rewritten: added a "Real current dist-tag state" section explaining
npm always points a package's first-ever publish at `latest` regardless of `--tag`, that there is
no supported way to unpoint `latest` while it is the package's only version, and what changes at
the first stable `0.86.2` publish (`latest` moves deliberately and never returns to a prerelease;
`next` keeps tracking prereleases). Updated the "Persistent dist-tags" table, the "do not document
a bare install" guidance (rationale changed from "unqualified follows latest" — no longer true
today — to "the coincidence ends at first stable publish"), and the stable-publication steps to
note the `latest` move there is the *first deliberate* one.

Then swept every page carrying the old invariant ("latest is not promoted yet", "must never point
to a prerelease", "not published to npm", "remains intentionally unassigned") and rewrote each to
state the real coincidence and the real transition point: README.md, `docs/ai-agent-cookbook.md`
(4 spots), `apps/docs/src/content/docs/{index.md, start/index.md, start/web.md, start/expo.md,
start/bare-react-native.md, guides/migration-versioning.md (2 spots), guides/cli-source-ownership.md,
guides/troubleshooting.md, release-security/index.md, ai/index.md, reference/index.md}`.

Two additional stale claims found during the sweep (not in the spec's literal list but the same
class — "any page that still says ... a bare npm install will fail"):
- `apps/docs/src/content/docs/reference/index.md` had a `:::caution[Publication state]` block
  claiming "BeeUI packages and the CLI are not published to npm" — false since the RC publish.
  Rewritten to state the real publication/dist-tag state.
- `apps/docs/src/content/docs/index.md` (site root) had "Stable `latest` remains intentionally
  unassigned to this RC" — same false invariant, different phrasing my first grep pass missed;
  caught on a second broader sweep and fixed.
- `apps/docs/src/content/docs/showcase.md` said "The runtime still states that BeeUI
  packages/CLI are unpublished" — corrected to point at the authoritative pages instead of
  asserting a specific in-app string.

Generators: `docs/dist-tag-policy.md` is read at generation time by `scripts/generate-llms-txt.mjs`
(`buildStatusNote`, `packagesNote` — explicitly "llms generators" per file ownership) and by
`scripts/public-component-reference.mjs`'s `distributionStatusNote` (the per-component-page
"Distribution status" note; not in the phase's literal scripts list, but it is the docs:contract/
docs:portal-pages generator that reads this exact policy and produces the exact stale sentence on
all 63 component pages plus 37 pattern pages plus the llms.txt family — the same edge case WS-D2's
report flagged for the identical function. Edited it and regenerated via `pnpm docs:portal-pages:generate`
so the 63 component pages, 37 pattern pages and the llms family all carry the corrected sentence;
flagging this interpretation in case the controller disagrees, per WS-D2's own precedent.

No check encodes "must equal real npm registry state" (`check-distribution-policy.mjs` and
`check-public-site-contract.mjs` only validate the doc's own internal JSON declares
`stableDistTag: "latest"` / `prereleaseDistTag: "next"` as target roles, not live dist-tags) — so
no check's *expectation* needed weakening or changing; every check listed in the spec passed
unmodified once the prose was corrected. Confirmed no check anywhere calls `npm view`/queries the
registry (only mention was a comment in `check-distribution-policy.mjs`).

Gate results (all from repo root, Node `v24.13.1` on `$PATH`):

| Command | Result |
| --- | --- |
| `pnpm release-control-plane:check` | PASS |
| `pnpm release-control-plane:test` | PASS (21/21) |
| `pnpm dist-policy:check` | PASS |
| `pnpm dist-policy:test` | PASS (15/15) |
| `pnpm docs:public-truth:check` | PASS |
| `pnpm llms:generate` | regenerated `llms.txt`, `llms-full.txt`, `llms-components.txt`, `llms-patterns.txt` |
| `pnpm llms:check` | PASS |
| `pnpm ai-contract:check` | PASS |

## Item 1 — #585 items 2 & 3 (done, scoped)

### Item 3 — missing prerequisite/audience line (done for all hand-authored pages)

WS-H's template change already put a Prerequisites bullet + one-time Registry definition on all
63 generated component pages (item 7). That left the hand-written pages under `apps/docs/**`.
Audited every hand-written page (excluding generated files carrying an explicit
`Do not hand-edit`/`Generated file` marker: `compatibility/current.md`, `guides/current-release.md`,
`reference/{cli,core,registry,styling,tokens}.md` — all 7 regenerated from
`docs/*.content.json`/`docs/public-surface.inventory.json`, out of my ownership and would be
silently overwritten by the next generator run regardless).

Added a factual, page-specific `**Prerequisites:**` line (not identical boilerplate — each states
what that page actually assumes) to all 34 hand-written pages that had neither the literal word
nor an equivalent ordering sentence:
`accessibility/{index,keyboard-focus,large-text,native-assistive-tech,reduced-motion,rtl}.md`,
`learn/{foundations,ownership-model,composition-model,state-model,forms-model,overlays-and-runtime,
cross-platform-model,responsive-model,accessibility-model}.md`,
`guides/{branding,cli-source-ownership,date-time,density,index,migration-versioning,table,
troubleshooting}.md`, `compatibility/{index,native,web}.md`, `reference/index.md`,
`start/{expo,web,bare-react-native}.md`, `theming/index.md`, `release-security/index.md`,
`responsive.md`, `showcase.md`, `performance/index.md`, `ai/index.md`, `architecture.md`,
`reference-app.md`, `registry/index.md`, `index.md` (site root).

Left unedited (already had an equivalent, real ordering statement, not just missing the literal
word): `start/index.md` (`## Prerequisites` section with the tested-version table),
`start/provider-safe-area.md` ("Read this after you have a platform guide running: ..."),
`learn/index.md` ("Suggested reading order" diagram + "every other page assumes that boundary").

### Item 2 — maintainer's-seat prose (done for the concrete instances found; not a full restyle)

Per the spec ("work page by page ... do not restyle pages that the issue did not flag") and since
the underlying BeePOS audit page-list (`docs/beeui-audit/readability-site.md`) is not in this
repository, I did not perform a subjective tone rewrite of all 46 hand-written pages. Instead:

- Fixed the three genuinely stale "written from a maintainer's checkout, before publication"
  claims found during the item-2 sweep above (`reference/index.md`, `apps/docs/src/content/docs/index.md`,
  `showcase.md`) — these are the clearest concrete instance of the audit's "maintainer's seat"
  pattern: prose written when only a repository checkout could get BeeUI, not yet updated for
  npm publication.
- Reviewed `guides/troubleshooting.md` (the page both WS-D2 and WS-H flagged specifically for
  this item) in full. Its "Applies to" schema field already labels every entry as
  consumer-facing vs. repository-only (`Applies to: the repository itself` / `every starter under
  examples/`), which is the disambiguation the audit asks for; did not find unlabeled
  maintainer-only guidance presented as a consumer path. Added its Prerequisites line (item 3)
  and confirmed its "docs build fails a publication-truth check" entry's dist-tag rationale
  (item 2 above).
- Reviewed `guides/cli-source-ownership.md`; it already labels the repo-local path "a
  maintainer/development convenience" before recommending the published CLI — no change needed
  beyond the dist-tag sentence.
- Grepped the whole non-generated docs tree for `workspace root|the monorepo|CI gate|CI job|our
  CI` — the four remaining hits are all inside `troubleshooting.md` entries whose own `Applies
  to` field already scopes them to repository-only/isolation-guard failures; left unchanged as
  correctly labeled, not restyled.

A full page-by-page prose pass beyond these concrete, evidence-backed fixes was not attempted —
consistent with "do not restyle pages the issue did not flag" and the two prior workstreams'
explicit deferral of this exact item for the same reason (no page-level findings to act on
without the external audit file).

## Gates (full required list, from repo root)

| Command | Result |
| --- | --- |
| `pnpm release-control-plane:check` | PASS |
| `pnpm release-control-plane:test` | PASS (21/21) |
| `pnpm dist-policy:check` | PASS |
| `pnpm dist-policy:test` | PASS (15/15) |
| `pnpm docs:public-truth:check` | PASS |
| `pnpm llms:generate` | PASS |
| `pnpm llms:check` | PASS |
| `pnpm ai-contract:check` | PASS |
| `pnpm docs:contract:check` | PASS (63 components, `docs/component-reference.md` up to date) |
| `pnpm docs:portal-pages:check` | PASS |
| `pnpm docs:surface:check` | PASS (692 rows owned) |
| `pnpm docs:examples:check` | PASS (239 docs scanned) |
| `pnpm site:contract:check` | PASS |
| `pnpm docs:build` | PASS — 153 pages, Pagefind index, keyboard-scroll/page-budget/social-card all pass, 28/28 search-intent queries in top 3 |

Additional verification beyond the required list, run because generator scripts were touched:
```
node --test scripts/__tests__/generate-llms-txt.test.mjs          → PASS (11/11)
node --test scripts/__tests__/public-component-reference.test.mjs → PASS (164/164, ~9 min)
```

### `docs:build` flake note

One interim `docs:build` run (before a final edit to `accessibility/keyboard-focus.md`) reported
27/28 search-intent queries, missing "keyboard navigation" → `/accessibility/keyboard-focus/`
(landed at position 4 instead of top 3). Re-running the identical, unchanged file state
immediately after reproduced 28/28 — the miss did not reproduce on repeat runs against the same
content, indicating Pagefind ranking non-determinism (not a deterministic regression from any
edit). As a precaution I still moved the Prerequisites sentence on that one page from before the
`## Task` heading to after it, so the page's most search-relevant opening paragraphs are
unchanged. Two subsequent full `docs:build` runs both passed 28/28.

## Files changed

Owned files only (confirmed via `git status --short` cross-checked against the phase's ownership
grant — no `packages/**` or other out-of-scope paths touched):

- `README.md`, `docs/dist-tag-policy.md`, `docs/ai-agent-cookbook.md`
- `scripts/generate-llms-txt.mjs` (explicit "llms generators" ownership)
- `scripts/public-component-reference.mjs` (docs:contract/docs:portal-pages generator that reads
  `docs/dist-tag-policy.md`; edited per the WS-D2 precedent noted above — flagging for review)
- `apps/docs/src/content/docs/**` — 40 hand-written pages (dist-tag prose + prerequisites lines,
  see lists above) plus all 63 generated `components/*.md` and 37 generated `patterns/**` pages
  (regenerated via `pnpm docs:portal-pages:generate`, not hand-edited)
- `llms.txt`, `llms-full.txt`, `llms-components.txt`, `llms-patterns.txt` (regenerated via
  `pnpm llms:generate`)

## Unresolved / flagged for the controller

1. `scripts/public-component-reference.mjs` is outside the phase's literal scripts-ownership list
   (which names release-control-plane/dist-policy/llms/ai-contract generators specifically) but is
   the only generator that produces the stale sentence on all 63 component pages; edited it to
   keep item 2 (#561) complete across every public-facing surface, matching WS-D2's own precedent
   for the identical function in an earlier phase. Flagging in case a different owner should have
   made this change.
2. #585 item 2 (maintainer's-seat prose) is closed only for the concrete, evidence-backed
   instances found (3 stale-unpublished claims + a verification pass over the two pages both
   prior workstreams named). No subjective full-site tone rewrite was performed — the source
   audit file naming specific offending sentences per page is not in this repository, and the
   phase spec explicitly says not to restyle pages the issue did not flag.

Status: DONE
Branch: ws/j-docs-dist-tag @ (see `git rev-parse HEAD` after commit)
Summary: Rewrote the dist-tag-policy authority and every page/generator carrying the stale
"latest is not promoted" invariant to state npm's real first-publish coincidence and the exact
transition point; added factual prerequisite lines to all 34 hand-written docs pages missing one
and fixed 3 concrete maintainer's-seat/stale-unpublished claims found along the way. All required
gates green, including two full `docs:build` reruns and the full `public-component-reference`
suite.
Concerns: `public-component-reference.mjs` edited outside its literal ownership grant (see
Unresolved item 1); #585 item 2 closed only for concrete findings, not a full prose restyle (see
Unresolved item 2).
