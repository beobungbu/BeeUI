# BeeUI Documentation Authority Index

This directory contains current-state product/engineering documentation and the BeeUI 1.0 execution control plane.

## BeeUI 1.0 authority order

For implementation/dispatch decisions, read in this order:

1. GitHub issue #114 — program status, hard gates and owner-locked release state.
2. `docs/roadmap.md` — product scope, hard 1.0 gates and complete issue map.
3. `docs/beeui-1.0-sequence.md` — authoritative dependency, eligibility, parallelization and serialization order.
4. `docs/agent-execution-contract.md` — mandatory implementation-agent startup, exact-base discipline, self-test, self-review and PR handoff protocol.
5. `docs/beeui-1.0-integration-discipline.md` — shared exports/registry/package/tokens/docs/demo/release integration rules.
6. `docs/beeui-1.0-owner-gates.md` — legal/business/account/visibility/release actions agents may not cross autonomously.
7. `docs/beeui-1.0-status-model.md` — canonical task/PR execution states.
8. `docs/beeui-1.0-evidence-classes.md` — precise deterministic/browser/visual/compile/native/a11y/consumer/performance/release evidence terminology.
9. Assigned child issue body — task-specific objective, dependencies, decisions, acceptance and DoD.
10. Relevant accepted ADR/component/runtime/package documents — implementation-level contract.

**Issue number is not execution order.** Always use `docs/beeui-1.0-sequence.md`.

## Agent/dispatcher resources

- `docs/claude-dispatch-prompt.md` — canonical ready-to-send Claude/implementation-dispatcher prompt.
- `docs/beeui-1.0-dispatch-wave-template.md` — standard eligibility/worker/final-wave report shape.
- `docs/beeui-1.0-decision-record-template.md` — standard ADR/decision-packet structure.

## Review resources

- `docs/beeui-1.0-review-checklist.md` — independent exact-head review checklist after worker self-test/self-review.
- `docs/beeui-1.0-evidence-classes.md` — what each evidence class actually proves and does not prove.
- `docs/beeui-1.0-status-model.md` — distinguishes `READY_FOR_INDEPENDENT_REVIEW`, `APPROVED`, `MERGED`, `OWNER_ACTION_REQUIRED`, etc.

## Conflict rule

If a lower-level document conflicts with a newer accepted higher-level authority, do not guess or silently choose one. Stop implementation and reconcile #114/roadmap/sequence/issue before coding.

A child issue may add stricter verification than the shared agent contract but may not weaken it.

## Release language

`release-ready`, `publication-ready`, packed artifacts, dry runs, provenance preparation and RC-ready evidence do **not** mean BeeUI has been published.

Stable npm packages, the stable public CLI, stable dist-tags, the `v1.0.0` tag and final GitHub Release are owner-gated by issue #254.

No agent may infer publication authorization from technical readiness.

## Maintenance rule

When accepted work changes current state, dependency order, support boundaries or a public contract, update the affected canonical documentation and #114 in the same integration change or an explicitly linked synchronization PR.

Do not leave:

- completed work described as future work;
- future work described as shipped;
- release-ready-but-unpublished artifacts described as publicly available;
- stale dependency text that contradicts `docs/beeui-1.0-sequence.md`.
