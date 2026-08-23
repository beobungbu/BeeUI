# Changelog

All notable consumer-facing changes to BeeUI are recorded here.

## Unreleased

### Added

- Provider-scoped Toast / transient notifications through `useToast()`, with descriptor-only content, three-visible FIFO queueing, timed or explicit persistent dismissal, actions, safe-area-aware stacking, and accessibility announcements without reusing the anchored-overlay portal or React Native core `Modal`.
- Release-package verification via `pnpm release:verify`, including package export checks, packed-manifest validation, clean-consumer installation, and a CI verification artifact.
- Native iOS Simulator compilation on the trusted macOS ARM64 runner for both the generated Expo Showcase and a fresh true bare React Native 0.86.2 consumer.
- Change-aware pull-request scheduling for the expensive native iOS job, with conservative fail-safe path classification, `ci:native` forcing, and full native iOS verification retained on every push to `main`.
- Persistent macOS Xcode/DerivedData and Bundler caches plus Xcode compilation caching/build timing summaries for native iOS verification; caches are performance-only and do not replace fresh consumer/package evaluation.
- Deterministic Chromium visual regression with 28 canonical light/dark screenshots across representative foundation, forms, navigation/data, Dialog, AlertDialog, Popover, and DropdownMenu states.
- A phase-1 repository-local Registry + source-ownership CLI with deterministic dependency resolution, source transforms, collision protection, dry-run, doctor/verify, security/path validation, and initial public component/theme entries.
- `AlertDialog` composition for destructive/confirmation flows, including non-dismissible backdrops, explicit native request-close policy, cancel actions, and destructive actions.
- `FormGroup` legend/description/error composition with metadata inheritance for semantic `RadioGroup` descendants without collapsing child controls into one accessibility element.
- A pure anchored-overlay geometry resolver in `@beeui/core` with deterministic placement, flip, shift, collision padding, available-space metadata, and RTL-aware alignment.
- An internal anchored-overlay runtime under `BeeUIProvider` with one shared host, window-coordinate measurement, safe-area/keyboard viewport metadata, deterministic portal ordering, and topmost-only back/Escape/outside dismissal.
- Public `Popover` composition with controlled/uncontrolled state, anchored placement, title/description accessibility fallbacks, explicit close actions, and topmost-only outside/back/Escape dismissal.
- Public `DropdownMenu` composition with anchored placement, normal/checkbox/radio items, disabled-state semantics, topmost dismissal, and deterministic Web Arrow/Home/End/Enter/Space navigation.
- Four production-oriented Showcase pattern packs containing 37 screens across Authentication/Onboarding, Dashboard/Finance, Commerce/Social, and Account/Settings.
- `docs/roadmap.md` as the canonical pre-1.0 production-readiness plan covering Pattern Gallery integration, context-preserving anchored-overlay transport, runtime device verification, theme/token v2, Select/Tooltip/Sheet, distribution, compatibility, accessibility, performance, motion, docs/demo, and later component/pattern expansion.

### Changed

- The release contract now separates automated Linux cross-platform/Android proof, automated macOS native iOS compile proof, deterministic Web visual regression, and still-unautomated runtime/device interaction evidence.
- The bare React Native smoke consumer installs packed BeeUI tarballs instead of copying package source directly, so Metro/native verification exercises the actual package boundary.
- BeeUI package manifests define an explicit `src` packed surface while remaining private during the pre-1.0 distribution phase.
- `DialogContent` can make native request-close paths notification-only through `dismissOnRequestClose={false}`, enabling higher-level modal contracts without replacing the core Modal kernel.
- Anchored overlays have accepted geometry/runtime kernels plus public `Popover` and `DropdownMenu`; the arbitrary-consumer React Context boundary of the current portal is explicitly documented/regression-tested, and context-preserving transport is a pre-1.0 roadmap item before further major anchored-overlay expansion.
- `Select` and `Tooltip` remain separate component-level work with their own keyboard/focus/accessibility contracts; `Sheet` remains a separately gated gesture/keyboard/safe-area behavior class.
- Documentation now treats the Registry/CLI as implemented phase-1 repository tooling rather than an unimplemented future concept, while preserving that public `npx beeui` and public npm distribution do not exist yet.
