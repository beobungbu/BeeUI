# Anchored overlay contract

BeeUI treats anchored overlays as a different behavior class from modal surfaces.

`Dialog` and `AlertDialog` may use React Native core `Modal` because they intentionally isolate modal interaction. `Popover`, `DropdownMenu`, future `Select`, and future `Tooltip` require geometry tied to a trigger/anchor, collision behavior, nested-dismiss ordering, keyboard policy, focus/accessibility semantics, and a platform host strategy.

## Layer 1 — geometry kernel

`@beemvp/beeui-core` owns pure `resolveAnchoredOverlayPosition()` geometry. It has no React, React Native, Expo, DOM, portal, gesture, or keyboard dependency.

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

The accepted runtime layer is internal to `@beemvp/beeui-ui` and installed by `BeeUIProvider`.

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

- **`web-dom`** — the web transport, backed by `ReactDOM.createPortal`. Content keeps its source fiber tree and consumer context while its DOM is portaled into the host element. Consumer context **is** preserved.
- **`native-teleport`** — native New Architecture with the `react-native-teleport` host view registered. Consumer context **is** preserved. This path has on-device context evidence on iOS and Android.
- **`legacy`** — defensive store-and-reparent fallback when the native teleport capability is unavailable/stale or in JS-only test environments. It changes React ancestry, so arbitrary consumer context is **not** preserved. It is graceful degradation, not a recommended deployment mode.

The transport is chosen once and fixed for the lifetime of the runtime. The `transport` provider prop is an internal deterministic seam for tests, not a runtime hot-swap.

When the legacy fallback is in effect:

- put providers required by portalled content at or above `BeeUIProvider`; or
- pass required values explicitly into portalled content.

Every transport preserves the accepted non-modal geometry/dismissal contract; BeeUI never silently converts an anchored overlay into React Native core `Modal`.

Uniwind's `ScopedTheme` (wrapped by BeeUI's `BeeThemeScope`, #68) is a plain React context provider, so a scoped theme follows exactly the same per-transport rule as any other consumer context above. See [`docs/theme-scope.md`](./theme-scope.md#portals-and-overlays-dialog-popover-dropdownmenu-select) for the theme-specific proof.

#### Overlay scope model (host · geometry · dismissal)

An anchored overlay resolves against the **nearest `OverlayScope`**. `BeeUIProvider` provisions the root scope; each modal-class surface (`DialogContent`, and therefore `AlertDialog`) provisions a modal-local scope via `ModalOverlayHost`. The mechanism is generic for future anchored components.

Each scope owns:

1. **Host** — the portal destination. A modal-local host sits in the same native Modal window as its Dialog, so nested anchored content renders in front of that modal.
2. **Geometry** — the measured destination-host rectangle in window coordinates. Window-space anchor/solution is translated by the nearest host origin; safe-area/collision policy uses that same host rectangle.
3. **Dismissal** — a stable per-scope dismiss controller/stack. Geometry updates do not change controller identity or reorder open overlays.
4. **Semantic depth** — root is depth `0`; every modal boundary increments the nearest parent scope depth. Global dismissal selects the deepest active scope first, so correctness does not depend on React layout-effect execution order. Same-depth siblings use activation order only as a tie-breaker.

This depth rule is important for initial-render `defaultOpen` and nested-modal composition: descendants may run layout effects before ancestors, but the visual/modal hierarchy still wins.

Global dismiss events (Web Escape and Android root back when no RN Modal suppresses it) dispatch within the application runtime to the deepest active scope. Per-overlay outside press/accessibility escape routes directly through the nearest scope.

#### Platform request-close semantics

Hardware/native modal dismissal is platform-specific:

- **Android hardware back** — RN `Modal` suppresses the root `BackHandler`, so back reaches BeeUI through `Modal.onRequestClose`. `DialogContent` intercepts it on Android only: modal-local anchored child first, Dialog second.
- **iOS / other platforms** — `onRequestClose` can represent native dismissal itself, including sheet swipe dismissal. BeeUI does not child-intercept that request; the Dialog close policy applies directly.

`onRequestClose` fires exactly once per native request and remains disjoint from backdrop/accessibility-close paths. `AlertDialog` keeps its request-close policy once no child remains.

