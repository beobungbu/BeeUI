# Consumer audit fix-all (BeePOS + BeeECOM findings, BeeUI #543–#615)

Status: in progress · Base: origin/development · Integration branch: fix/consumer-audit-batch
Source list: plans/reports/consumer-audit-260918-1554-beepos-beeecom-beeui-issues-report.md

## Workstreams (disjoint file ownership; run in parallel)

| WS | Scope | Spec |
|---|---|---|
| A | Web/native a11y + form semantics + i18n copy | phase-A-a11y-forms.md |
| B | Web runtime, theme scope, tokens, input/select/sheet/safe-area, native keyboard | phase-B-runtime.md |
| C | Dialog, table, visual/dark, button family, list/chip/badge API gaps, toast/date-picker native | phase-C-visual-api.md |
| D1 | Docs: start, config, styling, theming, tokens, compat pins | phase-D1-docs-setup.md |
| D2 | Docs: components, props generator, patterns, llms, site structure | phase-D2-docs-components.md |

## Deferred (owner gate or new component family)
- #561 npm dist-tag `latest` → needs npm publish rights (owner).
- #590 item 6 site availability → ops, not code.
- #591 closable scrollable tab strip family, #611 item 1 toolbar overflow primitive, #592 item 1 OTPInput segmented, #603 item 1 per-table density step → new primitives; design decision first.
- #584 Sheet never presents on iOS → root-cause investigation in WS-B, fix only if reproducible in code path; real-device proof is an owner gate.

## Acceptance
- Each WS: `pnpm lint`, `pnpm --filter @beemvp/beeui-ui typecheck`, targeted showcase jest tests green, new regression test per fixed bug.
- Docs WS: `pnpm docs:examples:check && pnpm docs:patterns:check && pnpm llms:check && pnpm docs:contract:check` green.
- Integration: `pnpm typecheck && pnpm test` on fix/consumer-audit-batch, then PR to development.
