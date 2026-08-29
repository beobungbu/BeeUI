# BeeUI Documentation Authority Index

This directory contains both current-state product/engineering documentation and the BeeUI 1.0 execution control plane.

For BeeUI 1.0 execution, use the following authority order:

1. GitHub issue #114 — program status and owner-gated release state.
2. `docs/roadmap.md` — product scope, hard 1.0 gates, issue map.
3. `docs/beeui-1.0-sequence.md` — dependency/eligibility/parallelization order.
4. `docs/agent-execution-contract.md` — mandatory implementation-agent self-test, self-review and PR handoff protocol.
5. Assigned child issue body — task-specific scope, decisions, acceptance and DoD.
6. Relevant accepted ADR/component/runtime/package documents — implementation-level contract.

The canonical ready-to-send dispatcher prompt is `docs/claude-dispatch-prompt.md`.

## Conflict rule

If a lower-level document conflicts with a newer accepted higher-level authority, do not guess. Stop implementation and reconcile the conflict in the roadmap/tracker/issue before coding.

## Release language

`release-ready`, `publication-ready`, packed artifacts, dry runs, provenance preparation, and RC-ready evidence do **not** mean BeeUI has been published.

Stable npm packages, the stable public CLI, the `v1.0.0` tag and final GitHub Release are owner-gated by issue #254.

## Maintenance rule

When accepted work changes the current state or dependency graph, update the affected canonical documentation in the same integration change or an explicitly linked documentation synchronization PR. Do not leave completed work described as future work or future work described as shipped.
