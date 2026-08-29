# Web accessibility audit gate

BeeUI's automated Web accessibility gate runs [axe-core](https://github.com/dequelabs/axe-core) through [`@axe-core/playwright`](https://www.npmjs.com/package/@axe-core/playwright) against representative, real-browser states of the Showcase app. It lives in `apps/visual-regression` — the same package that already owns `@playwright/test` and browser provisioning for BeeUI's [visual regression](./visual-regression.md) layer — rather than as a second, parallel Playwright setup.

This gate is one part of BeeUI's layered accessibility verification. It **complements, and does not replace**:

- semantic/contract-level accessibility tests that assert roles, names, states, and keyboard behavior directly in component tests;
- native VoiceOver/TalkBack assistive-technology evidence (see `docs/native-verification.md`).

A green run here proves that axe-core's automatable WCAG 2.0/2.1 A + AA rule checks found no unallowlisted serious/critical violation in the scanned scenarios' rendered DOM. It does **not** prove full manual WCAG conformance, and it does **not** prove native (iOS/Android) accessibility behavior — see `docs/beeui-1.0-evidence-classes.md`'s "browser interaction evidence" and "assistive-technology evidence" classes for the exact distinction.

## What runs

`apps/visual-regression/tests/a11y.spec.ts` scans every scenario registered in `apps/visual-regression/src/a11y-scenarios.ts` against the real, exported Showcase app (the same `dist-gallery-qa` export and local server the existing Showcase integration QA uses). Today that is four representative scenarios:

| Scenario | Covers |
| --- | --- |
| `component-gallery` | Component Gallery — primitives, forms, status/feedback, overlay triggers |
| `component-gallery-dialog-overlay` | An open Dialog — modal overlay content |
| `pattern-gallery-dashboard` | Pattern Gallery — Dashboard Overview, a composed non-form screen |
| `pattern-gallery-sign-in-form` | Pattern Gallery — Sign In, a form-heavy screen |

Each scenario is scanned with axe-core tagged `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`.

## Blocking policy

A scenario's axe violations are evaluated by the pure, dependency-free gate in `apps/visual-regression/src/a11y-gate.ts`:

- any violation with impact `serious` or `critical` **blocks** CI unless a matching, valid allowlist entry exempts it;
- violations with impact `minor` or `moderate` are always reported but never block on their own.

This matches issue #145's DoD: "block at minimum new serious/critical violations."

## Allowlist mechanism

Confirmed, unavoidable platform/tool false positives are exempted narrowly in `apps/visual-regression/src/a11y-allowlist.json` — a JSON array of entries:

```json
{
  "id": "color-contrast",
  "selector": ".exact.css.target.axe.reported",
  "scenario": "component-gallery",
  "reason": "Non-placeholder explanation of why this is a confirmed axe/tool false positive, not a real accessibility defect."
}
```

- `id` and `selector` must match **exactly** what axe reported (`node.target.join(' ')`) — there is no wildcard/prefix matching, so an entry can only exempt the one node it names.
- `scenario` is optional; when present it further narrows the entry to one scenario. Omit it only when the same tool false positive is confirmed across every scenario that renders the target.
- `reason` is mandatory and must be a real explanation (enforced as a minimum length in `isAllowlistEntryValid`) — an empty or near-empty rationale is treated as an invalid entry and the violation reverts to blocking. There is no mechanism for a blanket/rule-wide or scenario-wide ignore.

Do not add an allowlist entry for a real accessibility defect. Fix the component or pattern instead. An allowlist entry is only for a *confirmed* false positive (verified by manual inspection against the actual rendered contrast/markup) that axe cannot correctly evaluate.

## Regression coverage

`apps/visual-regression/tests/a11y-gate.spec.ts` exercises the gate logic directly (no browser) and is load-bearing:

- a serious/critical violation with no allowlist entry blocks;
- a valid, matching allowlist entry with a real rationale exempts it;
- **emptying that entry's `reason`** reverts the outcome to blocking (proves the allowlist can't be silently defeated by blanking the rationale while keeping the entry present);
- **removing the allowlist entirely** ("reverting the gate") restores blocking for the same violation (proves the gate is not vacuously green);
- scenario- and rule-id-scoping are respected (an entry for the wrong scenario or the wrong rule does not exempt);
- minor/moderate impact never blocks regardless of allowlist state;
- partial exemption within one violation's multiple nodes is respected per-node.

## CI artifacts

