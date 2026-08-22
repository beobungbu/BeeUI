# ADR-002: Split modal-class overlays from anchored overlays

Status: Accepted

## Context

Production overlays are behavior-heavy. Dialogs, sheets, popovers, menus, tooltips, selects, and toasts need correct focus management, portal behavior, hardware-back handling, keyboard handling, screen-reader semantics, and web parity.

The original v0.1 plan deferred all overlays while BeeUI evaluated `@rn-primitives`. That library remains useful reference material, but adopting it as a runtime foundation would also adopt its portal layer and current compatibility surface. During the RN 0.86 review, BeeUI found open upstream reports for mobile-web Dialog overlay dismissal and Portal/Jest distribution behavior.

Modal-class overlays and anchored overlays do not need the same primitive. React Native 0.86 already ships `Modal`; on Android its `onRequestClose` integrates with the hardware back button. React Native for Web's `Modal` provides modal ARIA behavior, contains focus, and routes Escape to the top-most modal's `onRequestClose`.

## Decision

### Dialog-class overlays

BeeUI uses React Native core `Modal` as the behavior primitive for `Dialog`. `AlertDialog` reuses that accepted modal-class kernel while narrowing backdrop and request-close behavior for confirmation/destructive flows.

The BeeUI layer owns:

- controlled/uncontrolled open state
- trigger and close controls
- semantic backdrop and surface styling
- component-specific dismissal policy
- dialog accessibility role / modal isolation hints
- accessibility escape mapped to the component's request-close policy
- stable component composition API

The React Native / React Native Web layer owns the platform modal window, Android back integration, web focus containment, modal isolation, and web Escape routing.

This keeps `@beeui/core` / `@beeui/ui` Expo-free and avoids adding a portal dependency for a behavior that the current RN stack already provides.

### Anchored overlays

BeeUI uses a separate non-Modal anchored-overlay stack for trigger-positioned components.

The accepted stack consists of:

- a pure `@beeui/core` geometry resolver for placement, alignment, RTL behavior, offsets, flip/shift, collision padding, and overflow metadata
- one internal `@beeui/ui` host/runtime under `BeeUIProvider` for portal lifecycle, window-coordinate measurement, safe-area/keyboard environment, anchor remeasurement, and deterministic topmost dismissal
- public `Popover` composition on those kernels
- public `DropdownMenu` composition on those kernels with menu-specific item, selection, and keyboard contracts

`Select` and `Tooltip` remain deferred until their own component-level selection/focus/accessibility contracts are implemented and verified. They must reuse the accepted anchored kernels rather than approximating anchor positioning with a full-screen `Modal` or introducing a second positioning/dismiss engine without new evidence.

The current custom anchored portal re-parents entries under the application-root overlay host. BeeUI explicitly re-provides the internal contexts its public overlay components require, but arbitrary consumer React contexts scoped below `BeeUIProvider` are not currently guaranteed to survive that re-parenting. This is a documented pre-1.0 limitation tracked separately; component-specific context copying must not be treated as a generic fix.

`Sheet` remains separately gated because gesture, keyboard, safe-area, and presentation behavior need stronger native verification than the centered Dialog kernel alone provides.

## Evidence / gates

Public overlay components must pass BeeUI's normal automated gates applicable to their behavior class:

1. strict TypeScript across the workspace
2. React Native Testing Library state/interaction/accessibility contracts
3. packed-package/release verification through `pnpm release:verify`
4. Expo/Metro bundle for Web, Android, and iOS
5. Expo Prebuild generation of Android and iOS native projects
6. clean packed-tarball installation into a true bare React Native consumer
7. bare React Native Android + iOS Metro bundles and Android debug APK compilation
8. no Expo runtime import in `@beeui/core` / `@beeui/ui`

These automated gates do not replace native release interaction checks. Native iOS binary compilation, representative simulator/device positioning, keyboard/focus behavior, Android hardware back, VoiceOver/TalkBack behavior, and visual review remain explicit release gates for the public overlay component that depends on them.
