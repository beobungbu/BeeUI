# Anchored overlay contract

BeeUI treats anchored overlays as a different behavior class from centered modal overlays.

`Dialog` and `AlertDialog` may use React Native core `Modal` because they intentionally isolate a full-screen modal interaction. `Popover`, `DropdownMenu`, future `Select`, and future `Tooltip` require geometry tied to a trigger/anchor, collision behavior, nested-dismiss ordering, keyboard policy, focus/accessibility semantics, and a platform host strategy.

## Layer 1 — geometry kernel

`@beeui/core` owns pure `resolveAnchoredOverlayPosition()` geometry. It has no React, React Native, Expo, DOM, portal, gesture, or keyboard dependency.

The resolver accepts:

- anchor rectangle;
- measured overlay size;
- viewport rectangle, including non-zero origins;
- preferred side: `top`, `right`, `bottom`, or `left`;
- alignment: `start`, `center`, or `end`;
- LTR/RTL direction;
- side/alignment offsets;
- scalar or per-edge collision padding;
- independent `flip` and `shift` switches.

It returns finite coordinates, resolved placement, flip/shift flags, overflow metadata, and available space.

### Flip / shift policy

The preferred placement is evaluated first. The exact opposite side is considered only when the preferred candidate overflows, and wins only when its total overflow is lower.

Optional shifting then clamps the selected candidate into the padded viewport when physically possible. Oversized overlays pin to the minimum padded edge and report remaining overflow rather than producing unstable coordinates.

### RTL / invalid geometry

For top/bottom placements, horizontal `start`/`end` is logical and reverses in RTL. Vertical alignment for left/right placements does not reverse. `alignOffset` remains a physical axis offset.

Non-finite values normalize to finite safe values. Negative sizes/collision padding normalize to zero.

## Layer 2 — shared host/runtime

The accepted runtime layer is internal to `@beeui/ui` and installed by `BeeUIProvider`.

### Application-root host

`BeeUIProvider` owns one anchored-overlay runtime/host by default. Nested BeeUI providers reuse the existing runtime rather than creating another portal layer.

The host:

- renders above normal application content without using React Native core `Modal` as a positioning shortcut;
- remains measurable in window coordinates;
- preserves deterministic portal insertion order;
- removes entries on unmount;
- supports topmost-only dismissal coordination.

### Consumer React context

The overlay host is selected at runtime by `resolveOverlayHostMode()` so anchored content keeps its consumer context wherever the native portal is available:

- **Web** → the legacy store host. react-dom's portal already preserves context, and the native teleport host does not lay out anchored content on React Native Web.
- **Native + New Architecture, teleport host view registered** → the teleport host (`react-native-teleport`). Content stays in its source fiber tree, so consumer contexts declared between `BeeUIProvider` and the overlay resolve to the provided value inside `PopoverContent` / `DropdownMenuContent`. Verified on iOS and Android.
- **Native without the New Architecture, or when the native host view is not registered** → the legacy store host. It re-parents content under the application-root host, so consumer context is **not** preserved and resolves to defaults; a one-time development warning is logged. This is a graceful degradation, not a crash on a missing native view.

`react-native-teleport` is a peer dependency of `@beeui/ui`. Preserving context on native requires a native rebuild (not an over-the-air JS change) and `expo prebuild --clean` after adding the dependency so the native `PortalHostView` codegen is registered.

When the legacy host is in effect (web is unaffected; the concern is native without Fabric), the supported composition is unchanged:

- put providers required by portalled content at or above `BeeUIProvider`; or
- pass required values explicitly into portalled content.

Switching hosts preserves the accepted anchored-overlay semantics — non-modal positioning, geometry, nested/topmost dismissal, safe-area/keyboard policy, and accessibility contracts are unchanged, and BeeUI never silently falls back to a full-screen React Native `Modal`. The #35 regression contract covers host selection (`resolveOverlayHostMode`) and the legacy host's context boundary; teleport context preservation is verified on-device because JS-only test runtimes cannot exercise the native host.

### Measurement contract

Anchors and host use `measureInWindow` as the native coordinate source. Geometry resolves in window coordinates and translates to host-local coordinates only for rendering.

The runtime never assumes host origin `(0,0)`.

Remeasurement occurs on open and relevant window/keyboard environment changes. An explicit `remeasure()` seam exists for scroll/layout integrations. BeeUI does not continuously poll anchors at 60fps.

If an anchor becomes unavailable, the public component owns the product-specific response; current Popover/DropdownMenu close rather than keeping stale geometry.

### Safe-area / keyboard policy

The runtime reuses safe-area data already owned by `BeeUIProvider`. Collision padding is applied only for unsafe window edges that still intersect the overlay host, avoiding double insets.

