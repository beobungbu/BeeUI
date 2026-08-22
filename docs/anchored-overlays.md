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

The resolver returns final finite coordinates, resolved placement, flip/shift flags, pre-shift and final overflow, and available space on each side of the anchor.

### Flip and shift policy

The preferred placement is evaluated first. BeeUI only considers the exact opposite side when the preferred candidate overflows. The opposite side wins only when its total overflow is lower.

After placement is chosen, optional shifting clamps the overlay into the padded viewport when physically possible. Shift does not change the resolved placement label. When the overlay is larger than the available span, BeeUI pins it to the minimum padded edge and reports the remaining overflow instead of producing unstable coordinates.

### RTL and invalid geometry

For top/bottom placements, horizontal `start`/`end` alignment is logical and reverses in RTL. Vertical alignment for left/right placements does not reverse. `alignOffset` remains a physical axis offset.

Non-finite positions, sizes, offsets, and padding normalize to finite safe values. Negative sizes and collision padding normalize to zero. The geometry layer never emits `NaN`/`Infinity`.

## Phase 2: host and interaction kernel

Phase 2 is accepted as the shared runtime layer that public anchored components use. It deliberately remains internal to `@beeui/ui`; applications do not compose its primitives directly.

### Application-root host

`BeeUIProvider` owns one anchored-overlay runtime and one native host by default. Nested BeeUI providers reuse the existing runtime rather than adding another portal layer.

The host:

- renders above normal application content without using React Native core `Modal` as a positioning shortcut
- is `collapsable={false}` so native window measurement remains available
- tracks host geometry in window coordinates
- preserves portal insertion order when existing entries update
- removes portal entries on unmount

### Measurement contract

Anchors and the host use `measureInWindow` as the native coordinate source. Geometry is resolved in window coordinates and translated to host-local coordinates only for rendering.

The runtime does not assume the host begins at `(0,0)`. A host embedded below another shell can therefore position an anchor correctly without mixing coordinate spaces.

Remeasurement happens when an anchored overlay opens and when relevant window/keyboard environment changes. The positioning hook also exposes explicit `remeasure()` for scroll/layout integrations. BeeUI does not continuously poll anchors at 60fps.

If an anchor becomes unavailable, the hook reports that condition to the owning public component. The public component decides whether to close, retry, or apply a product-specific fallback.

### Safe-area and keyboard policy

The runtime reuses safe-area data already owned by `BeeUIProvider`. Safe-area collision padding is applied only where an unsafe window edge still intersects the overlay host; a host already inset away from that edge is not padded twice.

Keyboard avoidance is explicit. Public components opt into a keyboard-constrained viewport when their interaction requires it. BeeUI does not force keyboard avoidance for every anchored overlay.

### Dismiss stack

Dismissable overlays register in one deterministic stack.

- Android hardware back targets only the current topmost dismissable overlay.
- Web Escape targets only the current topmost dismissable overlay.
- Outside-press dismissal succeeds only for the overlay that owns the top of the stack.
- Nested overlays therefore dismiss child-first.
- One back/Escape/outside event never cascades through multiple overlay levels.
- Updating an existing dismiss handler does not move that overlay in the stack.

### Test seam policy

Measurement overrides used by tests are internal implementation seams, not public API. Production positioning continues to depend on real window-coordinate measurement rather than falling back to relative layout coordinates when those spaces are not equivalent.

## Phase 3: public anchored components

### `Popover`

`Popover` is the first public consumer of the accepted anchored-overlay kernels.

Its contract is:

- controlled mode requires `open` + `onOpenChange`; uncontrolled mode supports `defaultOpen`
- `PopoverTrigger` is a BeeUI button-compatible anchor, toggles the open state, preserves caller accessibility state, exposes `expanded`, and links to content with the typed `aria-controls` surface available in React Native 0.86
- `PopoverContent` defaults to `bottom` / `center`, side offset `8`, collision padding `8`, safe-area avoidance on, keyboard avoidance off, and flip/shift on
- content renders through the shared application-root overlay host and never uses React Native core `Modal` for positioning
- unresolved content measures invisibly offscreen and is non-interactive until a real anchored position resolves; it does not intentionally flash at `(0,0)`
- an unavailable anchor closes an open Popover rather than retaining stale geometry
- outside press, Android hardware back, Web Escape, and accessibility escape may close only the current topmost Popover
- nested Popovers therefore dismiss child-first
- `PopoverClose` is an explicit close action
- `PopoverTitle` and `PopoverDescription` register stable native IDs and primitive-text fallbacks used as content accessibility label/hint unless callers provide explicit accessibility text
- Popover is non-modal: it does not hide the rest of the application, set modal accessibility isolation, or claim a browser-style focus trap

`PopoverContent` exposes placement/alignment/offset/collision, RTL direction, flip/shift, safe-area policy, and opt-in keyboard avoidance while keeping the runtime implementation internal.

Automatic focus restoration, full keyboard focus management, and final VoiceOver/TalkBack behavior remain release/device gates rather than automated-Linux claims.

### Remaining order

The next public anchored components remain:

1. `DropdownMenu`
2. `Select`
3. `Tooltip`

Each public component owns its semantic contract instead of treating Popover visuals as sufficient behavior. In particular, menu/select keyboard navigation and option semantics must be specified separately.

`Toast` is not anchor-positioned and should use its own transient-notification contract even though it also renders above application content.

## Remaining release/device gates

The automated Linux suite proves deterministic geometry/runtime/Popover behavior, package inclusion, Expo exports/prebuild, bare React Native Metro bundling, and Android native compilation. It does not replace:

- native iOS binary compilation on macOS
- simulator/device interaction around scrolling and anchor movement
- VoiceOver/TalkBack verification
- Popover focus restoration and web/native keyboard focus behavior
- visual placement review across representative phone/tablet sizes

Those gates attach to the public component that depends on them rather than reopening the accepted geometry/runtime kernels without new evidence.
