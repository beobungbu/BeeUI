# Independent re-review — PR #485 (WBS-D031 / #458)

Reviewer: code-reviewer (fresh, independent; did not write this code and did not perform the earlier reviews)
Head reviewed: `feat/docs-458-core-guides` @ `bb0a589` (confirmed via `gh pr view 485 --json headRefOid`)
Base: `origin/development` @ `aa9be37` (remote `development` has since advanced to `e4bcae8`; the diff was taken as `origin/development...bb0a589`)

**Working tree discipline.** I did not check out, modify, stage, or commit anything in
`/Users/textsoft/workspace/BeeUI/.claude/worktrees/issue-474-control-plane-gaps-b93e99`.
Every command that could write ran in a copy at `/private/tmp/pr485`
(rsync of the worktree files + a `git clone --shared` gitdir, then `git checkout -f feat/docs-458-core-guides`).
The two read-only exceptions in the real worktree were `cat .npmrc` and `pnpm beeui -- doctor`,
which exits at argument parsing before touching the filesystem.

**Note on the shared worktree.** At session start `git status` was clean on
`claude/issue-474-control-plane-gaps-b93e99`. At session end it is on
`feat/docs-462-learn-layer` with `apps/docs/astro.config.mjs` + `learn/index.md` modified and
nine untracked `learn/*.md` files. That is another session's in-flight work, not mine.

---

## Verdict

**HOLD / REQUEST CHANGES.**

The five blocking findings from the first review are substantively addressed — B1, B3, B4 and
B5 are genuinely fixed and I verified each against source or a runnable check rather than
against the author's description. B1 in particular is fixed for real: I reproduced the CI
condition (generated page families deleted) in a copy and `check-public-web.mjs` now exits 0,
and CI is green on `bb0a589` across all 18 checks. N8 is the strongest piece of work in the
remediation: I re-ran `pnpm bench:web` four times myself and the committed figures reproduce.

I am holding for two reasons, both **introduced by the remediation commits**, both in the
CLI/troubleshooting surface that B2 was about:

1. `guides/troubleshooting.md` now states, as reproduced evidence, an error message that the
   command does not print. The actual output is `unknown command '--'`. The PR comment says
   "Reproduced: both exit `1` with `BeeUI is not initialized in this project`" — I could not
   reproduce that on either tree, with either invocation form, on the pinned package manager.
2. Every `pnpm beeui -- <command>` in the two pages this PR creates — eleven of them — exits 1
   under the repo's pinned `pnpm@10.15.0`. B2 was "a Verify block that exits 1 when run as
   written". The Verify block was fixed; eleven sibling command blocks with the same defect
   were left, and the paragraph immediately above the largest one was rewritten in `d05aed5`
   to assert what those commands do. The two pages also now give opposite instructions about
   running `init` from the monorepo.

The `--` form is inherited from `development`, not invented here. But this PR is its largest
single propagation, the remediation specifically re-asserted it, and #458's premise is
"commands a reader can run".

Two first-review findings (N5, N13) are corrected only in a PR comment; the PR body still
carries both errors and is still headed "Verification (exact head `9ec743a`)".

---

## Per-finding verdicts

