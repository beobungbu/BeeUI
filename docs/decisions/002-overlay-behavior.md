# ADR-002: Split modal-class overlays from anchored overlays

Status: Accepted for Dialog; anchored overlays remain deferred

## Context

Production overlays are behavior-heavy. Dialogs, sheets, popovers, menus, tooltips, selects, and toasts need correct focus management, portal behavior, hardware-back handling, keyboard handling, screen-reader semantics, and web parity.

The original v0.1 plan deferred all overlays while BeeUI evaluated `@rn-primitives`. That library remains useful reference material, but adopting it as a runtime foundation would also adopt its portal layer and current compatibility surface. During the RN 0.86 review, BeeUI found open upstream reports for mobile-web Dialog overlay dismissal and Portal/Jest distribution behavior.

Modal-class overlays and anchored overlays do not need the same primitive. React Native 0.86 already ships `Modal`; on Android its `onRequestClose` integrates with the hardware back button. React Native for Web's `Modal` provides modal ARIA behavior, contains focus, and routes Escape to the top-most modal's `onRequestClose`.

## Decision

### Dialog-class overlays

BeeUI uses React Native core `Modal` as the behavior primitive for `Dialog`.

The BeeUI layer owns:

- controlled/uncontrolled open state
- trigger and close controls
- semantic backdrop and surface styling
- optional backdrop dismissal
- dialog accessibility role / modal isolation hints
- accessibility escape mapped to the same close path
- stable component composition API

The React Native / React Native Web layer owns the platform modal window, Android back integration, web focus containment, modal isolation, and web Escape routing.

This keeps `@beeui/core` / `@beeui/ui` Expo-free and avoids adding a portal dependency for a behavior that the current RN stack already provides.

### Anchored overlays

`Popover`, `DropdownMenu`, `Tooltip`, `Select`, and other anchor-positioned overlays remain deferred. They need positioning, collision detection, nested-overlay coordination, and web keyboard semantics that should not be approximated with a full-screen Modal.

`Sheet` and `AlertDialog` may reuse the modal-class kernel later, but they are not accepted merely by aliasing `Dialog`; their gesture/destructive-action contracts require separate tests.

## Evidence / gates

The Dialog implementation must pass BeeUI's existing gates:

1. strict TypeScript
2. React Native Testing Library state/dismissal contracts
3. Expo/Metro bundle for Web, Android, and iOS
4. Expo Prebuild generation of Android and iOS native projects
5. no Expo runtime import in `@beeui/core` / `@beeui/ui`

Before v0.1 is considered fully release-ready, Dialog still requires physical/simulator native interaction smoke testing, including screen reader behavior and Android hardware back on a compiled application.
