# BeeUI 1.0 Independent Review Checklist

Use this checklist when independently reviewing a BeeUI 1.0 implementation PR after the implementation agent has completed mandatory self-test and self-review.

Self-review by the implementation agent is necessary but does not satisfy this independent-review gate.

## 1. Identity and base

- PR links the assigned issue.
- Exact base SHA is stated and matches the claimed dependency state.
- Exact head SHA is stated.
- Required CI/evidence belongs to that exact head, not an older commit.
- Sibling/unmerged work is not silently assumed.

## 2. Scope

- Every issue DoD item is addressed.
- No unrelated refactor or feature creep.
- New reusable behavior belongs in BeeUI rather than application/pattern-local code.
- Explicit out-of-scope items remain out of scope.

## 3. Architecture

- Existing BeeUI authorities are reused rather than duplicated.
- No duplicate theme/overlay/focus/direction/state runtime.
- Platform differences are intentional and coherent.
- Router/backend/data/auth/payment/form-library ownership boundaries remain correct.
- Dependencies are justified, bounded, declared and represented in package/registry contracts.

## 4. API and compatibility

- Public API shape/defaults are intentional.
- Controlled/uncontrolled behavior and delayed-parent updates are safe.
- No accidental deep/private export.
- Peer/version claims do not exceed the tested compatibility matrix.
- Semver/migration impact is identified.

## 5. Accessibility and responsive behavior

When applicable, review:

- roles/names/states/descriptions;
- keyboard/focus order/restoration/Escape;
- VoiceOver/TalkBack semantics;
- RTL/logical start/end behavior;
- large text / 200% zoom;
- high contrast;
- reduced motion;
- minimum touch targets;
- mobile-first/narrow/short-height behavior;
- safe area and keyboard interaction.

## 6. Runtime correctness

When applicable, inspect:

- cleanup/unmount/close;
- stale async callbacks;
- latest-request-wins/supersession;
- races/ABA;
- duplicate registrations/listeners;
- Android Back / native presentation behavior;
- gesture/scroll/keyboard interaction;
- no compile-only evidence used to claim runtime correctness.

## 7. Tests

- Targeted tests cover the actual risk.
- Regression tests are load-bearing.
- No arbitrary sleeps where deterministic control is feasible.
- Real browser/native/runtime evidence exists when required.
- Skipped checks are explicitly justified rather than counted green.

## 8. Distribution and source ownership

When applicable:

- no `workspace:*`/private-monorepo leakage;
- public exports and registry are synchronized;
- packed artifacts/clean consumers are tested;
- generated metadata/docs/AI corpus match the stable API;
- publication-ready wording does not imply already published.

## 9. Hygiene

- `git diff --check` clean;
- no accidental executable-bit/file-mode change;
- EOF newlines present;
- no temp files/logs/debug statements/secrets;
- generated artifacts byte-current;
- changelog/docs updated when current-state behavior changed.

## 10. Decision

Use one of:

- `APPROVE` — ready for integration/merge by an authorized integrator.
- `REQUEST_CHANGES` — concrete blocker(s) with required fix/evidence.
- `BLOCKED` — dependency/environment/owner action prevents a valid decision.

Do not merge as part of the review unless separately and explicitly authorized.
