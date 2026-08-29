# BeeUI 1.0 Decision Record Template

Use this structure for ADR/decision issues such as runtime behavior, compatibility, Sheet dependency strategy, Table architecture, date/time architecture, distribution, and owner-gated policy packets.

## Context

What current implementation/problem/evidence requires a decision?

## Constraints

List platform, compatibility, accessibility, source-ownership, dependency, performance, release and non-goal constraints.

## Options considered

For each serious option:

- design summary;
- benefits;
- risks/tradeoffs;
- Web/iOS/Android implications;
- dependency/package/registry impact;
- accessibility/RTL/large-text/reduced-motion impact;
- migration/semver impact;
- testing/runtime evidence required.

## Decision

State one selected contract, or `OWNER_ACTION_REQUIRED` when the final choice belongs to the owner.

## Rejected alternatives

Record why plausible alternatives were rejected so later agents do not re-litigate them without new evidence.

## Implementation consequences

List exact downstream issues/contracts that this decision unblocks or changes.

## Verification plan

Define deterministic, browser, visual, native runtime, assistive-tech, clean-consumer or performance evidence required.

## Revisit trigger

State concrete evidence/change that would justify revisiting the decision.
