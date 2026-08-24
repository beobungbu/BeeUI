# ADR-002: Split modal-class overlays from anchored overlays

Status: Accepted

## Context

Production overlays are behavior-heavy. Dialogs, sheets, popovers, menus, tooltips, selects, and transient notifications need correct focus/dismissal behavior, hardware-back handling, keyboard policy, screen-reader semantics, and Web/native parity.

BeeUI intentionally separates behavior classes instead of forcing every above-content surface through one portal mechanism.

## Decision

### Dialog-class overlays

BeeUI uses React Native core `Modal` as the behavior primitive for `Dialog`. `AlertDialog` reuses that accepted modal-class kernel while narrowing backdrop and request-close behavior for confirmation/destructive flows.

BeeUI owns controlled/uncontrolled open state, trigger/close controls, semantic backdrop/surface styling, component-specific dismissal policy, accessibility relationships, accessibility escape mapping, and stable composition APIs. React Native / React Native Web owns the platform modal window and the platform behavior exposed by core `Modal`.

`DialogContent` defaults to `presentationStyle="overFullScreen"`. BeeUI sets `transparent=true` only for that presentation. Native `fullScreen`, `pageSheet`, and `formSheet` presentations use `transparent=false`; on RN Fabric, forcing `transparent=true` would coerce the native presentation back to `overFullScreen` and make a requested sheet style illusory.

### Anchored overlays

BeeUI uses a separate non-Modal stack for trigger-positioned components.

The accepted stack consists of:

- a pure `@beeui/core` geometry resolver;
- an internal `@beeui/ui` runtime under `BeeUIProvider` for transport, measurement, safe-area/keyboard environment, anchor remeasurement, and scoped dismissal;
- public `Popover`;
- public `DropdownMenu` with menu-specific selection/keyboard contracts.

`Select` and `Tooltip` remain future anchored components and must reuse these kernels rather than approximating anchored UI with a full-screen `Modal`.

#### React Context boundary (historical → superseded by #35)

**Historical (superseded):** the original anchored portal was a store-and-reparent host under the application root. It changed React ancestry, so arbitrary consumer contexts below `BeeUIProvider` did not survive. Issue #35 exposed the limitation; PR #38 documented it temporarily.

**Current decision (PR #53):** portal transport is runtime-selected:

- `web-dom` → `ReactDOM.createPortal`, context preserved;
- `native-teleport` → `react-native-teleport` when the New Architecture host is registered, context preserved;
- `legacy` → defensive store-and-reparent fallback when the capability is unavailable/stale, context not preserved.

No component copies arbitrary consumer context and anchored overlays are not converted into RN `Modal`.

#### Overlay scope model

Anchored overlays resolve against the nearest `OverlayScope`:

- **host** — portal destination;
- **geometry** — measured destination host rectangle in window coordinates;
- **dismissal** — stable per-scope dismiss controller/stack;
- **semantic depth** — root is depth `0`; each modal boundary increments the nearest parent depth.

Semantic depth, not effect registration order, determines which active scope receives a global dismiss event. This is required because React may run descendant layout effects before ancestor layout effects during the same commit. Initial-render `defaultOpen` and nested Dialog composition must therefore remain correct regardless of effect order. Same-depth sibling scopes use activation order only as a tie-breaker.

Reactive geometry never changes dismiss-controller identity or overlay open-order within a scope.

The active-scope coordinator is owned per runtime rather than module-global. Nested `BeeUIProvider`s reuse the application runtime. Separate unrelated React application roots may own isolated runtime state, but BeeUI does **not** guarantee arbitration of one physical global Escape/back event across several simultaneously active application roots; the supported application contract has one application-root overlay runtime.

#### Measurement concurrency decision

React Native `measureInWindow` is asynchronous. Host and anchor measurement therefore use a latest-request-wins generation guard:

- a newer request invalidates older in-flight callbacks;
- stale host callbacks cannot overwrite newer geometry;
- stale invalid anchor callbacks cannot trigger anchor-unavailable behavior after a newer successful measure;
- close/unmount invalidates outstanding anchor requests.

Host geometry revision also triggers anchor remeasurement while an overlay is open, so a moved/resized destination host is never paired intentionally with a stale anchor measurement.

#### Platform dismiss decision

- **Android** hardware back under RN `Modal` arrives through `Modal.onRequestClose`; BeeUI dismisses the modal-local anchored child first, then the Dialog when no child remains.
- **iOS / other** request-close can represent native sheet dismissal itself, so BeeUI does not child-intercept it; the Dialog close policy applies directly.
- `onRequestClose` remains an exactly-once request notification and is disjoint from backdrop/accessibility-close paths.

#### Distribution boundary

`web-dom` is currently proven under Expo Web / current Metro platform-file resolution. Arbitrary Web bundlers and public npm conditional exports remain pre-1.0 distribution hardening.

### Sheet

A future first-class BeeUI `Sheet` component remains separately gated because gestures, snap points, keyboard, scrolling, safe-area behavior, hardware back, and accessibility need stronger runtime evidence. This is separate from RN Modal's `pageSheet`/`formSheet` presentation options on `DialogContent`.

### Toast

Toast remains a separate provider-scoped transient-notification runtime. It does not use RN `Modal`, anchored geometry, or arbitrary `ReactNode` portal transport.

## Evidence / gates

Applicable overlay work must pass:

1. strict workspace TypeScript;
2. React Native Testing Library contracts;
3. `pnpm release:verify`;
4. Expo Web/Android/iOS exports and Expo Prebuild;
5. packed true-bare consumer verification;
6. bare Android native compilation;
7. trusted iOS Simulator compilation for Expo Showcase and fresh bare RN consumer when scheduled;
8. deterministic Chromium visual/browser integration where representative;
9. no Expo runtime imports in `@beeui/core` / `@beeui/ui`.

Deterministic tests specifically pin semantic scope depth, host/anchor async latest-request-wins behavior, native Modal presentation props, and staged root-behind-modal Web Escape ordering.

Compilation and deterministic contracts still do not replace final runtime evidence for live iOS `pageSheet`/`formSheet` presentation/placement/swipe, VoiceOver/TalkBack, focus restoration, representative safe areas/scrolling, and future component-specific interaction contracts.

`docs/release.md` defines current release evidence. `docs/roadmap.md` defines remaining pre-1.0 runtime work.
