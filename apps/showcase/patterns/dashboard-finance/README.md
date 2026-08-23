# Dashboard + Finance Patterns

This pack proves the current BeeUI public surface can compose premium SaaS / fintech application screens without extending `packages/ui`, adding a chart dependency, or taking ownership of routing and finance business logic.

## Screens

1. `DashboardOverviewScreen` — greeting, primary balance, directional trend, KPI cards, deterministic revenue bars, shortcuts, recent activity, loading and first-use states.
2. `AnalyticsScreen` — controlled range tabs, headline KPI, comparison trend, local deterministic bars, category distribution, and no-data state.
3. `TransactionsScreen` — balance context, search, controlled filters, grouped mobile transaction rows, pending/failed states, filtered-empty and error states.
4. `TransactionDetailScreen` — amount/status hero, merchant, timestamp, account method, reference, category, description, receipt/help callbacks.
5. `WalletScreen` — wallet/available balance, add/send/receive callbacks, connected accounts, recent activity, and no-payment-methods state.
6. `PaymentMethodsScreen` — default method summary, active/problem rows, add/manage/remove callbacks.
7. `SubscriptionScreen` — plan, billing cycle, renewal, usage, benefits, manage/upgrade/cancel callbacks, and usage warning composition.
8. `InvoiceDetailScreen` — status, dates, parties, line items, totals, payment status, download/share callbacks.

## Design philosophy

- Mobile-first at 390×844 with min-width cards and wrapping compositions that naturally expand at 430px, tablet, and wide web sizes.
- Strong numeric hierarchy without desktop-only data tables.
- Semantic BeeUI surfaces and text tones for light/dark mode instead of hard-coded colors.
- Dense information is grouped into focused cards, short metadata rows, and clear section headers.
- Long merchant names use truncation while values remain readable and aligned.

## Fixture model

Fixtures live in `fixtures/` and provide already-formatted display strings such as `$24,860.00` and `Aug 22, 2026`. The pattern layer does not perform currency, locale, tax, date, networking, persistence, or payment-provider business logic.

All screens receive data and callbacks through props. Consuming apps decide how to fetch, format, navigate, mutate, or persist.

## Responsive policy

The pack uses existing `Stack`/`HStack`, local `flex-wrap`, `min-w-*`, and `flex-1` composition. No `ResponsiveGrid` abstraction was added. This keeps mobile layouts natural while allowing metric groups and split content to expand on larger widths.

## Local chart approach

`MiniBarChart` is a local deterministic view composition. It is intentionally small: proportional bars, caller-supplied values, labels, and an accessible image description. BeeUI is not turned into a chart library and no runtime chart dependency is added.

## State coverage

- Dashboard: ready, loading/skeleton, first-use empty.
- Analytics: ready, no-data.
- Transactions: ready, filtered-empty, error.
- Wallet: active, no payment methods.
- Subscription: active, usage warning.

## Discovered gaps

No BeeUI gap was promoted from this workstream. The current public surface was sufficient, and the remaining local compositions are small and domain-specific. A chart integration contract should only be reconsidered if another independent domain repeats the same integration pressure; this pack alone is not evidence enough.

## Non-goals

This pack does not own routing, APIs, app-wide state, finance/payment SDKs, payment processing, persistence, analytics platforms, currency/tax/date formatting, or `#35` anchored-overlay behavior.
