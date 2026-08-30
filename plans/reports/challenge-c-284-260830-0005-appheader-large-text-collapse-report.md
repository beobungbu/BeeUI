# Challenge C — #284 AppHeader large-text collapse

Branch: `claude/fable5-appheader-284` (worktree, base main `e19c66b`). No merge; benchmark output.

## Independent reproduction on current main (before any fix)

New regression spec run against the unfixed baseline:

- **390px @ 1.3x: title width 16.4px** — the issue's exact collapse.
- **360px @ 1.0x: title width 67.6px** — NEW edge case #285 never covered:
  at the narrowest common Android width the title is already squeezed below
  readable width at the DEFAULT scale (PR #285 only tested 390px).

## Assessment of PR #285's fix on the new base

Still correct and still applies (its two files did not drift; GitHub now even
reports it mergeable again). The component change is sound:
`flex-wrap` on the row + title `min-w-0 → min-w-32 flex-1` + trailing
`ml-auto shrink-0` — degrade by adding wrap rows, never by crushing the title
column. Re-implemented cleanly here (one commit, with rationale comments)
rather than carrying #285's 4-commit churn (fix + spec + 2 test-routing
fixups).

What was improved over #285:

1. **Its regression spec was brittle**: it located the header via
   `parentElement/nextElementSibling` chains (self-admitted "update the seam"
   error) and reused the deep-gallery scroll as its only usability probe.
   Replaced with explicit testID seams (`component-gallery-header`,
   `component-gallery-theme-toggle`) added to the Showcase gallery.
2. **Wider matrix**: 390px AND 360px, each at 1/1.3/1.5/2x.
3. **Stronger assertions**: title width; usable content region below the
   header (header bottom < viewport-96); title/trailing never overlap on the
   same wrap row; trailing stays inside the viewport and visible; deep
   gallery control reachable (kept from #285).
4. **Deterministic jest guard** (`app-header-large-text.test.tsx`):
   revert-proof class-contract assertions (flex-wrap / min-w-32, no min-w-0 /
   ml-auto shrink-0) that fail fast without a browser.

## Verification

- Repro-first: spec red on unfixed baseline (2 failures above), green after
  the component fix — 2/2.
- `pnpm typecheck` green; `pnpm test` green (49 suites / 546 tests incl. the
  new guard); full showcase-integration Playwright 28 passed / 1
  skipped-by-design (gallery smoke matrix renders fine with wrap rows).
- Canonical pixel projects unaffected (no AppHeader in the canonical visual
  app; grep-verified).

## Notes / open questions

- 360px@1x wraps the gallery header to two rows at default scale — a real
  (correct) layout change on very narrow devices, previously a crushed title.
  Flagged in case the reviewer wants a design pass on wrapped order
  (leading → title → trailing top-to-bottom is the current wrap order).
- Cross-reference: Challenge A independently demonstrated #284's blast
  radius at 2.0x (Showcase home header consumed the whole viewport); this fix
  makes fixed headers wrap, and A's home-header-scrolls change is
  complementary, not conflicting (different layers: component row layout vs
  screen chrome placement).