| # | Verdict | Evidence I personally observed |
| --- | --- | --- |
| **B1** — link check red on a cold checkout | **VERIFIED FIXED** | In `/private/tmp/pr485` @ `bb0a589` with `components/reference/`, `patterns/reference/`, `compatibility/current.md`, `guides/current-release.md` absent: `node ./scripts/check-public-web.mjs` → **exit 0**, "Public Web quality gate passed." `generatedDocsRoutes()` derives from `buildPublicComponentManifest`/`buildPublicPatternManifest`, and both resolve cold. CI on `bb0a589`: `verify-docs`, `build-and-local-smoke`, `verify`, all 18 checks SUCCESS. Fake component/pattern reference links are still caught (probed). |
| **B2** — Verify block exits 1 | **PARTIAL** | The three replacement commands do exit 0 from the repo root: `pnpm registry:verify` 0, `pnpm ui-exports:check` 0, `pnpm docs:contract:check` 0. But the "Still broken" paragraph that replaced them (`troubleshooting.md:498-502`) asserts a false error message (**NB1**), and three other Verify blocks on the same page still instruct `pnpm beeui -- diff` (`:357`), `pnpm beeui -- list` (`:376`), `pnpm beeui -- init` (`:392`), each exit 1 (**NB2**). |
| **B3** — density consumers omit `Table` | **VERIFIED FIXED** | `grep -rno 'density-row-height\|density-row-gap\|density-form-gap' packages/ui/src` → row metrics: `list-item.tsx`, `table.tsx`, `table.web.tsx`; form metric: `field.tsx`, `form-group.tsx`. Guide now says `ListItem, Table` and `ListItem, Table, FormGroup, Field`. Limitation reworded to per-subtree and is now accurate. Residual: see **NF4**. |
| **B4** — 190px arithmetic | **VERIFIED FIXED** | Guide now states 512 / 668 / 784px totals and "about 270px between `compact` and `spacious`". 784 − 512 = 272. Per-mode figures still check out against `densityMetrics`. |
| **B5** — `Calendar` null-clear | **VERIFIED FIXED** | `calendar.tsx:57` `onValueChange?: (date: CalendarDate) => void`, fired only at `:254`; `date-picker-shared.tsx:61` and `date-time-picker-shared.tsx:79` are `| null`. New wording matches all three exactly. |
| **N1** — checker cannot see the bug class it targets | **PARTIAL — fix is dot-only, comment claims more** | I built the site with probe filenames and compared `contentPathToRoute` to what Astro emitted under `apps/docs/dist/`: `a.dotted.name.md` → `adottedname` ✅ matches; `Upper_Case.md` → **`upper_case`** vs manifest `Upper_Case` ✗; `with space.md` → **`with-space`** vs manifest `with space` ✗; `Mixed Case.Dotted_thing.md` → **`mixed-casedotted_thing`** vs manifest `Mixed CaseDotted_thing` ✗; `unicodé.md` and `snake_case_name.md` unchanged ✅. So Astro also lowercases and dash-joins whitespace, and the fix mirrors neither. **No existing route is broken** — no content filename in the repo contains a dot, an uppercase letter or a space, and I proved manifest/site parity end-to-end: 141 `currentDocsRoutes` vs 141 built `index.html` pages, **0 manifest routes without a page, 0 pages absent from the manifest**. The code comment ("Mirror the serving behaviour here so the manifest and the live site agree") and the PR comment ("Slugification now happens in `contentPathToRoute` itself, so the route manifest and the live site agree") are broader than the code. Scope the comment to dots, or use the same slug function Astro does. |
| **N2** — link-checker bypasses | **PARTIAL — all five demonstrated bypasses closed; six new ones** | Re-probed each individually against `collectViolations` at `bb0a589`. Closed: `/docs/cli/does-not-exist/` → CAUGHT (resolves the 308 then re-tests); `/docs/theming/branding/no/such/page/` → CAUGHT; `[a](/docs/totally-invented/ "Title")` → CAUGHT; `/docs/probezone/probe.dotted/` → CAUGHT while the real `/probedotted/` is accepted; `/docs/start/?tab=expo` → accepted, no false positive. The author's table is accurate. New bypasses (all ACCEPTED, all invented routes): single-quoted title `[a](/docs/x/ 'T')`, paren title `[a](/docs/x/ (T))`, angle destination `[a](</docs/x/>)`, reference definition `[a]: /docs/x/`, raw HTML `<a href="/docs/x/">`, and trailing space `[a](/docs/x/ )`. None of these shapes occur in the repo today (grepped). Same class as the closed one; worth one regex pass, not a blocker. |
| **N3** — hardcoded generated paths | **VERIFIED FIXED** | `GENERATED_COMPATIBILITY_PAGE` / `GENERATED_RELEASE_PAGE` exported from `public-guide-data.mjs`, imported by `internal-links.mjs`, and used by the generator itself for its own writes. (The `components/reference/` and `patterns/reference/` prefixes remain literals, but those are directory mounts, not generator outputs.) |
| **N4** — `migrationHref` pinned to a moved route | **VERIFIED FIXED** | `web/public-site.config.json:107` → `/docs/guides/migration-versioning/`; regenerated `apps/docs/public/release-state.json` carries the same string. |
| **N5** — "strict improvement" claim | **NOT FIXED in the artifact that matters** | Corrected in a PR comment; PR body line 39 still says "strict improvement … instead of a generic perf test". The `component-reference.md` diff still shows the calendar family losing `perf-render-commit.test.tsx` by `limit = 3` displacement, exactly as the first review found. |
| **N6** — `[^}]` narrows one input | **VERIFIED — both claims true, limitation stated accurately** | `import { Button, /* } */ Text } from '@beemvp/beeui-ui'` → `["Button","Text"]` (fixed, and a real assertion covers it in `doc-examples.test.mjs`). Line comment with a brace → `[]` (still broken, as the comment says). The stated reason holds: naive `//` stripping would eat URLs. One thing the comment does not say: a *plain* line comment inside an import list already produced a bogus symbol before this change — `import {\n Button, // pick one\n Text,\n}` → `["Button","// pick one\n  Text"]`. Pre-existing, and it fails loudly rather than silently. |
| **N7** — `.generated` marker dropped | **PARTIAL, mitigated by design** | Both generated pages now carry a `:::caution[Generated file]` banner. The banner cannot warn the person the marker protected — someone hand-creating `guides/current-release.md` in a directory of hand-authored guides still gets silently gitignored. Acceptable; recorded. |
| **N8** — contradictory benchmark numbers | **VERIFIED FIXED — I re-measured** | Four `pnpm bench:web` runs on this host (Apple M1 × 8, Node 24.13.1, `bb0a589`). Run 1 (machine busy right after a docs build): 0.0734 / **0.4888**, cv 5.6% / **23.2%**. Runs 2–4 (quiet): **0.0726 / 0.3586**, **0.0724 / 0.3589**, **0.0721 / 0.3586**, cv 1.6–1.9%. The committed ~0.073 ms / ~0.36 ms reproduce; the old ~0.10 / ~0.44 do not. Repo-wide the only remaining figures are the two Table pages and `docs/performance-baseline-report.md:106-107`, all four now consistent. The new prose is also more honest than what it replaced: I verified "the `cn()`-based per-row/per-cell Web hot path, not an end-to-end render" and "`maxOverheadRatio: 15`" against `scripts/benchmark/scenarios/web/table-render.mjs`. Caveat: the committed cv figures (4.3% / 7.2%) describe a quiet host; the 500-row scenario reached cv 23% under load here, so the argument "cv proves the gap was not noise" is weaker than stated, even though the conclusion is right. |
| **N9** — `/docs/theming/` dead end | **VERIFIED FIXED** | Theming index now links `/docs/guides/branding/` and `/docs/guides/density/`; both resolve (`check-public-web` cold, exit 0). |
| **N10** — CLI guide implies project targeting | **PARTIAL** | The false capability claim is gone. Its replacement asserts these commands "act on **this checkout**, which is what you want" directly above a block where all seven exit 1 (**NB2**), and it tells the reader to run `init` in the monorepo, which the same PR's troubleshooting page calls out as producing "a stray `beeui.config.json` in the monorepo". |
| **N11** — `motionDuration` vs `motion` | **VERIFIED FIXED** | Table now reads "`motionDuration` (category key `motion`)"; `themeOverrideCategories` is `colors`/`radius`/`motion` (`packages/tokens/src/index.ts:899,951`). |
| **N12** — DOM-only `useBeeToken` example | **VERIFIED FIXED** | Comment marks it web-only and states `react-native-svg` is not a peer. Accurate. |
| **N13** — "25 entries" | **NOT FIXED in the artifact that matters** | `grep -c '^### '` on `troubleshooting.md` → **26**. PR body line 23 still says 25. Acknowledged in a comment only. |