Every run (pass or fail) writes to `apps/visual-regression/a11y-report/`:

- `<scenario-name>.json` — per-scenario blocking/allowlisted/non-blocking violation nodes, each with the axe rule id, impact, exact target, help text/URL, and (if exempted) the allowlist rationale;
- `summary.json` — aggregate pass/fail per scenario;
- `report.html` — a single self-contained HTML report for human review.

The `web-a11y` CI workflow (`.github/workflows/web-a11y.yml`) uploads `apps/visual-regression/a11y-report/` (plus Playwright's own `test-results`/`playwright-report`) as a build artifact on every run, not only on failure, so the actionable detail is always available for the exact head under review.

## Extension mechanism

Later component/demo issues (Tooltip, Sheet, Table, Calendar, new demo screens, ...) add coverage by appending an entry to the `a11yScenarios` array in `apps/visual-regression/src/a11y-scenarios.ts`:

```ts
{
  name: 'my-new-scenario',       // kebab-case; becomes the report filename and allowlist scenario key
  description: 'What this scenario represents and why it is representative.',
  navigate: async (page, baseUrl) => {
    // Drive the Showcase to the exact state to scan (open a section/dialog/tab, etc.).
  },
},
```

No other file needs to change — `tests/a11y.spec.ts` iterates the registry automatically, writing one report per scenario and evaluating each against the shared allowlist/blocking policy. This mirrors how `apps/visual-regression/src/visual-contract.ts` is the extension point for canonical pixel scenarios (see `docs/visual-regression.md`'s "Scenario authoring" section) — the accessibility gate has its own parallel, equally simple extension point rather than overloading the pixel-scenario contract.

### Overlay scenario readiness contract (#280)

A scenario's `navigate` must leave the page in its **settled** state — axe scans whatever
DOM exists the moment `navigate` resolves, and a scan taken mid-transition reports
transient states as violations that no settled DOM exhibits.

The concrete case that mandates this: react-native-web's Modal (0.21.x) mounts its owner
node with `aria-modal="true"` while `role` is still unset; the allowed `dialog` role is
applied only when the entrance completes. An axe scan inside that window reports a
critical `aria-allowed-attr` violation on a roleless `aria-modal` div — this was #280,
originally misread as a reusable-component ARIA defect. Waiting for inner dialog *content*
text is not sufficient: content can be visible before the owner's role lands, which is
exactly how local and CI runs produced diverging blocking-node counts (34 vs 33).

Any scenario that opens a Modal-backed overlay (Dialog, AlertDialog, future Sheet, ...)
must therefore await `awaitSettledModalOwners(page)` (exported from
`src/a11y-scenarios.ts`) after triggering the overlay and before returning: it polls until
at least the expected number of `[role="dialog"][aria-modal="true"]` owners exist AND no
`[aria-modal="true"]` node without an allowed dialog/alertdialog role remains connected.
This is state synchronization, not a fixed sleep — and the transient state must **not** be
"fixed" with an allowlist entry: the allowlist is for confirmed false positives in settled
DOM, while an unsettled scan is simply not a valid measurement yet.
`tests/a11y-readiness.spec.ts` pins this lifecycle (a MutationObserver installed before
the dialog opens proves any transient roleless `aria-modal` owner settles or disconnects)
and fails if the settled-state contract regresses.

## Local reproduction

```sh
pnpm install --frozen-lockfile
pnpm --dir apps/visual-regression exec playwright install chromium
pnpm --dir apps/visual-regression test:a11y
```

This builds the deterministic Web export used by `pnpm serve:web`, exports and serves the real Showcase, runs both the axe scenario scan and the gate regression suite, and writes `apps/visual-regression/a11y-report/`.

To iterate on one scenario only:

```sh
pnpm --dir apps/visual-regression build:web
pnpm --dir apps/visual-regression exec playwright test --project=a11y-audit -g "component-gallery"
```

## Known limitations

- Browser accessibility evidence does not prove native iOS/Android assistive-technology behavior (VoiceOver/TalkBack remain a separate, explicit evidence class — see `docs/native-verification.md`).
- Automated axe-core coverage does not certify full WCAG conformance; several WCAG success criteria require human judgment axe cannot automate (e.g. whether alternative text is meaningful, whether reading order is logical).
- This gate scans representative scenarios, not every component/pattern permutation; expand `a11yScenarios` as new surfaces are accepted into the Showcase, per the extension mechanism above.
