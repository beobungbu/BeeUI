# R1–R5 completion drive (max-parallel) — owner-authorized 2026-08-30

Goal: finish R0→R5 entirely. R0 done. 34 R1–R5 issues open at start. Constraint that actually
binds: **serial dependency chains** (esp. Sheet native + R5 report chain), NOT worker count.
Max-parallel = keep every ripe independent lane saturated + pipeline-refill the next-ripe on each merge.

## In-flight wave (8 concurrent — started 2026-08-30 20:xx)
- L1 Tooltip closeout #154,#155 · L2 #126 native stress (PR #315 revive) · L3 Perf #180,#181,#182
- L4 Compat #130–#135 · L5 Table #168,#169 · L6 A11y keyboard #146
- L7 Calendar i18n+a11y #175,#176 · L8 Slider gate #163

## Dependency chains (what unblocks what)
- **R1:** #126 → #127.  (native; longest-pole root)
- **R4 Sheet (critical path):** #127 → #158 → #160 → #161 → #162 (Select-after-Sheet). All native, 5 deep.
- **R4 Table:** #169 → #170 (export).
- **R4 Calendar:** #175/#176 → #177 (native runtime) → #178 (export).
- **R4 Tooltip:** #154 → (enables #141). #155 export.
- **R5:** #180/#181/#182 → #183 (footprint) → #184 (subpath exports decision) → #185 (budgets) → #186 (report). 4 deep.
- **R2 tail:** #136 (Web support contract, needs #170+#178) → #137 (compat CI) → #138 (publish).
- **R3 tail:** #146 → #150 (a11y docs); #141 (needs #154); #144 (needs #170); #149 (needs #177);
  #142 (needs #178); #147 VoiceOver + #148 TalkBack (need #167 done — NATIVE screen-reader evidence,
  gated on #126 proving the native-runtime evidence path).

## Refill order as slots free (dispatch when deps close)
1. **#127** the instant #126 merges (unblocks the whole Sheet chain — top priority).
2. **#170** when #169 merges; **#178** when #177 merges → both feed #136 + R3 tails.
3. **#158 → #160 → #161 → #162** serially after #127 (native; the pole — grind it, don't wait on width).
4. **#177** after #176 (native runtime, #126-class evidence).
5. **R5 chain #183 → #184 → #185 → #186** after #180-182 (can pipeline as one worker each step).
6. **#141** after #154; **#150** after #146; **#144** after #170; **#149** after #177; **#142** after #178.
7. **#147/#148** native a11y after #126 lane proves simulator/emulator screen-reader evidence.
8. **#136 → #137 → #138** (R2 tail) after #170 + #178.

## Owner-decision watch (surface, don't guess)
- #163 Slider gate, #184 subpath-exports decision, #162 adaptive Select — if a gate is a product-scope
  call not derivable from issue criteria, worker returns BLOCKED + recommendation → escalate to owner.

## Discipline
- 1 issue(-cluster)/branch/worktree. Exact-head CI evidence. No self-merge; controller reviews + merges.
- Shared-file contention = barrel `packages/ui/src/index.ts` + `registry/registry.json` +
  `component-gallery.tsx`. Serialize the export issues (#155,#170,#178,#161, Slider) at MERGE time;
  resolve trivial add-line conflicts on integration. Non-export lanes avoid these files.
- Native chains (#127,#158,#160,#177,#147,#148) are the schedule pole — keep them moving first.
