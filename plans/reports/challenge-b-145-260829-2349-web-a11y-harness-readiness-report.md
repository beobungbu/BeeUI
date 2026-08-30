# Challenge B — #145/#280 Web a11y harness readiness

Branch: `claude/fable5-web-a11y-145` (worktree, base main `e19c66b`). No merge; benchmark output.

## What was done

1. **Reconstructed PR #273 on the new baseline**: both commits cherry-picked
   cleanly (no conflicts — its files did not drift between `37a27f2` and
   `e19c66b`). Harness intact: axe+Playwright, JSON/HTML reports, empty
   false-positive-only allowlist, gate regression suite, `web-a11y` workflow.
2. **Fixed the #280 readiness race** (the actual root cause per Round 3):
   `component-gallery-dialog-overlay` waited only for inner text
   (`Project settings`), which can be visible while RNW Modal's owner node
   still carries `aria-modal="true"` with no `role` — axe scanning inside
   that window reports a transient critical `aria-allowed-attr` (the 34-vs-33
   local/CI divergence). New exported `awaitSettledModalOwners(page)` in
   `src/a11y-scenarios.ts` polls (`waitForFunction`, no fixed sleep) until
   ≥1 settled `[role="dialog"][aria-modal="true"]` owner exists AND zero
   roleless `aria-modal` nodes remain; the scenario synchronizes on it before
   the content-text confirmation. No allowlist entry (transient ≠ false
   positive; it's a not-yet-scannable state).
3. **Load-bearing regression** `tests/a11y-readiness.spec.ts` (a11y-audit
   project) now has two complementary layers. The real Showcase/RNW test
   installs a MutationObserver before opening Dialog, unconditionally asserts
   the settled contract, and records whether that timing-dependent run
   observed RNW's transient roleless owner. A second deterministic lifecycle
   test starts from the exact intermediate DOM shape
   (`aria-modal="true"`, no role), mutates it to `role="dialog"` on the next
   animation frame, and proves `awaitSettledModalOwners()` only completes at
   the valid settled state. This makes the readiness regression deterministic
   without falsely claiming every browser run must observe RNW's short
   transient window. Local real-RNW runs did observe
   `rnw-modal-transient-observed=true`.
4. Docs: "Overlay scenario readiness contract (#280)" section added to
   `docs/web-accessibility-audit.md` (extension rule: Modal-backed scenarios
   must await settled owners; allowlist explicitly wrong tool for this).

## Results

- Original verification before the independent-review follow-up:
  `pnpm test:a11y`: **16/16 green** — 4 axe scenarios + readiness spec +
  11 gate-policy regressions.
- **All four scenarios reported 0 blocking / 0 allowlisted / 0 non-blocking
  nodes** (empty allowlist). On #273's old base the gallery scenarios had 33
  blocking nodes; the sibling remediations merged into main (#276/#277/#278/
  #279) plus the readiness fix account for the delta. Gate non-vacuousness is
  proven by the gate regression suite (injected violations block).
- Original determinism check: `--repeat-each=3` on the audit project — 15/15
  green, stable counts (the 34-vs-33 class of divergence is gone).
- Original `pnpm typecheck` green. Default visual-web routing unaffected (203
  tests, no a11y leak; readiness spec runs only under `BEEUI_A11Y_AUDIT=1`).
- Independent-review follow-up added the deterministic second readiness test;
  exact-head CI/reverification is required on the new branch tip before
  integration.

## Disposition recommendations (maintainer's call)

- #145/PR #273: this branch is the refreshed close-ready shape — harness
  green on representative surfaces with empty allowlist + readiness contract
  documented and regression-pinned.
- #280: reclassify/close as harness readiness race per Round 3; no product
  change needed (this branch contains the fix + deterministic readiness
  regression). The `1.0:blocker` label belongs to #145's completion, not a
  component defect.

## Open questions

- The `web-a11y.yml` workflow was cherry-picked as-is; it targets the
  self-hosted runner set used by visual-web. Exact-head CI on the final branch
  tip remains the maintainer's integration gate.
