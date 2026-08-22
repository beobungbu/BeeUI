# Anchored overlay contract

BeeUI treats anchored overlays as a different behavior class from centered modal overlays.

`Dialog` and `AlertDialog` may use React Native core `Modal` because they intentionally isolate a full-screen modal interaction. `Popover`, `DropdownMenu`, `Select`, and `Tooltip` instead need geometry tied to a trigger/anchor, collision behavior, nested-dismiss ordering, keyboard policy, focus/accessibility semantics, and a platform host strategy.

## Phase 1: geometry kernel

`@beeui/core` owns a pure `resolveAnchoredOverlayPosition()` helper. It has no React, React Native, Expo, DOM, portal, gesture, or keyboard dependency.

The resolver accepts:

- anchor rectangle
- measured overlay size
- viewport rectangle, including non-zero origins
- preferred side: `top`, `right`, `bottom`, or `left`
- alignment: `start`, `center`, or `end`
- LTR/RTL direction
- side offset and alignment offset
- scalar or per-edge collision padding
- independent `flip` and `shift` switches

The resolver returns:

- final finite `x` / `y`
- resolved placement and requested alignment
- whether a flip occurred
- whether a shift occurred
- overflow before shifting for the resolved side
- overflow after shifting
- available space on each side of the anchor

### Flip policy

The preferred placement is evaluated first. BeeUI only considers the exact opposite side when the preferred candidate overflows. The opposite side wins only when its total overflow is lower.

This makes placement deterministic and avoids side changes caused by tiny coordinate clamping. Future components may add a richer fallback list only through an explicit contract change.

### Shift policy

After placement is chosen, optional shifting clamps the overlay into the padded viewport when physically possible. Shift does not change the resolved placement label.

When the overlay is larger than the available viewport span, BeeUI pins it to the minimum padded edge and reports the remaining overflow instead of producing `NaN` or unstable coordinates.

### RTL policy

For top/bottom placements, horizontal `start`/`end` alignment is logical and therefore reverses in RTL. Vertical alignment for left/right placements does not reverse.

`alignOffset` remains a physical coordinate offset: positive values move right on the x axis or down on the y axis regardless of text direction.

### Invalid geometry

Non-finite positions, sizes, offsets, and padding are normalized to finite safe values. Negative sizes and collision padding normalize to zero. The geometry layer never emits `NaN`/`Infinity`.

## Phase 2: host and interaction kernel

Phase 1 does **not** make any anchored overlay component production-ready. Before BeeUI ships `Popover`, phase 2 must define and verify:

1. anchor measurement on native and web
2. overlay content measurement and remeasurement
3. viewport + safe-area + keyboard bounds
4. host/portal strategy without pretending a centered full-screen modal is positioning
5. outside-press and Escape/back dismissal ordering
6. nested overlay stack ownership
7. focus restoration / screen-reader semantics per platform
8. layout changes, rotation, scrolling, and anchor unmount behavior
9. deterministic test seams for measurement and host behavior

Only after that kernel is accepted should public components be layered in this order unless new evidence changes the plan:

1. `Popover`
2. `DropdownMenu`
3. `Select`
4. `Tooltip`

`Toast` is not anchor-positioned and should use its own transient-notification contract even though it also renders above application content.

## Non-goals of the geometry layer

The resolver does not:

- render anything
- own open/closed state
- measure native or DOM nodes
- listen to scroll, resize, orientation, or keyboard events
- decide focus behavior
- register dismissal listeners
- coordinate nested overlays
- choose z-index/elevation
- claim accessibility completeness

Those responsibilities intentionally remain outside `@beeui/core`.