Keyboard avoidance is explicit. Public components opt into keyboard-constrained viewport behavior only when their contract requires it.

### Dismiss stack

Dismissable overlays register in one deterministic stack.

- Android hardware back targets only the topmost dismissable overlay.
- Web Escape targets only the topmost dismissable overlay.
- Outside press may dismiss only the current stack owner.
- Nested overlays dismiss child-first.
- One event never cascades through several overlay levels.
- Updating an existing dismiss handler does not reorder the stack.

### Test-seam policy

Measurement overrides used in tests are internal implementation seams, never public fallback API.

## Public Popover

`Popover` uses the accepted shared geometry/runtime.

Contract:

- controlled `open` + `onOpenChange` or uncontrolled `defaultOpen`;
- button-compatible measured trigger;
- default bottom/center placement;
- finite offsets/collision padding;
- safe-area avoidance on by default;
- keyboard avoidance opt-in;
- flip/shift enabled;
- unresolved content stays offscreen/non-interactive until geometry resolves;
- anchor loss closes an open Popover;
- outside press / Android back / Web Escape / accessibility escape apply only to the topmost Popover;
- nested Popovers dismiss child-first;
- explicit `PopoverClose`;
- stable title/description accessibility metadata;
- non-modal behavior: no application-sibling hiding or focus-trap claim.

Automatic focus restoration and complete VoiceOver/TalkBack/keyboard behavior remain runtime/device gates.

## Public DropdownMenu

`DropdownMenu` reuses the same geometry/runtime/host/dismiss stack.

Contract:

- controlled and uncontrolled root state;
- measured button-compatible trigger;
- default bottom/start placement;
- safe-area collision handling and optional keyboard avoidance;
- unresolved geometry remains hidden/non-interactive;
- anchor loss closes the menu;
- topmost-only outside/back/Escape/accessibility dismissal;
- normal menu items close on selection by default;
- disabled items never activate;
- `onSelect` is the cross-input semantic selection callback;
- checkbox items expose controlled checked state;
- radio group/items coordinate one controlled value;
- checkbox/radio items remain open by default unless `closeOnSelect` is requested;
- duplicate radio values fail safe;
- labels/separators remain non-interactive;
- on Web, ArrowUp/ArrowDown/Home/End/Enter/Space use deterministic enabled-item navigation.

The current-item registry is navigation state only, not hidden application selection state.

Browser-grade focus restoration and final native keyboard/screen-reader parity remain runtime/device gates.

## Future anchored components

The next public anchored components remain `Select` and `Tooltip`, but the production roadmap now places context-preserving overlay transport investigation ahead of those components.

Each component must own its own semantics:

- Select owns option/value/selection behavior;
- Tooltip owns non-interactive hover/focus/touch/accessibility disclosure policy.

Do not implement either as a visual alias of DropdownMenu.

## Sheet boundary

`Sheet` remains a separate behavior class because gestures, snap points, keyboard interaction, safe-area behavior, scrolling, presentation, hardware back, and accessibility need stronger native runtime evidence than the centered Dialog kernel alone provides.

Sheet is a pre-1.0 roadmap item if BeeUI claims first-class modern mobile product coverage.

## Toast boundary

Toast v1 is already implemented through its own provider-scoped transient-notification runtime.

Toast is not anchor-positioned, does not use `OverlayPortal`, and does not use React Native core `Modal`. Future animation/swipe/custom-content work must preserve that separation unless new evidence justifies a different contract.

See `docs/toast.md`.

## Automated evidence

Current automated gates prove:

- strict TypeScript and behavioral contracts;
- geometry/runtime/Popover/DropdownMenu tests;
- package/release inclusion;
- Expo Web/Android/iOS bundling;
- Expo Prebuild;
- fresh package-installed bare RN Android/iOS Metro bundles;
- bare Android native compilation;
- deterministic Chromium visual regression for representative anchored states;
- native iOS Simulator compilation for both Expo Showcase and a fresh true bare RN consumer when the native gate is scheduled, and always on main pushes.

Native iOS compilation is **not** a remaining manual gate.

## Remaining runtime/device evidence

Automated compilation/pixel comparison still does not replace:

- simulator/device interaction around scrolling and anchor movement;
- non-zero safe areas during actual execution;
- VoiceOver/TalkBack;
- Popover focus restoration and keyboard-focus behavior;
- DropdownMenu focus restoration and final Web/native keyboard/screen-reader interaction;
- Android hardware-back interaction during real runtime flows;
- representative native visual placement across phone/tablet/reduced-height cases;
- future Select/Tooltip/Sheet component-specific runtime contracts.

The protected runtime simulator/device tier is tracked in `docs/roadmap.md`.
