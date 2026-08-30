# ADR-010: Adaptive Select presentation (Sheet) — not required for BeeUI 1.0

Status: Accepted

## Context

#162 (R4C, parent #114) asks BeeUI to "evaluate and, if accepted, add an additive
Select presentation policy such as `popover | sheet | dialog | auto`" now that Sheet
(#156-#161, native `@gorhom/bottom-sheet` engine per
[ADR-006](006-sheet-gesture-engine.md)) is merged. The issue's own "1.0 status" section
states the default: "This is P1 and may be omitted if current anchored native Select
remains the accepted 1.0 policy. Record an explicit decision either way." #162 is grouped
with #163 (Slider) under `docs/roadmap.md:222-226` ("R4C/R4D — explicit optional
decisions") — a category distinct from the hard 1.0 requirements enumerated in #114
(Tooltip, Sheet/BottomSheet, Table/DataTable, Calendar/DatePicker/DateTimePicker). Select
itself already shipped as a hard 1.0 component with the anchored (popover-style) overlay
presentation on both Web and native.

`docs/components.md:199` already records the current, accepted native Select policy in
plain terms: "v1 deliberately keeps the same anchored presentation rather than ...
adding a Bottom Sheet dependency." `docs/components.md:205` already anticipates the exact
future this issue proposes and pre-specifies its constraint: "A future Sheet presentation
may be added behind a presentation policy without changing `value`, `defaultValue`,
`onValueChange`, item values, selected state, or group semantics." `ADR-006` independently
cites this same Select precedent when explaining why Sheet does not force a Web
drag-to-dismiss parity claim (`docs/decisions/006-sheet-gesture-engine.md:154-159`).

No product/competitive evidence promoting an adaptive `sheet`/`dialog`/`auto` presentation
policy for Select exists anywhere in this repository: no market research doc, no
user-research finding, no competitive-analysis note, and no open issue/comment argues a
concrete consumer need distinct from the already-shipped anchored presentation. This
mirrors #163's own resolution: `ADR-009` (`docs/decisions/009-slider-1-0-decision.md`)
deferred Slider on the identical "P1 stretch unless product/competitive evidence promotes
it" default, with no evidence found. #162 states the same conditional default for Select
presentation.

## Constraints

- **DoD from #162**: "Record an explicit decision either way" — either implement the
  additive presentation policy to the issue's stated requirements (single-source
  selection logic, unchanged controlled/uncontrolled value/open contracts, deterministic
  documented `auto`, presentation-appropriate a11y/focus/back/dismiss, anchored Select
  remaining a valid explicit option, registry/docs/agent metadata updates) or record that
  the current anchored policy remains accepted for 1.0.
- **Evidence bar**: per #162's own text, promoting this from optional to required needs a
  concrete product/competitive signal — a product-scope judgment, not a technical
  one. No such evidence currently exists in this repository.
- **Non-goal**: this ADR does not evaluate the future policy's technical contract (prop
  shape of `popover | sheet | dialog | auto`, per-platform `auto` resolution, presentation
  swap logic) — that contract is fully specified already in #162's issue body and remains
  available unchanged if the decision is revisited.

## Options considered

### A. Implement the adaptive presentation policy now

- **Design summary**: add a `presentation` prop (`popover | sheet | dialog | auto`) to
  `Select`, keep `SelectRootContext`'s value/open/selection state as the single source of
  truth, and render `SelectContent` through either the existing anchored overlay runtime
  or through `Sheet`/`Dialog` depending on the resolved presentation, with a documented
  per-platform `auto` default (e.g. anchored popover on Web, Sheet on native handheld
  form factors).
- **Benefits**: gives native consumers a bottom-sheet-style Select consistent with common
  native OS pickers; closes a real design-system gap if that need exists.