---

## New findings

### NB1 (blocking) — the remediation quotes an error the command does not produce

`apps/docs/src/content/docs/guides/troubleshooting.md:498-502` (added in `d05aed5`):

> **Still broken:** `pnpm beeui -- doctor` and `pnpm beeui -- diff` are consumer-project
> commands, not repository ones — from a BeeUI checkout they exit `1` with `BeeUI is not
> initialized in this project` …

Observed, repo root, Node 24.13.1, `pnpm@10.15.0` (the pinned `packageManager`), in **both**
`/private/tmp/pr485` @ `bb0a589` **and** the real worktree:

```
$ pnpm beeui -- doctor
> beeui-workspace@20260902.0.0 beeui
> node ./scripts/beeui.mjs -- doctor
BeeUI CLI error: unknown command '--'. Run 'beeui help' for usage.
```

Same for `pnpm run beeui -- doctor`. pnpm 10 forwards `--` into `argv`; `main()` reads
`argv[0]` as the command and rejects it before any config is read. The quoted string never
appears. The PR comment states this was "Reproduced" — the first review's own verification
table shows it ran `node ./scripts/beeui.mjs doctor` (no pnpm, no `--`), which is where that
message comes from. The remediation carried the message over to a different command.

This lands on the one page in the repo whose stated schema is that error strings are quoted
verbatim from where they are thrown. Fix: quote what it actually prints, or drop the quoted
string and keep the scoping advice.

