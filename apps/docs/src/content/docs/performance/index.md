---
title: Performance
description: Understand BeeUI benchmark classes, bundle footprint and regression budgets without turning one machine into a universal promise.
---

BeeUI measures repeatable component operations and package/bundle footprint so regressions
can be detected against a controlled baseline. Benchmark classes include representative
Table work, overlay open/close/positioning, theme/token operations and package footprint.

## How to read a result

A benchmark is meaningful only with its environment, warmup/sampling method and variance.
CI/regression budgets catch material changes; they are not universal frame-rate or device
latency guarantees. Browser bundle size is not the same as native binary size, and synthetic
component loops are not end-user interaction traces.

Use BeeUI's results to compare changes on the same harness, then measure your own app on the
hardware/browser mix that matters to you.

Sources: [benchmark harness](https://github.com/beobungbu/BeeUI/blob/main/docs/benchmark-harness.md), [performance baseline](https://github.com/beobungbu/BeeUI/blob/main/docs/performance-baseline-report.md), and [bundle footprint](https://github.com/beobungbu/BeeUI/blob/main/docs/bundle-footprint-baseline.md).