- **Risks/tradeoffs**: no consumer, product research, or competitive signal in this
  repository currently justifies the scope; Select is an already-shipped, semver-governed
  public component, so an additive `presentation` prop, its `auto` platform/form-factor
  matrix, and its own accessibility/back/dismiss contract per presentation become a new
  permanent surface to test and maintain (RTL, keyboard, VoiceOver/TalkBack, reduced
  motion, Sheet's own gorhom dependency chain) without demonstrated demand; speculative
  scope trimmed under time pressure risks exactly the kind of ambiguous partial surface
  the sibling #163 DoD explicitly forbade for Slider, and #162's own text allows omission
  precisely when the current anchored policy remains accepted.
- **Web/iOS/Android implications**: Web keeps the anchored popover (no Sheet dependency
  introduced there, consistent with `docs/components.md:196` and ADR-006); native gains a
  second rendering path (`Sheet`) that must reuse `SelectContent`'s existing
  keyboard/typeahead/scroll-to-selection logic without duplicating it, plus its own
  runtime-evidence class (gorhom native gesture/dismiss behavior) distinct from the
  already-accepted anchored-overlay evidence.
- **Dependency/package/registry impact**: `select` would gain a new optional dependency
  edge onto `sheet` (and therefore, transitively, onto Reanimated/Gesture
  Handler/`@gorhom/bottom-sheet` for consumers who opt into `sheet`/`auto` presentation on
  native) — a new registry relationship that must be modeled and tested for correctness
  (consumers who never request Sheet presentation must not pull those peers in).
- **Accessibility/RTL/large-text/reduced-motion impact**: full new a11y/dismiss contract
  per presentation to build and verify from scratch on top of the already-accepted
  anchored contract.
- **Migration/semver impact**: additive, but the new prop, its `auto` resolution table,
  and its presentation-specific a11y contract become permanent public surface the moment
  they ship.
- **Testing/runtime evidence required**: full deterministic + Web + native runtime-smoke
  matrix per presentation value, plus a `sheet`-dependency registry-consistency check.

### B. Defer the adaptive presentation policy — anchored Select remains the accepted 1.0 policy (selected)

- **Design summary**: record an explicit decision that Select's current anchored overlay
  presentation remains the accepted policy for BeeUI 1.0 on both Web and native. No
  `presentation` prop, no Sheet-backed rendering path, no registry/dependency change to
  `select`.
- **Benefits**: matches #162's own stated default ("may be omitted if current anchored
  native Select remains the accepted 1.0 policy"); consistent with the already-documented,
  already-shipped native policy (`docs/components.md:199`) and with the forward-compatible
  seam that policy already reserves (`docs/components.md:205`); avoids adding an
  unrequested public prop and a new optional-dependency edge from `select` onto `sheet`
  that would need semver maintenance without demonstrated need; keeps 1.0 scope focused on
  the enumerated hard requirements; mirrors the identical, already-accepted resolution for
  the sibling gate #163/ADR-009.
- **Risks/tradeoffs**: a real native-picker-parity need could emerge post-1.0; mitigated
  by the Revisit trigger below and by the fact that the full technical contract remains
  specified in #162's issue body, plus the exact non-breaking seam
  (`docs/components.md:205`) that a future implementation must honor.
- **Web/iOS/Android implications**: none — no new surface; current anchored behavior on
  both platforms is unchanged.
- **Dependency/package/registry impact**: none — `select`'s registry entry gains no new
  dependency edge onto `sheet`.
- **Accessibility/RTL/large-text/reduced-motion impact**: none introduced or deferred as a
  liability, since nothing ships.
- **Migration/semver impact**: none.
- **Testing/runtime evidence required**: none (doc-only decision).

## Decision

**The adaptive Select presentation policy (`popover | sheet | dialog | auto`) is not
required for BeeUI 1.0.** Anchored presentation remains the accepted policy for `Select`
on both Web and native for 1.0. No `presentation` prop, Sheet-backed rendering path,
registry entry, or dependency edge from `select` onto `sheet` ships in 1.0.
`docs/roadmap.md` and `docs/beeui-1.0-sequence.md` are updated to mark #162 decided, and
#114's `R4C/R4D optional decisions` checklist item for #162 is marked closed with this
outcome.

This is a technical/evidence-based application of #162's own stated default ("may be
omitted if current anchored native Select remains the accepted 1.0 policy"), not a new
business judgment: no promoting product/competitive evidence exists in the repository,
and the project already documented (`docs/components.md:199,205`) and already applied
(ADR-006) the assumption that Select stays anchored-only for 1.0 while explicitly
reserving a non-breaking seam for a future Sheet presentation.

## Rejected alternatives

Option A (implement now) is rejected: it inverts #162's own default without the evidence
the issue requires to do so, and would add an unrequested public prop plus a new
optional-dependency edge from `select` onto `sheet` that must then be carried under semver
indefinitely.

## Implementation consequences

- No downstream issue is unblocked or changed; #162 was a leaf decision gate.
- `docs/roadmap.md:224` and `docs/beeui-1.0-sequence.md:102` record the decided outcome.
- #114's workstream checklist marks #162 closed with this outcome.
- `packages/ui/src/components/select.tsx` and `docs/components.md`'s existing Select
  section are unchanged: the forward-compatible seam already documented at
  `docs/components.md:205` remains the specification for any future implementation.
- Future work proposing an adaptive Select presentation must open a new issue citing the
  concrete product/competitive evidence and may reuse #162's original requirements list
  unchanged, honoring the same single-source-selection-logic and
  unchanged-value/open-contract constraints.

## Verification plan

None required — doc-only decision, no runtime/build/test surface changes. No `select.tsx`,
registry, gallery, or export files are touched.

## Revisit trigger

Revisit this decision if a concrete product/competitive signal emerges post-1.0: a real
consumer request tied to a shipped native-picker use case, a direct competitor comparison
showing anchored-only Select as a blocking gap, or an accepted product-roadmap item that
depends on Sheet-backed Select. Any revisit reuses #162's already-specified requirements
list and the non-breaking seam at `docs/components.md:205` rather than re-deriving them.
