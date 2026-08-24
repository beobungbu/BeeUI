# ADR-002: Split modal-class overlays from anchored overlays

Status: Accepted

## Context

Production overlays are behavior-heavy. Dialogs, sheets, popovers, menus, tooltips, selects, and transient notifications need correct focus/dismissal behavior, hardware-back handling, keyboard policy, screen-reader semantics, and Web/native parity.

BeeUI intentionally separates behavior classes instead of forcing every above-content surface through one portal mechanism.

## Decision

### Dialog-class overlays

BeeUI uses React Native core `Modal` as the behavior primitive for `Dialog`. `AlertDialog` reuses that accepted modal-class kernel while narrowing backdrop and request-close behavior for confirmation/destructive flows.

BeeUI owns:

- controlled/uncontrolled open state;
- trigger/close controls;
- semantic backdrop/surface styling;
- component-specific dismissal policy;
- accessibility labeling/description relationships;
- accessibility escape mapped to request-close policy;
- stable composition APIs.

React Native / React Native Web owns the platform modal window and the platform behavior exposed by core `Modal`.

This keeps `@beeui/core` / `@beeui/ui` Expo-free and avoids adopting a separate portal dependency for centered modal behavior that React Native already provides.

### Anchored overlays

BeeUI uses a separate non-Modal stack for trigger-positioned components.

The accepted stack consists of:

- a pure `@beeui/core` geometry resolver for placement, alignment, RTL behavior, offsets, flip/shift, collision padding, and overflow metadata;
- one internal `@beeui/ui` host/runtime under `BeeUIProvider` for portal lifecycle, window-coordinate measurement, safe-area/keyboard environment, anchor remeasurement, and deterministic topmost dismissal;
- public `Popover` composition;
- public `DropdownMenu` composition with menu-specific item/selection/keyboard contracts.

`Select` and `Tooltip` remain future public anchored components and must reuse the accepted geometry/interaction contracts rather than approximating anchored UI with a full-screen `Modal` or inventing a second positioning/dismiss engine without evidence.

#### React Context boundary (historical → superseded by #35)

**Historical (superseded):** the original anchored portal was a store-and-reparent host that re-parented entries under the application-root overlay host, changing React ancestry. Arbitrary consumer React contexts scoped below `BeeUIProvider` did not survive. Issue #35 exposed this; PR #38 documented it as an explicit, regression-tested pre-1.0 limitation. That description no longer reflects the shipped code.

**Current decision (PR #53, issue #35 resolved):** the anchored portal is a **runtime-selected transport** that preserves consumer React context:

- `web-dom` → `ReactDOM.createPortal` (content stays in its source fiber tree; context preserved);
- `native-teleport` → `react-native-teleport` on the New Architecture with the host view registered (context preserved);
- `legacy` → the defensive store-and-reparent fallback, used only when neither is available (native without Fabric, or a missing/stale host view). It intentionally does **not** preserve arbitrary consumer context and logs a one-time development warning. It is a capability fallback, not a recommended deployment.

No component copies arbitrary consumer context, and no anchored overlay is converted to a full-screen `Modal`.

#### Overlay scope model

Anchored overlays resolve against the **nearest overlay scope** — a coherent unit with three aligned, but independently-identified, responsibilities:

- **host** — where content is portaled (`BeeUIProvider` provisions the root host; `DialogContent`/`AlertDialog` provision a modal-local host inside the RN `Modal` window);
- **geometry** — each scope measures its **own** host window origin, so overlays inside a non-fullscreen sheet (`pageSheet`/`formSheet`) position relative to the sheet, not the root window. An open overlay remeasures its anchor when the host geometry changes;
- **dismissal** — each scope owns a dismiss stack with a **stable controller identity** (reactive geometry never reorders it), so "topmost" is scope-local and follows open order. A root overlay behind a modal can never become topmost over a modal-local child.

The active-scope coordinator that routes global events (web Escape, Android root back) to the topmost active scope is **owned per runtime** (not module-global), so independent runtimes (separate React roots, micro-frontends, embedded surfaces) cannot dismiss each other's overlays.

#### Platform dismiss decision

- **Android** hardware back reaches BeeUI only through `Modal.onRequestClose` (the root `BackHandler` is suppressed under a Modal); it is intercepted **child-first** — dismiss the modal's topmost anchored child, keep the Dialog open, close only when none remain.
- **iOS / other** `Modal.onRequestClose` can represent native sheet-swipe dismissal (`allowSwipeDismissal`), so it is **not** child-intercepted — that would leave React `Dialog` state open while the native modal is gone. The close policy applies directly. `onRequestClose` fires exactly once per native request on all platforms.

#### Distribution boundary

The `web-dom` transport ships as a `.web` platform file selected via `resolver.platforms`. It is proven under **Expo Web / the current Metro configuration** (the automated `visual-web` gate). Arbitrary React Native Web / consumer bundler resolution of the `.web` file, and public npm distribution, remain pre-1.0 distribution hardening — not yet guaranteed.

`Select` and `Tooltip` remain future public anchored components; they inherit the scope model rather than approximating anchored UI with a `Modal` or a second dismiss engine. Component-specific context copying is not a generic solution and is not used.

### Sheet

`Sheet` remains separately gated because gesture, snap-point, keyboard, safe-area, scroll/presentation, hardware-back, and accessibility behavior require stronger native runtime evidence than the centered Dialog kernel alone provides.

### Toast

Toast v1 is implemented as a separate provider-scoped transient-notification runtime.

It intentionally does not use:

- React Native core `Modal`;
- anchored positioning/geometry;
- arbitrary `ReactNode` portal transport.

Future Toast animation/swipe/custom-content work must preserve that separation unless new evidence warrants a different contract.

## Evidence / gates

Public overlay work must pass the automated gates applicable to its behavior class:

1. strict workspace TypeScript;
2. React Native Testing Library state/interaction/accessibility contracts;
3. `pnpm release:verify` package/release verification;
4. Expo/Metro bundles for Web, Android, and iOS;
5. Expo Prebuild generation;
6. clean packed-tarball installation into a true bare React Native consumer;
7. bare RN Android + iOS Metro bundles;
8. bare Android native compilation;
9. deterministic Chromium visual regression where representative;
10. native iOS Simulator compilation for the Expo Showcase and a fresh bare RN consumer when scheduled, and always on main pushes;
11. no Expo runtime imports in `@beeui/core` / `@beeui/ui`.

Native iOS compilation is now automated and must no longer be described as a manual release gate.

Automated compile/contract/visual evidence still does not replace real runtime/device checks for:

- safe areas with real non-zero insets;
- focus/keyboard behavior;
- Android hardware back during execution;
- VoiceOver/TalkBack;
- scrolling/anchor movement;
- representative native visuals;
- component-specific future Select/Tooltip/Sheet interaction contracts.

`docs/release.md` defines current release evidence. `docs/roadmap.md` defines the pre-1.0 runtime/overlay work that remains.
