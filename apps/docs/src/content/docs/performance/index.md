---
title: Performance
description: BeeUI's benchmark harness, regression budgets, and baseline report.
---

BeeUI includes a reproducible benchmark harness (`pnpm bench`) covering render/update
stress, overlay/Tooltip/Sheet latency, Theme Tokens v3 runtime performance, Table
render/update scale, and package/bundle footprint.

- **Methodology** — how measurements are taken, environment provenance, warm-up/sampling
  strategy, and the Web-vs-native evidence rules: `docs/benchmark-harness.md`.
- **Baseline report** — current numbers with interpretation across render/update stress,
  overlay latency, theme switching, Table scale, package/bundle footprint, and optional
  dependency cost, plus what BeeUI explicitly does not claim: `docs/performance-baseline-report.md`.
- **Package/bundle footprint baseline** — packed tarball sizes and clean-consumer bundle
  contribution against the real release-ready package layout: `docs/bundle-footprint-baseline.md`.
- **Regression budgets** — the machine-checkable thresholds (`pnpm bench:web` /
  `pnpm bench:native` overhead-ratio gates, `pnpm bench:budget` footprint gates) that
  keep the numbers above from silently regressing, documented in the methodology doc's
  "Regression budgets" section.

Reproduce any number yourself with `pnpm bench:web`, `pnpm bench:native`,
`pnpm bench:components`, or `pnpm bench:footprint` — every result records its own
environment (Node/OS/CPU/git SHA), so treat timing numbers as host-relative and only
the package/bundle byte counts as portable across hosts.