#### Modal presentation geometry

`DialogContent` defaults to `presentationStyle="overFullScreen"`. BeeUI sets RN `Modal.transparent=true` **only** for `overFullScreen`; `fullScreen`, `pageSheet`, and `formSheet` use `transparent=false` so React Native can honor the requested native presentation instead of coercing it back to `overFullScreen`.

Anchored children still resolve against the measured modal-local host. Non-zero-origin sheet geometry, host-move remeasurement, and iOS request-close policy are covered deterministically. Live `pageSheet`/`formSheet` interaction/placement/swipe acceptance on iOS Simulator/device remains a Wave 1B runtime gate and must not be inferred from Jest alone.

The legacy fallback preserves portal insertion order across independent content updates and regains content across an independent host-outlet remount while keeping dynamic host bookkeeping bounded.

#### `react-native-teleport` and the `react-dom` peer

`react-native-teleport` is a peer dependency of `@beemvp/beeui-ui`. Preserving context on native requires a native rebuild and `expo prebuild --clean` after adding the dependency so the native host codegen is registered.

BeeUI's own runtime imports `react-dom` only in the web transport, so BeeUI marks its direct `react-dom` peer optional. `react-native-teleport` itself peers on `react-dom`, however, so strict package managers may still require a matching installation even in a native-only consumer; the bare-native smoke installs one for that reason.

#### Web platform-file resolution and distribution scope

The transport ships as `overlay-transport.web.tsx`, `overlay-transport.native.tsx`, and a types-only `overlay-transport.d.ts`. The current proven Web environment is **Expo Web / current Metro**, whose resolver includes `web` platform files.

Arbitrary React Native Web/generic bundlers and public npm conditional exports remain distribution-hardening work. BeeUI packages are still private/source-consumed; docs must not imply a wider resolver guarantee.

### Measurement contract

Anchors and hosts use `measureInWindow` as the native coordinate source. Geometry resolves in window coordinates and translates to host-local coordinates only for rendering. The runtime never assumes host origin `(0,0)`.

Native `measureInWindow` callbacks are asynchronous. Host and anchor measurement therefore use a **latest-request-wins generation guard**:

- starting a newer measurement invalidates older in-flight callbacks;
- an older callback resolving later cannot overwrite a newer rectangle;
- a stale invalid/unavailable anchor result cannot spuriously close an overlay after a newer successful measurement;
- close/unmount invalidates outstanding anchor measurements.

Remeasurement occurs on open, relevant window/keyboard changes, and nearest-host geometry revision. An explicit `remeasure()` seam exists for scroll/layout integrations. BeeUI does not poll at 60fps.

