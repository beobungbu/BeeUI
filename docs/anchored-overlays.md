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

### Consumer React context (portal transport)

Overlay content is delivered to its host by a **portal transport** — the portal layer only. The runtime keeps geometry, dismissal, registration, and measurement; a transport decides *how* content travels from its declaration site to a host and whether the source React ancestry (consumer context) survives. `resolveOverlayTransport()` picks one `OverlayTransport` once per runtime, by platform and capability:

- **`web-dom`** — the web transport, backed by `ReactDOM.createPortal`. Content renders inline at its declaration site (keeping its source fiber tree and consumer context) while its DOM is portaled into the host element. This is the real context-preserving web path. Consumer context **is** preserved.
- **`native-teleport`** — native New Architecture with the `react-native-teleport` host view registered. `Portal` keeps content in its source fiber tree, so consumer contexts declared between `BeeUIProvider` and the overlay resolve to the provided value inside `PopoverContent` / `DropdownMenuContent`. Consumer context **is** preserved. Verified on iOS and Android.
- **`legacy`** — the defensive store-and-reparent fallback, used only when neither transport is available (a JS-only test env, or native without the New Architecture / with the host view unregistered). It stores content and re-renders it under the host, changing React ancestry, so consumer context is **not** preserved and resolves to defaults; a one-time development warning is logged. This is graceful degradation, not a crash on a missing native view.

The transport is chosen once and fixed for the lifetime of the runtime. The `transport` provider prop is an internal deterministic seam for injecting a transport before first render in contract tests; it is not a runtime hot-swap.

When the legacy fallback is in effect (web and native-Fabric are unaffected; the concern is native without Fabric), the supported composition is unchanged:

- put providers required by portalled content at or above `BeeUIProvider`; or
- pass required values explicitly into portalled content.

Every transport preserves the accepted anchored-overlay semantics — non-modal positioning, geometry, nested/topmost dismissal, safe-area/keyboard policy, and accessibility contracts are unchanged, and BeeUI never silently falls back to a full-screen React Native `Modal`. The #35 regression contract covers transport selection (`resolveOverlayTransport`), web `createPortal` context preservation (real-browser Playwright), the native teleport context path, and the legacy fallback's context boundary; native teleport context preservation is additionally verified on-device because JS-only test runtimes cannot exercise the native host.

#### Nearest-host scoping (root vs modal-local)

`OverlayPortal` targets the **nearest overlay host scope**, not always the application-root host:

- `BeeUIProvider` provisions the **root overlay host** (`beeui-overlay-root`) and scopes the whole app to it.
- A modal-class surface renders in its own native window, so `DialogContent` (and therefore `AlertDialog`) provisions a **modal-local host** via `ModalOverlayHost` and scopes its content to that host. Anchored overlays declared inside a Dialog — `Popover`, `DropdownMenu`, future anchored components — land in the modal-local host in the same window and render in front of the modal instead of behind it. This mechanism is generic: no component special-cases another. Dialog → Popover and Dialog → DropdownMenu are both proven (jest, Playwright, iOS, Android).

The legacy fallback preserves portal **insertion order** across independent content updates: updating one mounted portal never re-registers it, so it keeps its z-order and stays aligned with the dismiss stack's topmost tracking.

#### `react-native-teleport` and the `react-dom` peer

`react-native-teleport` is a peer dependency of `@beeui/ui`. Preserving context on native requires a native rebuild (not an over-the-air JS change) and `expo prebuild --clean` after adding the dependency so the native `PortalHostView` codegen is registered.

The `react-dom` peer needs a precise reading:

- BeeUI's **own** runtime uses `react-dom` only for the web (`createPortal`) transport, so `@beeui/ui` marks its direct `react-dom` peer **optional**.
- However, `react-native-teleport` itself declares `react` **and** `react-dom` (and `react-native`) as its own peers. A strict package manager may therefore still require a matching `react-dom` installation **even in a native-only consumer**, resolved transitively through teleport rather than through BeeUI's optional peer.
- BeeUI's bare-native consumer smoke installs a matching `react-dom` for exactly this reason.
- This dependency shape should be re-evaluated before public npm distribution.

So `react-dom` is not a BeeUI **native runtime** dependency (BeeUI's native code never imports it), but it is not simply "web-only" from a package-resolution standpoint while teleport peers on it.

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

#### Child-first dismissal inside a Dialog: outside press vs Android hardware back

"Child-first" for an anchored overlay declared inside a `Dialog` is delivered by two different mechanisms, because the input paths differ:

- **Outside press** — the anchored overlay's own dismiss layer is topmost and consumes the press, so tapping outside the overlay (but still inside the dialog) dismisses the overlay first; the dialog stays open. Handled by the shared dismiss stack's topmost rule.
- **Android hardware back** — React Native `Modal` **suppresses the root `BackHandler` while open**, so hardware back never reaches the root dismiss stack; it arrives only through `Modal.onRequestClose`. `DialogContent` therefore keeps a **modal-local dismissal scope** (provisioned with the modal-local host): anchored overlays declared inside the dialog register there too, and `onRequestClose` dismisses that scope's topmost anchored child with reason `back` and consumes the event, only closing the Dialog when no modal-local child remains. A root overlay *behind* the dialog is a different scope and never consumes the dialog's back event. `AlertDialog` inherits this (its `cancelOnRequestClose` policy applies only once no child remains). Web Escape and outside press are unchanged.

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

The next public anchored components remain `Select` and `Tooltip`. The context-preserving overlay transport that previously blocked them is now delivered (Wave 1A): web `createPortal`, native teleport, generic modal-local scoping, and the legacy fallback contract are all proven.

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
