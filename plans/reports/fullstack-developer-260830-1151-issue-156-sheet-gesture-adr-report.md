# Issue #156 (R4B.1) — Sheet gesture engine ADR

## Executed

- Worktree: `/Users/textsoft/workspace/beeui-wt-156`, branch `docs/156-sheet-adr`.
- Base: `main @ 3ca70c1` (exact, unchanged throughout). Head: `6b89f0f`.
- Deliverable: `docs/decisions/005-sheet-gesture-engine.md` (new, 441 lines). Doc-only, no code/manifest/registry changes.

## Decision recorded

Platform-split Sheet architecture:
- Public API/semantics/accessibility/tests: 100% BeeUI-owned, both platforms.
- Native: optional `@gorhom/bottom-sheet` adapter (+ optional `react-native-reanimated`/`react-native-gesture-handler` peers) for drag/spring physics only; matches BeeUI's existing `newArchEnabled: true` (`apps/showcase/app.json`) and Fabric-only overlay transport.
- Web: reuses BeeUI's existing overlay contract (`overlay-transport.web.tsx` + Dialog CSS/Uniwind kernel); no gorhom on Web, no drag-to-dismiss parity claimed for 1.0.
- Reduced motion/safe area: composed with existing `docs/motion.md` contract and `react-native-safe-area-context` peer, not duplicated; native spring documented as scoped use of the existing "gesture-driven interactions may use Reanimated" carve-out in `docs/architecture.md`.
- Rejected: BeeUI-owned minimal gesture engine (Option B), gorhom-for-Web-too (Option C), hard non-optional dependency.
- Fixes dependency *shape* only (3 new optional peer deps scoped to a future `sheet` registry entry) — no manifest edits, no version pins; deferred to #158/#161 per `docs/compatibility-matrix.md`'s own process.

## Tests

- `pnpm hygiene:check` → pass.
- `pnpm compat:check` → pass.
- `git diff --cached --check` → clean.
- Ran under `nvm use 24.13.1` (repo pins `24.13.1`; ambient shell had `24.14.1`, unrelated env drift, not part of this change).
- No typecheck/test run needed beyond the above — single new markdown file, no code/manifest touched.

## Handoff

- Committed (conventional, no co-author trailer), pushed `docs/156-sheet-adr`.
- PR: https://github.com/beobungbu/BeeUI/pull/308 (base `main`@`3ca70c1`, head `6b89f0f`), links #156 + #114.
- Not merged, main untouched, no visibility/publish action taken.

Status: DONE
Summary: ADR-005 written and PR #308 opened deciding optional gorhom native adapter + BeeUI-owned Web sheet; base/head exact, hygiene+compat checks pass, doc-only.
Concerns/Blockers: none. External-library claims about gorhom (peer deps, Web/DOM maturity, keyboard/reduced-motion features) are search-derived and explicitly hedged/flagged in the ADR and PR body for re-verification by #158/#159/#161 against the real package.
