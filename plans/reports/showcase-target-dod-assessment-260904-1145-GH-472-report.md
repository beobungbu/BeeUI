# DoD assessment — PR #477 vs issue #472 acceptance criteria

Head reviewed: `b251491` (branch `feat/docs-472-showcase-targets`, target `development`).
CI at that head: 22 pass / 6 skipping / 0 fail, PR `CLEAN / MERGEABLE`.

Verdict: **not yet DoD-complete.** 10 of 14 acceptance criteria met; 4 are partial.
Nothing found is a correctness regression — the shipped behavior is sound. The gaps are
missing scope against #472's own checklist.

## Met (10/14)

| # | Criterion | Evidence |
|---|---|---|
| 1 | One typed canonical Example Registry | `apps/showcase/example-registry.ts`, 134 component rows + 37 pattern + 2 fixture |
| 2 | Every stable public component has a basic example | `check-example-registry.mjs` enforces 62/62 against `getPublicComponents` |
| 4 | Pattern/state stable targets | `patternExamples.stateIds`; `resolveShowcaseTarget` validates named states |
| 7 | Direct URL / refresh / Back / Forward / new tab | `addressability-showcase.spec.ts`, 8/8 green on `/showcase/` base path |
| 8 | Invalid/stale target explicit recovery | `TargetRecovery` + spec "shows explicit recovery…"; never falls back to Home |
| 11 | IDs independent of ordering and labels | canonical slugs; `showcase-target.test.ts` uniqueness assertion |
| 12 | No application router introduced | web = History API only; `showcase-location.native.ts` is a no-op |
| 13 | Existing Showcase tests green | 900/900 jest, 147 showcase-integration, typecheck clean |
| 14 | Exact-head E2E through production-like base path | visual-web (1)(2)(3) all pass at `b251491` |
| §12 | E2E acceptance matrix minimums | primitive/form/selection/overlay/table/date-time + 1 pattern per domain + non-default state |

## Partial (4/14)

### G1 — coverage classes collapse to one destination (criterion 3) — most material

`applicableCoverageForComponent()` fans each component out into up to 6 rows, but
`EXAMPLE_FOCUS` only distinguishes `select`, `sheet`, `tooltip`. Measured across the
registry:

- 24 components carry more than one coverage class;
- **1** (`select`) resolves to a distinct fixture+focus per class;
- 21 collapse to a **single** destination for every class.

So `?example=states` and `?example=composition` on `dialog`, `field`, `tabs`, `popover`,
`table`, `checkbox`, `radio`, `switch`, `pagination`, `input`, `otp-input`,
`password-input`, `calendar`, `date-picker`, `date-time-picker`, `toast`,
`alert-dialog`, `dropdown-menu`, `badge`, `button`, `spinner` open the identical screen
with an identical highlight — only the inspector label differs.

#472 §2 names this exact failure: *"a complex component cannot satisfy coverage with one
trivial default sample."* The applicability table is mechanically reviewable; the
examples behind it are not yet real. `showcase-target.test.ts` cannot catch this because
it asserts `coverageClasses === [exampleId]`, which the generator sets by construction.

### G2 — docs never link anything but the default (criteria 5, 6)

All 62 generated component pages emit `example=basic`; 0 of 37 pattern pages emit a
`state=`. The runtime resolves non-default examples and states correctly, but no docs
surface reaches them — they are hand-typed-URL-only, or reachable via the in-Showcase
inspector buttons. Exact pattern **state** deep-linking from docs is unexercised.

### G3 — two URL builders; the docs-owned one is dead (criterion 9)

`apps/docs/src/lib/foundation-contract.ts:buildShowcaseHref` re-implements the
serializer and has **zero production consumers** (only `docs-foundation.test.mjs`). Every
real generator uses `showcaseHref` from `apps/showcase/showcase-target.ts`. #472 §10 asks
for one helper; today the two are kept in sync by `check-example-registry.mjs`
string-matching foundation-contract's source text, not by delegation.

Also: `showcase.md` and `patterns/index.md` hand-write `/showcase/?section=components|patterns`
— a param outside the `ShowcaseTarget` model, because the model has no way to express
"this surface, no specific item".

### G4 — no screenshot/evidence target linkage (criterion 10, §11, §13)

`screenshotTarget` / `ScreenshotTarget` appear nowhere in the repo. Visual-regression
screenshots still address the Showcase by navigation, not by target identity, so §13's
"CI must fail when a generated screenshot target points to a stale target" has nothing to
enforce. `prerequisites` from the §1 schema is also absent without a stated rationale.

## Recommendation

G1 is the one that changes what a reader gets and should land before #472 closes; G2 is
its natural companion (real examples are worth linking). G3 is a one-file cleanup — either
delete `buildShowcaseHref` or make it delegate. G4 is genuinely separable and could be
split into a follow-up issue if #472 is being closed on addressability alone.

## Unresolved questions

- Is G4 (screenshot/evidence target linkage) in scope for #472, or does it belong with the
  screenshot-generation issue? #472 lists it as acceptance criterion 10.
- For G1, should distinct examples be added to the existing gallery fixtures, or should
  `applicableCoverageForComponent` stop claiming classes that have no distinct example?
