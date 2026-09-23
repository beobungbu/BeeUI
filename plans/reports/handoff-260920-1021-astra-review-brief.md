# Review brief for Astra — BeeUI consumer-audit batch (PR #617, PR #618, issue #619)

You are an independent external reviewer (no write access assumed). Nothing below is pre-approved; your job is to find what the authors missed. Work from the public GitHub repository; if you cannot run code, review by reading diffs, tests, CI logs and the authors' evidence, and say explicitly which claims you could only assess statically. Return your report as text.

## 1. Scope

Repository: https://github.com/beobungbu/BeeUI (integration branch `development`, protected `main`).

| Item | What it is |
|---|---|
| PR #617 `fix/consumer-audit-batch` → `development` | 72 issues (#543–#615) filed by two external consumer programs, BeeECOM (#543–#559) and BeePOS (#560–#615). 65 claimed fixed, #584 code-fixed, #606/#609 documented, #585/#590 partial, #561 owner decision, #551 duplicate. CI green at d28d8b9. |
| PR #618 `fix/consumer-audit-followups` → stacked on #617 | Real root-cause fix for #584 (iOS Sheet), reduced-motion Dialog role fix, date-picker focus scroll fix, arrow-key roving focus for scrollable Tabs and Toolbar, DateTimePicker locale copy, #585 items 2–3, dist-tag policy rewritten to match npm reality (#561 option b), complete visual baseline refresh. CI green at f36f344. |
| Issue #619 | Design proposal (four layers A–D) for React context + overlay z-order loss across gorhom's portal inside `Sheet` on native. Not implemented. Needs a design verdict. |

