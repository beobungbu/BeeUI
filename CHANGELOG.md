# Changelog

All notable consumer-facing changes to BeeUI are recorded here.

## Unreleased

### Added

- Release-package verification via `pnpm release:verify`, including package export checks, packed-manifest validation, clean-consumer installation, and a CI verification artifact.
- A documented release/versioning contract that separates automated Linux verification from macOS/device-only gates.
- `AlertDialog` composition for destructive/confirmation flows, including non-dismissible backdrops, explicit native request-close policy, cancel actions, and destructive actions.
- `FormGroup` legend/description/error composition with metadata inheritance for semantic `RadioGroup` descendants without collapsing child controls into one accessibility element.
- A pure anchored-overlay geometry resolver in `@beeui/core` with deterministic placement, flip, shift, collision padding, available-space metadata, and RTL-aware alignment.
- An internal anchored-overlay runtime under `BeeUIProvider` with one shared host, window-coordinate measurement, safe-area/keyboard viewport metadata, deterministic portal ordering, and topmost-only back/Escape/outside dismissal.
- Public `Popover` composition with controlled/uncontrolled state, anchored placement, title/description accessibility fallbacks, explicit close actions, and topmost-only outside/back/Escape dismissal.
- Public `DropdownMenu` composition with anchored placement, normal/checkbox/radio items, disabled-state semantics, topmost dismissal, and deterministic Web Arrow/Home/End/Enter/Space navigation.

### Changed

- The bare React Native smoke consumer now installs packed BeeUI tarballs instead of copying package source directly, so Metro/native verification exercises the actual package boundary.
- BeeUI package manifests now define an explicit `src` packed surface while remaining private during the pre-1.0 distribution phase.
- `DialogContent` can make native request-close paths notification-only through `dismissOnRequestClose={false}`, enabling higher-level modal contracts without replacing the core Modal kernel.
- Anchored overlays now have accepted geometry/runtime kernels plus public `Popover` and `DropdownMenu`; `Select` and `Tooltip` remain separate component-level work with their own keyboard/focus/accessibility contracts.
