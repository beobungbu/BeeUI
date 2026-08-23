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

#### Current React Context boundary

The current custom anchored portal re-parents entries under the application-root overlay host. BeeUI re-provides the internal contexts its own public overlays require, but arbitrary consumer React contexts scoped below `BeeUIProvider` are not guaranteed to survive that change in React ancestry.

Issue #35 was closed by PR #38 after this became an explicit, regression-tested pre-1.0 contract. The closure documents the limitation; it does not make the current transport context-preserving.

A context-preserving native/Web transport is now a pre-1.0 roadmap requirement before further major anchored-overlay expansion. Any replacement/evolution must retain the accepted non-modal geometry, nested/topmost dismissal, safe-area, keyboard-policy, and accessibility behavior. Component-specific context copying is not a generic solution.

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
