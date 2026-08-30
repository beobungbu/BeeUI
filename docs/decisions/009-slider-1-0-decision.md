# ADR-009: Slider — not required for BeeUI 1.0

Status: Accepted

## Context

#163 (R4D, parent #114) requires an explicit pre-1.0 decision on `Slider`. The issue's
own objective states the default: "Slider is P1 stretch unless product/competitive
evidence promotes it." #163 is grouped with #162 under `docs/roadmap.md:214-217`
("R4C/R4D — explicit optional decisions") — a category distinct from the hard 1.0
requirements enumerated in #114 (Tooltip, Sheet/BottomSheet, Table/DataTable,
Calendar/DatePicker/DateTimePicker). `Slider` does not appear in that hard-requirement
list.

No `Slider` component exists in the source tree
(`packages/ui/src/components` has no `slider.tsx`/`slider.web.tsx`/`slider.native.tsx`),
and no product/competitive evidence promoting it exists anywhere in the repo: no market
research doc, no user-research finding, no competitive-analysis note, and no open
issue/comment argues a concrete consumer need. `docs/components.md:140` already states
the accepted roadmap position prospectively: "add `Slider` and later high-value
components only when cross-domain evidence supports them" — i.e. evidence-gated, not
scheduled.

The accepted, merged `docs/decisions/008-datetime-architecture.md` (ADR-008, #171,
PR #310) goes further and treats the outcome as settled fact: it explicitly rejects a
"Slider-style time wheel" for `DateTimePicker` time entry "consistent with #163's
rejection of a partial `Slider`" (ADR-008 lines 92, 428), and instead ships time entry
as `Input` digit-entry + `SegmentedControl` for AM/PM. That ADR was independently
reviewed and merged by the repository owner without objection to this framing,
confirming the project's already-accepted direction.

## Constraints

- **DoD from #163**: "Either a stable, fully tested/registered/documented Slider ships,
  or #114 records an accepted not-required-for-1.0 decision. Do not leave ambiguous
  partial code." No partial/experimental Slider code may exist in any package, registry,
  gallery, or export surface.
- **Evidence bar**: per #163's own text, promoting Slider to required requires
  "product/competitive evidence" — a product-scope judgment, not a technical one. No such
  evidence currently exists in this repository.
- **Non-goal**: this ADR does not evaluate a future Slider's technical contract (range
  values, thumb hit target, drag physics) — that work is fully specified already in
  #163's issue body and remains available unchanged if the decision is revisited.

## Options considered

### A. Implement Slider now to the issue's minimum contract

- **Design summary**: build a cross-platform `Slider` (controlled/uncontrolled value,
  min/max/step normalization, RTL, touch drag/tap, Web keyboard, native
  increment/decrement accessibility actions, disabled state, minimum thumb hit target,
  reduced motion) and register/export/document it.
- **Benefits**: closes a common design-system gap; no future re-litigation.
- **Risks/tradeoffs**: no consumer, product research, or competitive signal currently
  justifies the scope; speculative build risks exactly the "ambiguous partial code" the
  DoD forbids if scope is trimmed under time pressure; adds a new public API,
  registry/gallery surface, and test/a11y/RTL matrix with no demonstrated demand,
  contradicting the issue's own "P1 stretch unless evidence promotes it" default and the
  project's stated evidence-gated roadmap policy (`docs/components.md:140`).
- **Web/iOS/Android implications**: full new cross-platform surface (drag gesture on
  native, pointer/keyboard on Web) with its own compatibility-matrix row.
- **Dependency/package/registry impact**: new component in `packages/ui`, new registry
  entry, new gallery entry, new docs page.
- **Accessibility/RTL/large-text/reduced-motion impact**: full new a11y/RTL/reduced-motion
  contract to build and verify from scratch.
- **Migration/semver impact**: none (additive), but a shipped public API becomes a
  semver-governed surface immediately.
- **Testing/runtime evidence required**: full unit/Web/native runtime-smoke/a11y suite.

### B. Defer Slider — not required for 1.0 (selected)

- **Design summary**: record an explicit, evidence-mapped decision that Slider remains
  P1 stretch and out of BeeUI 1.0 scope. No code, registry, gallery, or export change.
- **Benefits**: matches the issue's own default; consistent with the already-accepted
  ADR-008 framing and `docs/components.md`'s evidence-gated roadmap; avoids shipping a
  speculative public API that would need to be semver-maintained without demonstrated
  need; keeps 1.0 scope focused on the enumerated hard requirements.
- **Risks/tradeoffs**: a real consumer need could emerge post-1.0; mitigated by the
  Revisit trigger below and by the fact that the full technical contract remains
  specified in #163's issue body, unchanged and ready to implement when evidence exists.
- **Web/iOS/Android implications**: none — no new surface.
- **Dependency/package/registry impact**: none.
- **Accessibility/RTL/large-text/reduced-motion impact**: none introduced or deferred as
  a liability, since nothing ships.
- **Migration/semver impact**: none.
- **Testing/runtime evidence required**: none (doc-only decision).

## Decision

**Slider is not required for BeeUI 1.0.** No Slider component, registry entry, gallery
entry, export, or partial implementation ships in 1.0. `docs/roadmap.md` and
`docs/beeui-1.0-sequence.md` are updated to mark #163 decided, and #114's
`R4C/R4D optional decisions` checklist item for #163 is marked closed with this outcome.

This is a technical/evidence-based application of #163's own stated default ("P1 stretch
unless product/competitive evidence promotes it"), not a new business judgment: no
promoting evidence exists in the repository, and the project has already built and merged
downstream architecture (ADR-008) on the assumption that Slider stays out of 1.0.

## Rejected alternatives

Option A (implement now) is rejected: it inverts the issue's own default without the
evidence the issue requires to do so, and would add an unrequested public API surface
that must then be carried under semver indefinitely.

## Implementation consequences

- No downstream issue is unblocked or changed; #163 was a leaf decision gate.
- `docs/roadmap.md:217` and `docs/beeui-1.0-sequence.md:103` record the decided outcome.
- #114's workstream checklist marks #163 closed with this outcome.
- Future work proposing a Slider must open a new issue citing the concrete
  product/competitive evidence and may reuse #163's original minimum-contract
  specification unchanged.

## Verification plan

None required — doc-only decision, no runtime/build/test surface changes. `git diff
--check` clean; no code, registry, gallery, or export files touched.

## Revisit trigger

Revisit this decision if a concrete product/competitive signal emerges post-1.0: a real
consumer request tied to a shipped use case, a direct competitor comparison showing
Slider as a blocking gap, or an accepted product-roadmap item that depends on it. Any
revisit reuses #163's already-specified minimum contract rather than re-deriving it.