### NB2 (blocking) — eleven `pnpm beeui -- <command>` blocks in this PR's new pages exit 1

`guides/cli-source-ownership.md:22-29` (seven commands, the page's entire "Do it" block) and
`guides/troubleshooting.md:357,358,376,392` (four more). All fail identically with
`unknown command '--'`. The working form is `pnpm beeui <command>` — verified:
`pnpm beeui list` prints the registry and exits 0.

Three things make this this PR's problem rather than purely inherited:

- `guides/cli-source-ownership.md` is created by this PR (the deleted `cli/index.md` was 62
  lines; the new page is 193), and `guides/troubleshooting.md` is new.
- `d05aed5` rewrote the paragraph immediately above the seven-command block to explain what
  those commands do to your checkout. They do nothing; they error at argument parsing.
- The two new pages now contradict each other on the same action: the CLI guide says running
  `init` here "is what you want"; troubleshooting says doing so "would write a stray
  `beeui.config.json` into the monorepo".

Inherited scope, for the record: `start/index.md:103-106` and all 40 generated
`components/reference/*.md` pages carry the same form on `development`, and
`scripts/beeui.mjs:2` documents `pnpm beeui -- <command>` as the entry-point contract. This
looks like a pnpm-upgrade regression that no check caught.

**Careful with the fix.** `scripts/check-doc-examples.mjs:96` and
`scripts/check-ai-agent-contract.mjs:101` both regex-match the literal string
`pnpm beeui -- add` / `pnpm beeui -- `. Rewriting the docs to the working form without
updating those two regexes silently disables the validation that every `add` target names a
real public registry item — the checks would keep passing while checking nothing. Minimum
scope for this PR: fix the two pages it owns *and* the two regexes (make `--` optional), and
file the repo-wide sweep (`start/index.md`, the reference generator template,
`scripts/beeui.mjs`'s own comment) separately.

### NF3 (non-blocking) — six more link-checker bypasses

Listed under N2 above. Cheap partial close: allow an optional title in `'…'` / `(…)` and
optional surrounding whitespace in `LINK_RE`; reference-style definitions and raw HTML are a
larger change and arguably out of scope — say so in the comment rather than leaving it
implied that in-site links are covered.

### NF4 (non-blocking) — the guide now contradicts the authority it cites

`docs/density.md:61-63` still says `rowHeight`/`rowGap` "are consumed by `ListItem`", and
`:176` still lists `ListItem`/`FormGroup`/`Field` consumption. The new guide (correctly) says
`ListItem, Table`, and links `docs/density.md` as a deeper authority. The first review flagged
fixing both as "the durable version"; only the guide was fixed. Two lines in the canonical doc.

### NF5 (non-blocking) — the tracked agent-memory file committed in `5d797ff` carries two now-false claims

`.claude/agent-memory/code-reviewer/project_474_docs_portal_wave.md`:

- "`contentPathToRoute` … does no slugification, so the route manifest lies about any dotted
  filename" — fixed by `2101ae8`, in the same PR. A future reviewer reads this as current.
- "`node_modules` paths are blocked by the scout hook, so shadow builds that need a real
  `astro build` are not possible. Verify Astro behavior against the live dev origin or the
  committed `apps/docs/dist/` instead." — not true. I ran `pnpm docs:build` twice in a
  `/private/tmp` copy (142 pages, exit 0) and used the real emitted directory names to settle
  the slug question definitively, which the live origin could not have answered for
  hypothetical filenames. This bullet would steer the next reviewer away from the check that
  actually decides N1.

### NF6 (non-blocking) — the PR body is stale and still carries both corrected claims

Body still reads "Verification (exact head `9ec743a`)" while the head is `bb0a589`; still says
"25 entries" (26); still says "strict improvement" (retracted in a comment); still has no CI
column, which was the first review's explicit process ask after a green local table sat on top
of a red CI run. Comments carry the corrections, but the body is what a merger reads first.

### NF7 (informational) — the two Table pages agree on numbers, not on framing

`guides/table.md` now says the figures are "the `cn()`-based per-row/per-cell Web hot path,
not an end-to-end render". `components/table.md:32-34` still says "Both stay comfortably
inside a 16ms frame budget, so the default (non-virtualized) render meets the accepted
100/500-row envelope" with no such caveat. The author's claim ("Both Table pages now carry
consistent numbers") is true as stated; the stronger reading is not.

### NF8 (informational) — generated-banner placement is inconsistent

`compatibility/current.md` puts the "Generated file" caution above the intro;
`guides/current-release.md` puts it below the data table, i.e. after the content a hand-editor
would edit. Same generator, two placements.

### NF9 (informational) — the new guide increases exposure of the escalated release-state contradiction

`guides/migration-versioning.md:13-16` funnels readers to `/docs/guides/current-release/` as
"the only place that states the live version and channel". That page currently renders
`Workspace/package version 20260902.0.0` two rows above `Stable target 1.0.0`. The author
escalated this correctly rather than patching it (owner decision #407 / #254), and it is
pre-existing — but the PR makes the page more prominent while it self-contradicts.

---

## Verification table — which tree each result came from

`T1` = `/private/tmp/pr485`, a copy of `feat/docs-458-core-guides` @ `bb0a589`.
`T2` = the shared worktree (read-only commands only).
Node 24.13.1, pnpm 10.15.0, `LANG`/`LC_ALL=en_US.UTF-8` throughout.

| Check | Tree | Result |
| --- | --- | --- |
| `node ./scripts/check-repo-hygiene.mjs` | T1 | exit 0 |
| `node ./scripts/check-public-doc-truth.mjs` | T1 | exit 0 |
| `node ./scripts/check-public-site-contract.mjs` | T1 | exit 0 |
| `node ./scripts/generate-docs-foundation.mjs --check` | T1 | exit 0 |
| `node ./scripts/check-public-surface-ownership.mjs` | T1 | exit 0 |
| `node ./scripts/check-public-web.mjs` — **cold** (4 generated families deleted) | T1 | **exit 0** — B1 fixed |
| `node ./scripts/check-public-web.mjs` — warm | T1 | exit 0 |
| `node ./scripts/check-doc-examples.mjs` | T1 | exit 0 |
| `node ./scripts/generate-llms-txt.mjs --check` | T1 | exit 0 |
| `node ./scripts/generate-component-reference.mjs --check` | T1 | exit 0 |
| `pnpm typecheck` (full chain) | T1 | exit 0 |
| `pnpm docs:build` | T1 | exit 0 — **142 pages** (148 with 6 probe pages) |
| `pnpm docs:foundation:test` | T1 | exit 0 — 17/17 |
| `pnpm docs:examples:test` · `web:test` · `site:contract:test` · `docs:contract:test` · `llms:test` | T1 | exit 0 each |
| `pnpm test` (full chain) | T1 | **inconclusive** — fails at `@beemvp/beeui-showcase` jest with `Cannot read properties of null (reading 'useEffect')` in `selection-control-aria.test.tsx`, a file this PR does not touch. This is broken React resolution in my rsynced copy, not a PR defect; CI `verify` is SUCCESS on `bb0a589`. |
| `pnpm bench:web` × 4 | T1 | 0.0734/0.4888 (loaded), then 0.0726/0.3586, 0.0724/0.3589, 0.0721/0.3586 — N8 confirmed |
| Route manifest vs built site (141 routes vs `dist/**/index.html`) | T1 | 0 orphan routes, 0 unlisted pages |
| Astro slug probe (6 filenames, real `astro build`) | T1 | dots ✅, uppercase ✗, spaces ✗ — N1 partial |
| Link-checker probes (18 shapes) | T1 | 5 previously-demonstrated bypasses closed; 6 new ones found |
| `extractBeeuiImports` probes (11 inputs) | T1 | block comment fixed; line comment still breaks, as documented |
| `pnpm registry:verify` · `pnpm ui-exports:check` · `pnpm docs:contract:check` | T1 | exit 0 each — B2's Verify block is runnable |
| `pnpm beeui -- doctor` / `-- diff` / `-- init` / `-- list` | T1 | **exit 1**, `unknown command '--'` — NB1/NB2 |
| `pnpm beeui list` (no `--`) | T1 | exit 0, prints the registry |
| `pnpm beeui -- doctor`, `pnpm run beeui -- doctor` | T2 | **exit 1**, `unknown command '--'` — same on the real worktree |
| `gh pr checks 485` @ `bb0a589` | — | 18 checks: 15 SUCCESS, 3 SKIPPED, 0 failure |

---

## Recommended actions

1. **NB1** — replace the quoted error string in `troubleshooting.md:498-502` with what the
   command actually prints, or drop the quote.
2. **NB2** — drop `--` from the eleven command blocks in `guides/cli-source-ownership.md` and
   `guides/troubleshooting.md`; in the same commit make `--` optional in
   `check-doc-examples.mjs:96` and `check-ai-agent-contract.mjs:101` so the validation keeps
   biting. Resolve the `init`-in-the-monorepo contradiction between the two pages. File the
   repo-wide sweep (`start/index.md`, reference generator, `scripts/beeui.mjs`'s comment)
   separately — it is not this PR's to carry.
3. **N1** — scope the `contentPathToRoute` comment and the PR comment to dots, or slugify the
   way Astro does (lowercase, whitespace → `-`). No route is broken today either way.
4. **NF6** — refresh the PR body: head sha, 26 entries, retract "strict improvement", add the
   CI column and state that the local table was produced on a warm tree.
5. **NF4** — add `Table` to `docs/density.md:61-63` and `:176`.
6. **NF5** — correct the two stale bullets in the committed agent-memory file.
7. Optional, cheap: **NF3** regex pass; **NF8** banner placement.
8. Defer with an owner decision: **NF9** / the `1.0.0` vs `20260902.0.0` release-state
   contradiction, already escalated by the author against #407 / #254.

---

## Unresolved questions

1. Is `pnpm beeui -- <command>` supposed to work? If the entry point is meant to tolerate the
   separator, the two-line fix is in `scripts/beeui.mjs` (filter a leading `--`) and the docs
   need no change at all. That is an owner call, not a reviewer call, and it decides whether
   NB2 is a docs fix or a CLI fix.
2. Redirect behavior for the five moved guide routes is still proven only by the manifest
   contract and unit tests — no deployed Worker carries them. The previous lane (#457/PR #483)
   was held to a live-Wrangler standard for the same class of change; this one has not been.
   Unchanged from the first review, recorded so it does not get lost.