A measurement that never resolves — on either the anchor or the host path — is bounded by the completion budget (ADR-003, `docs/decisions/003-native-measurement-timeout.md`), not left "eternally pending" (issue #59). A scheduled `measureInWindow` whose callback is dropped — a detached/recycled native view or a bridge failure — is retired when the budget elapses via a frame-tick watchdog, reusing the same latest-request-wins generation (and, for anchors, host-revision) guard that already rejects a stale successful callback, so a superseded, closed/unmounted, or host-revised request cannot fire a spurious terminal action:

- **Anchor path**: a timed-out request is routed through `onAnchorUnavailable` exactly as a synchronously unavailable anchor already is, so anchored content never stays stuck in its unresolved/offscreen placeholder. `Popover`/`DropdownMenu` treat `onAnchorUnavailable` as an anchor-loss close.
- **Host path**: a timed-out request commits the most recent `onLayout`-derived fallback rect, if one exists; with no fallback available (for example the very first measurement of the runtime's lifetime), the host rect retains its previous value (or the pre-existing `null` "not yet measured" state) — there is no new host-unavailable callback.

This holds deterministically across initial open, host-move remeasure, anchor unmount, close-while-pending, a newer successful request superseding an older dead one, and modal-local scope. A genuine timeout (not a supersession/close/host-revision retirement) emits exactly one `__DEV__`-only diagnostic naming the target, generation, and terminal action; production builds never warn.

### Safe-area / keyboard policy

The runtime reuses safe-area data already owned by `BeeUIProvider`. Collision padding is applied only where unsafe window edges intersect the overlay host. Keyboard avoidance is explicit policy input.

### Dismiss stack

Each overlay scope owns one deterministic dismiss stack through a stable controller.

- Topmost within a scope follows overlay open/registration order; host movement never reorders it.
- Outside press and accessibility escape operate only on the nearest scope.
- Global events target the deepest active scope, so initial-open/nested modal order does not depend on effect ordering.
- A root overlay behind a modal cannot steal dismissal from a modal-local child, even when the root overlay opens later.
- Existing handler updates do not reorder the stack.

The active-scope coordinator state is runtime-local, but BeeUI's supported **physical global-event arbitration boundary is one application-root overlay runtime**. Nested `BeeUIProvider`s reuse that runtime. Separate unrelated React application roots may each own isolated runtime state, but BeeUI does not guarantee which root owns one physical Web Escape/Android global event when several independent application roots are simultaneously active.

#### Child-first dismissal inside a Dialog

For anchored overlays declared inside a Dialog:

- **outside press / accessibility escape** — nearest modal scope handles the child first;
- **Web Escape** — application runtime chooses the deepest active modal scope, including when a root overlay registered later;
- **Android hardware back** — RN Modal request-close dismisses the modal scope's top anchored child first;
- **iOS/native sheet request-close** — no child interception; native dismissal policy remains authoritative.

`AlertDialog` inherits the same scope mechanics while preserving its cancel policy.

### Test-seam policy

Measurement overrides and internal contexts used by deterministic tests are not public fallback APIs.

## Public Popover

`Popover` contract includes controlled/uncontrolled state, measured trigger, default bottom/center placement, collision/safe-area handling, optional keyboard avoidance, flip/shift, anchor-loss close, topmost-only outside/back/Escape/accessibility dismissal, nested child-first behavior, explicit close, stable accessibility metadata, and non-modal semantics.

Automatic focus restoration and complete VoiceOver/TalkBack/keyboard behavior remain runtime/device gates.

## Public DropdownMenu

`DropdownMenu` reuses the same geometry/runtime/host/dismiss kernels. It adds controlled/uncontrolled state, measured trigger, bottom/start placement, close-on-select normal items, controlled checkbox/radio semantics, deterministic enabled-item keyboard navigation on Web, and topmost-only dismissal.

Browser-grade focus restoration and final native keyboard/screen-reader parity remain runtime/device gates.

## Future anchored components

`Select` and `Tooltip` must add their own semantic contracts rather than becoming visual aliases of DropdownMenu. The context-preserving transport blocker from #35 is removed for the proven web-dom/native-teleport paths; remaining component work is semantic/runtime acceptance, not manual context copying.

## Sheet boundary

A future first-class `Sheet` component remains a separate behavior class (gestures, snap points, scrolling, keyboard, accessibility). This is distinct from using RN Modal's `pageSheet`/`formSheet` presentation for `DialogContent`.

## Toast boundary

Toast remains a separate provider-scoped transient notification runtime and does not use anchored geometry or RN Modal.

## Automated evidence

Automated gates cover:

- TypeScript and behavioral contracts;
- geometry/runtime/Popover/DropdownMenu tests;
- context-preserving web browser cases;
- strict staged CASE C: Dialog/menu commit first, root Popover opens in a later commit, Escape still dismisses the modal child;
- initial-open and nested-modal scope-depth regressions;
- latest-request-wins async host/anchor measurement regressions;
- RN Modal presentation-prop contract (`overFullScreen` transparent, native full/sheet presentations non-transparent);
- package/release verification;
- Expo Web/Android/iOS bundling;
- bare Android and iOS native compilation gates;
- deterministic Chromium visual regression / Pattern Gallery acceptance.

## Remaining runtime/device evidence

Automated proof does not replace:

- live iOS `pageSheet`/`formSheet` presentation, anchored placement, and swipe dismissal;
- VoiceOver/TalkBack and focus restoration;
- real scrolling/anchor movement and representative safe-area cases;
- representative phone/tablet/reduced-height native placement;
- future Select/Tooltip/Sheet component-specific runtime contracts.

Exact final-head device evidence must be labeled separately from deterministic or prior-head evidence. The protected runtime simulator/device tier is tracked in `docs/roadmap.md`.
