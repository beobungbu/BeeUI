# WS-O — fixes from Astra's independent review

Branch: `ws/o-astra-review-fixes` @ `3dc664773ae5856a4f32c58eae51f89f7bbefa34`
Base: `fix/consumer-audit-followups` @ `d472631`

## Item 1 — Toolbar roving focus (major) — fixed

`Toolbar`'s roving-tabindex `sequence` listed every visible `ToolbarItem`
regardless of whether its cloned child actually mounted a focusable control.
A null/conditionally-omitted child, or a `Fragment` (React cannot attach a
`ref` to one), could still claim a sequence slot with no real control behind
it, so `resolvedCurrentId` could pick a dead slot and no control anywhere got
`tabIndex=0`.

Fix (`packages/ui/src/components/toolbar.tsx`): `sequence` is now filtered
against a `focusableIds` state set, populated from `focusablesRef`'s actual
registrations via a `useLayoutEffect` that runs after every commit (ref
callbacks recreate every render, so gating on a stable dependency array isn't
possible) but only calls `setFocusableIds` when the resolved id set actually
changed — this is what keeps the per-render ref churn from becoming a render
loop (verified empirically: the fix converges within one extra render, no
infinite loop, confirmed by running the new tests and the full suite).
`withRovingFocus` now explicitly skips `React.Fragment` children (and any
other non-element, non-null/undefined/false child) with a dev-only
console.warn, deduped per item id.

Files changed:
- `packages/ui/src/components/toolbar.tsx` (+59/-10)
- `apps/showcase/__tests__/toolbar-non-focusable-children-roving-focus.test.tsx` (new, 6 tests)
- `apps/docs/src/content/docs/components/toolbar.md`, `icon-button.md` (mechanical, via `docs:portal-pages:generate` — new test fixture cross-references)

Tests added (all passing): null child, conditional (`false`) child, Fragment
child (warns once, not on a second re-layout), a plain non-BeeUI element
(`Pressable` from `react-native` directly) that still mounts and is
correctly included, a disabled real control keeping its skippable slot, and
the overflow trigger staying the sequence's last stop with non-focusable
children mixed in.

