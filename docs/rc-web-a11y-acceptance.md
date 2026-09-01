# RC Web accessibility acceptance (#250, R11.8)

> **Status:** Release-candidate acceptance evidence for the **automated Web accessibility
> gate**. This document records exactly what the axe-core + Playwright gate proved against the
> current head, and — per [docs/beeui-1.0-evidence-classes.md](beeui-1.0-evidence-classes.md)'s
> rule (*state the strongest evidence class actually obtained, never the strongest desired*) —
> what it does **not** prove.
> **Snapshot:** 2026-09-02.
> **Audited head:** `7f9decb95fc2336340819626e507420f6e63a1fc` (`main`).

## Candidate scope caveat (read first)

The immutable `1.0.0-rc-ready.1` candidate ([#246](https://github.com/beobungbu/BeeUI/issues/246))
is **not yet frozen** (open at this snapshot). This run is therefore tied to the current `main`
head above, not to a frozen candidate manifest. Per the issue DoD ("Any code change requires a
new candidate/re-run"), **the Web a11y gate must be re-run against the exact frozen `1.0.0-rc-ready.N`
head** and this evidence re-stamped before the candidate's acceptance is final. No component,
token, or gate source was changed by this acceptance work (docs-only).

## What was run

| Field | Value |
| --- | --- |
| Command | `pnpm --dir apps/visual-regression test:a11y` |
| Build step | `expo export --platform web` (real Metro Web bundle, 668 modules) then Playwright |
| Tool | `axe-core` **4.13.0** via `@axe-core/playwright` **4.13.0** |
| Runner | Playwright **1.62.1**, pinned Chromium |
| Ruleset | axe tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` |
| Gate policy | serious/critical impact blocks unless a narrow, rationale-carrying `src/a11y-allowlist.json` entry scoped to that rule+scenario exempts it; minor/moderate reported, never blocking (#145) |
| Node / pnpm | Node 24.13.1, pnpm 10.15.0 |
| Result | **23 passed, 0 failed** (10 axe scenario scans + 13 gate-policy regression tests) |

## Result

**Zero serious/critical axe violations across the entire scanned component + pattern surface;
the allowlist is empty (`[]`), so nothing was exempted.** `overallBlocking: false`. Machine
summary: `apps/visual-regression/a11y-report/summary.json`; HTML detail:
`apps/visual-regression/a11y-report/report.html` (uploaded by the `web-a11y` CI workflow on
every run, retained 14 days).

Per-scenario (all `blockingCount: 0`, `allowlistedCount: 0`, `nonBlockingCount: 0`):

| Scenario | Surface it covers |
| --- | --- |
| `component-gallery` | Full component gallery (default states of every exported component) |
| `component-gallery-dialog-overlay` | Open Dialog — modal overlay, focus isolation |
| `component-gallery-sheet-overlay` | Open Sheet — overlay focus isolation |
| `component-gallery-tooltip-overlay` | Tooltip overlay in gallery context |
| `component-gallery-table` | Table (semantic roles/headers) |
| `component-gallery-date-picker-popover` | Calendar/date control in an open Popover |
| `component-gallery-date-time-picker-popover` | Date-time control in an open Popover |
| `pattern-gallery-dashboard` | Representative composed dashboard pattern |
| `pattern-gallery-sign-in-form` | Representative form-heavy screen |
| `tooltip-open` | Standalone tooltip trigger/label relationship |

Overlay scenarios use `awaitSettledModalOwners` so axe scans only after the modal owner settles
into `role="dialog"` + `aria-modal` — the transient roleless state is a race, not an exemptable
false positive, so it is waited out rather than allowlisted.

## Evidence class

**Browser interaction evidence** (real Chromium execution + automated accessibility checks),
per [docs/beeui-1.0-evidence-classes.md](beeui-1.0-evidence-classes.md). By that document's own
definition this class **does not prove native runtime behavior**.

## Documented exceptions

**None.** `src/a11y-allowlist.json` is empty; no serious/critical finding was allowlisted or
otherwise waived.

## What this run does NOT establish (still required by #250 DoD)

The #250 acceptance surface is broader than the automated Web gate. This browser-interaction run
does **not** by itself satisfy, and must not be represented as satisfying:

- real keyboard-only critical flows on device/simulator;
- visible focus / high-contrast / 200% zoom / large-text / reduced-motion **rendered** behavior
  (visual evidence, not axe rule output);
- RTL rendered behavior;
- VoiceOver / TalkBack assistive-technology evidence (a limited automated check is **not**
  accessibility certification, per the evidence-classes doc);
- native Sheet / `pageSheet` focus isolation on iOS/Android (see the EXPERIMENTAL status and #62
  quarantine in [docs/release.md](release.md)).

These belong to the runtime/device and assistive-technology gates in
[docs/release.md](release.md) and must be recorded separately with their own evidence classes.
No P0 keyboard/semantic blocker is known from the automated surface; that is the scope of the
"no serious/critical automated violation" half of the #250 DoD, which this run meets.

## Reproduce

```sh
nvm use 24.13.1
pnpm install --frozen-lockfile
pnpm --dir apps/visual-regression test:a11y
```

## Cross-references

- Gate implementation / blocking policy: `apps/visual-regression/tests/a11y.spec.ts`,
  `src/a11y-gate.ts`, `src/a11y-allowlist.json` (#145).
- CI workflow: [.github/workflows/web-a11y.yml](../.github/workflows/web-a11y.yml)
  (`web-a11y` required status check, [docs/release-ruleset.md](release-ruleset.md)).
- Evidence classes: [docs/beeui-1.0-evidence-classes.md](beeui-1.0-evidence-classes.md).
- Runtime/device & AT gates: [docs/release.md](release.md).
</content>
</invoke>
