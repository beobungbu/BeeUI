# rc.2 consumer verification fixes (BeePOS report 2026-09-23)

Status: in progress · Branch: `fix/rc2-consumer-verification` from `origin/development@c3bb5ff`

Source: BeePOS verification of `0.86.2-rc.2` (tracker BeePOS #234). Each BeeUI issue carries a BeePOS
verification comment with the failing evidence; that comment is the acceptance baseline.

## Lesson that shapes every workstream

Existing gates passed while the defects shipped (`select-overflowing-list-mouse-pick.spec.ts`,
`input-keydown-bubble.spec.ts` exist and are green). A fix counts only when a test reproduces the
consumer's failing condition first (red), then passes (green). Showcase-only fixtures that the
consumer never hits do not count.

## Workstreams (disjoint file ownership)

| WS | Issues | Owns |
|---|---|---|
| W1 Sheet | #629 (crash without `SheetProvider`), #584 | `sheet.native.tsx`, `sheet-context-bridge.tsx`, sheet tests |
| W2 Select | #612, #630 (regression of #570), #587 | `select.tsx`, select specs/tests |
| W3 Form/keyboard | #588, #631.1, #631.2, #631.5, #571 | `keyboard-aware-screen.tsx`, `form-group*.ts(x)`, `checkbox.tsx`, `field.tsx`, `field-context.ts` |
| W4 Input/controls | #589, #606, #600, #568, #631.3 | `input.tsx`, `search-input.tsx`, `segmented-control.tsx`, `icon-button.tsx`, `button.tsx` |
| W5 Color/type | #599, #604, #631.4, #631.6, #592 | `text.tsx`, `avatar.tsx`, `table*.ts(x)`, `stepper.tsx`, `toast*.tsx`, theme/tokens warning path |
| W6 Docs | #629 docs, #594, #585, #590, rc.1→rc.2 upgrade notes | `scripts/generate-llms-txt.mjs` + llms sources, hand-authored Starlight pages, `CHANGELOG.md` Unreleased |

Controller-owned (not delegated): integration merge, generated-surface regeneration, visual
baselines, #614 (iOS a11y tree verification), #561 (owner decision on `latest`), issue tracker updates.

## Acceptance

- Every BeePOS negative result has a test that fails on `c3bb5ff` and passes on the branch, or a
  written reason it cannot be automated plus manual evidence.
- `pnpm typecheck && pnpm test && pnpm lint` green; `docs:portal-pages:check/test` green.
- PR CI green (classify/verify/web-a11y/visual-web-report/web-consumer).
- No issue closed by this PR; closing waits for BeePOS re-verification on the next RC.

## Reports

`plans/260923-2027-rc2-consumer-verification-fixes/reports/ws-<n>-*.md`