Gate commands run:
- `pnpm --filter @beemvp/beeui-showcase test -- toolbar` → 11 passed (pre-existing suites, no regression)
- `pnpm --filter @beemvp/beeui-showcase test -- toolbar-non-focusable` → 6 passed
- `pnpm --filter @beemvp/beeui-ui typecheck` → clean
- `pnpm lint` → required an `eslint-disable-next-line react-hooks/exhaustive-deps` on the new `useLayoutEffect` (intentional: no dependency array is correct here, the effect's own internal diff guard prevents the loop the rule is normally protecting against) — clean after that.

## Item 2 — TableRow onPress embedded-action contract (major) — fixed (Web); proven, not fixed (native)

Web (`packages/ui/src/components/table.web.tsx`): `onClick`/`onKeyDown` on
the `<tr>`/`<div role="row">` fired for a click/Enter/Space originating
anywhere inside the row, including a nested `Button`/`Checkbox`/link/input.
Added `isEmbeddedInteractiveActivation(event)` — walks up from
`event.target` via `.closest(INTERACTIVE_DESCENDANT_SELECTOR)` (`button,
a[href], input, select, textarea, [role="button"], [role="checkbox"],
[role="link"], [role="switch"], [role="menuitem"], [contenteditable]`),
bounded to inside the row via `currentTarget.contains(...)` when available —
and both the click and keydown paths now bail out when it returns true.
Degrades safely (returns `false`, i.e. "not embedded") when `target`/
`currentTarget` are absent or don't expose `closest`/`contains`, which is
what the existing `fireEvent(row, 'click')` (no event object) test in
`table-web-structure-and-accessibility.test.tsx` exercises — required one
`if (!event) return false;` guard to keep that pre-existing test passing.

Native (`packages/ui/src/components/table.tsx`): no code change. RN's own
gesture-responder negotiation already gives an embedded `Pressable` the
touch before the outer row's `Pressable` claims it — this is existing,
correct behavior, not a bug. Added the test the spec asked for, but note
honestly: `@testing-library/react-native`'s `fireEvent.press(nestedButton)`
calls only that element's own `onPress` prop directly — it does not simulate
real touch/responder capture, so this jest test cannot actually prove RN's
responder-negotiation contract; it only pins "pressing the nested control's
own testID never also invokes the row's separate onPress handler," which is
necessarily true regardless of any fix given how `fireEvent` works. Real
responder-capture evidence is native-runtime/Maestro-only and out of this
workstream's tooling. Documented as "proven at the jest level; real capture
evidence is native/Maestro, not reproducible in this test environment."

Also documented the a11y rule on the Table page (source of truth is
`docs/component-reference.content.json`'s `table.limitations`, regenerated
into `apps/docs/src/content/docs/components/table.md` via
`docs:portal-pages:generate`): a row with `onPress` should not also embed
interactive controls on native, since the whole row is exposed as one
button-role `Pressable` regardless of what its cells contain; prefer a
single cell action or a leading `Checkbox`, and note Web keeps row/cell
activation independent so this combination is Web-only. (Two backtick-token
false positives from the reference generator's prop-name guard — `button`
and a bare `accessibilityRole` — were rewritten as plain prose since neither
is a real prop of the family; verified against
`scripts/public-component-reference.mjs`'s `findUnknownBehaviorPropReferences`.)

Files changed:
- `packages/ui/src/components/table.web.tsx` (+40/-3)
- `apps/showcase/__tests__/table-web-row-onpress-embedded-action.test.tsx` (new, 5 tests, fabricated `closest`/`contains`-capable stand-ins for `event.target`/`currentTarget` since `@testing-library/react-native`'s `fireEvent` calls the handler with exactly the object passed, no real DOM/bubbling)
- `apps/showcase/__tests__/table-row-onpress-embedded-action.test.tsx` (new, 3 tests, native)
- `docs/component-reference.content.json`, `apps/docs/src/content/docs/components/table.md`

Gate commands run:
- `pnpm --filter @beemvp/beeui-showcase test -- table-web` → 10 passed (no regression once the `!event` guard was added)
- `pnpm --filter @beemvp/beeui-showcase test -- "table-web-row-onpress-embedded-action|table-row-onpress-embedded-action"` → 8 passed
- `pnpm --filter @beemvp/beeui-ui typecheck` → clean
- `pnpm docs:portal-pages:generate` then `pnpm docs:portal-pages:check` → clean (only `table.md` content changed for this item; `toolbar.md`/`icon-button.md` changes are item 1's mechanical fixture cross-references)

## Item 3 — #550/#552 package-boundary proof (minor) — fixed

`examples/web-consumer/src/App.tsx` and the CI-run
`scripts/verify-web-consumer.sh` fixture (its `src/App.tsx` heredoc — this
script writes its own app sources inline, it does not read
`examples/web-consumer`) never rendered `BeeThemeScope` or read
`useBeeToken`, so the claimed package-boundary proof never actually ran.
Both now render a `BeeThemeScope` scoped to `brand="violet"
appearance="dark"` (different from the ambient app theme) wrapping a
`Box className="bg-primary"` swatch plus a `useBeeToken('colors.primary')`
text readout, next to an identical pair outside the scope, all with stable
`testID`s (`ambient-primary-swatch`/`token`, `scoped-primary-swatch`/`token`
→ `data-testid` under react-native-web).

`verify-consumer.mjs` (also inside the script's heredoc — it is generated
fresh per run, not a static repo file) now asserts, against the real packed
tarball running in real Chromium:
- `getComputedStyle(...).backgroundColor` differs between the ambient and
  scoped swatch (throws with the actual value if they match)
- the two `useBeeToken` text readouts differ (throws with the actual value if they match)

Verified this is real, non-vacuous evidence: ran the built fixture through a
throwaway Playwright probe outside the committed script and confirmed the
ambient primary resolves to `#f59e0b` (amber, `rgb(245, 158, 11)`) and the
scoped one to `#a78bfa` (violet, `rgb(167, 139, 250)`) — genuinely different
values, not an accidental same-value pass.

Files changed:
- `examples/web-consumer/src/App.tsx` (+21/-1)
- `scripts/verify-web-consumer.sh` (+33/-1, all inside the two heredocs)

Gate commands run (exactly as `.github/workflows/web-consumer.yml` invokes
them — packed tarballs via `pnpm pack`, installed into a temp npm/Vite app,
built with `vite build`, served with `vite preview`, driven with
`@playwright/test` + `@axe-core/playwright` in real headless Chromium):

```
BEEUI_WEB_CONSUMER_WORK_ROOT=/tmp/beeui-web-consumer-ws-o \
BEEUI_WEB_CONSUMER_CLEAN=1 BEEUI_WEB_CONSUMER_PORT=4519 \
bash scripts/verify-web-consumer.sh all
```

Tail of output:
```
✓ 571 modules transformed.
dist/index.html                   0.42 kB │ gzip:   0.29 kB
dist/assets/index-C5kYB0AT.css   46.28 kB │ gzip:   7.85 kB
dist/assets/index-CyI6fUEL.js   580.18 kB │ gzip: 181.25 kB
✓ built in 838ms
OK: independent Vite + react-native-web consumer — forms, overlays, Select, Tooltip, Sheet, Table, Calendar, and the BeeThemeScope/useBeeToken package-boundary proof all interact correctly with no console errors and no serious/critical axe violations.
```

(Playwright Chromium was not yet installed locally; ran
`pnpm --dir apps/visual-regression exec playwright install chromium` first,
matching the workflow's own `playwright install --with-deps chromium` step.)

## Item 4 — Sheet rapid close→reopen (plausible) — reproduced and fixed

Traced the race in `sheet.native.tsx`: caller toggles `open`
`true → false → true` before gorhom's asynchronous `onDismiss` for the
middle `dismiss()` call arrives. `handleDismiss` had no way to tell that
late, now-stale completion apart from a current one — it unconditionally
reset `presentedRef` and, since the reopen had already set `openRef.current`
back to `true`, proceeded to call `onRequestClose`/`setOpen(false)` for a
close the caller had already superseded.

Wrote the deterministic jest test first against the **unfixed** code to
confirm the reproduction (not just a theoretical read): it failed exactly as
predicted — `onOpenChange` was called with `false` after the stale
`onDismiss` fired, even though the sheet had already been reopened.

Fix: a monotonic `presentationGenerationRef` bumped every time
`sheetRef.current.present()` is called, and a
`dismissRequestGenerationRef` that snapshots the current generation at the
moment BeeUI's own effect issues `dismiss()`. `handleDismiss` now compares
the two: if a newer generation started (a reopen) since that particular
`dismiss()` was requested, the callback is stale and is ignored entirely
(no `presentedRef`/`openRef` mutation, no `onRequestClose`, no `setOpen`).
A `null` snapshot (no BeeUI-issued `dismiss()` outstanding) means every
gorhom-initiated close — swipe, backdrop, Android back — still runs the
full existing logic unchanged, which the two non-racing tests confirm.

Files changed:
- `packages/ui/src/components/sheet.native.tsx` (+35/-3)
- `apps/showcase/__tests__/sheet-native-rapid-close-reopen.test.tsx` (new, 3 tests: the race itself, a plain non-racing gorhom-initiated dismiss, and a plain non-racing effect-driven dismiss)

Did not touch the iOS Maestro flow (WS-L's suite) — that lives outside this
workstream's owned files (`apps/showcase/__tests__/**` only) and outside the
jest/typecheck/lint toolchain this report can execute and verify; flagging
for WS-L/owner follow-up rather than guessing at a Maestro step I cannot run.

Gate commands run:
- `pnpm --filter @beemvp/beeui-showcase test -- sheet-native-rapid-close-reopen` → 3 passed
- `pnpm --filter @beemvp/beeui-showcase test -- "sheet-native-rapid-close-reopen|issue-158-sheet-native"` → 19 passed (no regression on the existing gorhom-adapter contract suite)
- `pnpm --filter @beemvp/beeui-ui typecheck` → clean

## Full gate run (final, on the committed tree)

- `pnpm lint` → clean (after the one documented `eslint-disable-next-line`)
- `pnpm --filter @beemvp/beeui-ui typecheck` → clean
- `pnpm --filter @beemvp/beeui-showcase typecheck` → clean
- `pnpm --filter @beemvp/beeui-showcase test` → **130 suites / 1159 tests passed**, 0 failed
- `pnpm ui-exports:check` → "exports are current (63 public component subpaths)"
- `pnpm docs:portal-pages:check` → "Portal page freshness check passed"
- `scripts/verify-web-consumer.sh all` (workflow-equivalent invocation) → OK, no console errors, no serious/critical axe violations

## Files modified (all commits)

- `packages/ui/src/components/toolbar.tsx`
- `packages/ui/src/components/table.web.tsx`
- `packages/ui/src/components/sheet.native.tsx`
- `examples/web-consumer/src/App.tsx`
- `scripts/verify-web-consumer.sh`
- `docs/component-reference.content.json`
- `apps/docs/src/content/docs/components/{table,toolbar,icon-button}.md` (generated, via `docs:portal-pages:generate`)
- `apps/showcase/__tests__/toolbar-non-focusable-children-roving-focus.test.tsx` (new)
- `apps/showcase/__tests__/table-web-row-onpress-embedded-action.test.tsx` (new)
- `apps/showcase/__tests__/table-row-onpress-embedded-action.test.tsx` (new)
- `apps/showcase/__tests__/sheet-native-rapid-close-reopen.test.tsx` (new)

Not touched: `docs/dist-tag-policy.md`, `README.md`, any other docs page,
`apps/visual-regression/tests/**` (kept as-is per the spec's item 3
instruction; no Gate command requires a Playwright visual-regression run for
this phase).

Status: DONE
Branch: ws/o-astra-review-fixes @ 3dc664773ae5856a4f32c58eae51f89f7bbefa34
Summary: All four Astra-review findings addressed — Toolbar roving-focus derivation fixed, TableRow embedded-action exclusion fixed on Web (native already correct, documented + tested), the BeeThemeScope/useBeeToken package-boundary gap closed with a real differing-value assertion, and the Sheet rapid close→reopen race reproduced then fixed with a presentation-generation counter. Every listed Gate command passed on the final committed tree.
Concerns: Item 2's native jest test is a weak/tautological proof (fireEvent doesn't simulate real touch responder capture) — flagged honestly in the report rather than overstated; item 4's Maestro flow addition is out of this workstream's file ownership and tooling, left for WS-L/owner follow-up.
