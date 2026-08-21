# ADR-002: Overlay behavior layer is deferred

Status: Proposed / deferred

## Context

Production overlays are behavior-heavy. Dialogs, sheets, popovers, menus, tooltips, selects, and toasts need correct focus management, portal behavior, hardware-back handling, keyboard handling, screen-reader semantics, and web parity.

`@rn-primitives` remains a strong candidate because it is MIT licensed, unstyled, accessible, and designed for iOS/Android/web. However, current ecosystem reports around portal behavior and ESM/CJS resolution in bare React Native 0.83+ mean BeeUI should not lock it into the foundation before verification on the RN 0.86 baseline.

## Decision for v0.1

- do not add an overlay dependency yet
- do not ship ad-hoc `Modal` wrappers as production Dialog/Popover implementations
- keep overlay component names reserved
- validate candidate behavior layers against Expo 57 / RN 0.86 and bare RN before adopting one

## Acceptance gate

A behavior layer must pass at minimum:

1. iOS and Android native portal rendering
2. Expo prebuild and bare React Native builds
3. web keyboard/focus behavior
4. screen-reader labeling and modal isolation
5. Android hardware-back handling
6. nested overlay behavior
7. deterministic tests in BeeUI's test harness