Evidence written by the authors (all on branch `fix/consumer-audit-followups`, browse at https://github.com/beobungbu/BeeUI/tree/fix/consumer-audit-followups/plans ; read these, then verify them; they are claims, not proof):
- `plans/reports/consumer-audit-260918-1952-fix-all-final-status-report.md` — per-issue verdict table for #617.
- `plans/260918-1559-consumer-audit-fix-all/reports/ws-{a,b,c,d1,d2,e,f,g,h}-report.md` — per-workstream reports for #617 (file lists, tests, gates, residuals).
- `plans/260919-1258-consumer-audit-followups/reports/ws-{i,j,k,l,m,n}-report.md` and `reports/ios-evidence/*.png` — #618. WS-K's absolute-fill theory for #584 was later disproven by WS-L; read both to see how.
- `.changeset/consumer-audit-batch.md` — the declared public-surface change.

## 2. Environment (only if you can run code)

- Node 24.13.1 exactly (`.npmrc` has `engine-strict=true`), pnpm 10.15.0 via `corepack pnpm`.
- `corepack pnpm install --frozen-lockfile && corepack pnpm build` before any typecheck (`packages/ui` needs core/tokens dist).
- Full gate: `corepack pnpm typecheck && corepack pnpm test` (30+ min). Targeted: `corepack pnpm --filter @beemvp/beeui-showcase test -- <pattern>`, Playwright in `apps/visual-regression` (`build:web` first).
- CI logs: https://github.com/beobungbu/BeeUI/actions (workflows `ci`, `web-consumer`, `web-a11y`, `visual-web`, `expo-consumer`); PR check lists on the PR pages.
- Generated outputs (component pages, `docs/component-reference.md`, `docs/public-surface.inventory.json`, `llms*.txt`, `packages/tokens/src/theme.css`) must only be regenerated through the pnpm scripts (`docs:portal-pages:generate`, `docs:contract:generate`, `docs:surface:generate`, `llms:generate`, `tokens:generate`). Running one generator script directly rewrites 63 pages destructively.
- iOS Simulator evidence for #584 was captured with a Maestro tap on iPhone 16 Pro / iOS 18.6; PNGs are committed under `plans/260919-1258-consumer-audit-followups/reports/ios-evidence/`.

## 3. What to review, in priority order

### 3.1 Correctness of the highest-risk changes (read the hunks, run the tests)
1. `packages/ui/src/components/sheet.native.tsx` (+ `overlay-runtime.tsx` snapshot hook): no mount-time `dismiss()` on a never-presented gorhom modal, `SheetPortalContextBridge`, in-flow `flex:1` content box, `accessible={false}` on the modal. Check: does the `presentedRef` reset on every dismissal path (backdrop, swipe, `SheetClose`, programmatic `open=false`, unmount while open)? Can a second `present()` race the first `onDismiss`? Does the bridge re-provide stale snapshots (safe-area on rotation, overlay runtime revision)?
2. `packages/ui/src/components/dialog.tsx` + `dialog-role-watch.ts`: MutationObserver that stamps `role` on react-native-web's Modal owner node for both `dialog` and `alertdialog`, and the synchronous `matchMedia` reduced-motion read on Web. Check: observer lifecycle on rapid open/close, SSR / no-`MutationObserver` environments, nested dialogs (two observers, two owner nodes), whether stamping the role before RNW's `active` flips breaks RNW's own Escape handling or focus trap.
3. `scripts/generate-tokens.mjs` → `packages/tokens/src/theme.css`: runtime themes now emitted as un-anchored `.themeName {}` blocks plus cascade-inert `@variant` registration blocks. Check: global `<html class>` switching still works, nested `BeeThemeScope` resolves by DOM proximity, no semantic-color utility stopped being generated (compare the built CSS of `apps/visual-regression` before/after), high-contrast themes.
4. `packages/ui/src/components/table.web.tsx` / `table.tsx`: `TableRow onPress` (role/keyboard semantics), stacked layout row grouping, `align`, `density` with the new `spacing.row-dense` token. Check keyboard activation and that `onPress` rows are not nested pressables.
5. `packages/ui/src/components/tabs.tsx` and `toolbar.tsx`: roving focus implemented partly via `React.cloneElement` on caller children (Toolbar). Check: children that are not BeeUI pressables, fragments, conditional children, RTL, `disabled` items, and that the instant (`animated: false`) scroll does not regress reduced-motion expectations elsewhere.
6. `packages/ui/src/components/field*.tsx`, `input.tsx`, `date-*picker*.tsx`: the "no injected English `required` copy" contract, `requiredLabel`, `aria-required` removed from picker trigger buttons (not permitted on role=button), `[role="gridcell"]` focus selectors, `focus({ preventScroll: true })`.
7. `packages/ui/src/components/calendar.tsx`: day cells are `gridcell` on Web via a type cast. Check the native role path and any consumer test selectors that still expect `cell`.

### 3.2 Claims vs. evidence
- For every issue in the final status table, open the issue, read its acceptance criteria, and confirm the merged diff plus a regression test actually satisfies it. Flag any "fixed" that is only "tests updated to the new behaviour".
- #606: authors say react-native-web's TextInput calls `stopPropagation` on keydown and only documented it (Playwright spec left as `fixme`). Verify against the installed RNW source and judge whether a BeeUI-side fix was reasonably available.
- #550/#552: reproduce the packed-consumer check described in ws-e/ws-g reports (`examples/web-consumer/setup.sh` packs the workspace) and confirm scoped tokens now apply.
- #584: the only proof is a simulator screenshot + Maestro flow on iOS 18.6. Judge whether the Jest structural tests would catch a regression, and note that Android was not run.

### 3.3 Process risks
- Workflows were edited in #617 (`.github/workflows/ci.yml`, `expo-consumer.yml`: `packages: platform-tools` for android-actions/setup-android). Green CI is not evidence when a PR edits CI — confirm the android jobs still compile both APKs (job step logs), and that no gate lost its teeth.
- #618's base is #617's branch, so its visual job ran the *complete* screenshot set and 38 baselines (dark, high-contrast, desktop, density, locale) were refreshed from CI actuals. Diff a sample of those PNGs against `development` and confirm every delta maps to an intentional change (PasswordInput visible label, Button min-height, Badge outline, Table row height, DateTimePicker locale/placeholder). Anything else is a hidden regression.
- Public surface grew by 9 rows (Toolbar family, `TableAlign`, `TableDensity`, `ToastPlacement`) under one `minor` changeset for `@beemvp/beeui-ui` and `@beemvp/beeui-tokens`. Check the changeset text is accurate and nothing else leaked into a public subpath (an earlier draft exported a test helper from `./dialog`; it was moved to an internal module — confirm no similar leak remains, e.g. via `docs/public-surface.inventory.json` diff).
- `docs/dist-tag-policy.md` and its checks were rewritten to say `latest` legitimately equals the RC until the first stable publish. Confirm no check was weakened rather than re-specified, and that README/cookbook/llms agree.
- The generated docs chain: confirm `corepack pnpm docs:portal-pages:check && docs:contract:check && docs:surface:check && llms:check` are clean on both branch heads, and that hand-authored prose survived regeneration (spot-check `components/table.md`, `components/toolbar.md`, `theming/index.md`).

### 3.4 Issue #619 (design review)
Give a verdict on each layer: A (BeeUIProvider owns `BottomSheetModalProvider`), B (whole-tree context preservation through the teleport host via gorhom `containerComponent`, fallback `bridgeContexts`), C (nested overlay host + toast viewport inside the sheet portal), D (dev-time diagnostics). Answer the four open questions in the issue. If you know a simpler or more standard pattern, say so with a reference.

## 4. Deliverable

Return a Markdown report (it will be committed by the owner as `plans/reports/from-astra-260920-consumer-audit-review-report.md`). Structure:

1. **Verdict per PR**: APPROVE / REQUEST CHANGES / BLOCK, one paragraph each.
2. **Findings table**: severity (blocker / major / minor / nit), file:line or issue number, what is wrong, how you verified it (command + result), suggested fix. Most severe first. Confirmed findings only; label anything unverified as "plausible".
3. **Claims you could not verify** and why.
4. **#619 design verdict** and answers to its open questions.
5. **Follow-up list** the owner must decide (real-device run of #584, Android sheet smoke, #590 hosting, `useToast` in Sheet).

End with:
```
Status: DONE | DONE_WITH_CONCERNS | BLOCKED
Summary: 1–2 sentences
```
Do not restate the authors' reports; your value is in what they got wrong or left unproven.
