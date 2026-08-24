# Changelog

All notable consumer-facing changes to BeeUI are recorded here.

## Unreleased

### Added

- Production `Select` composition with controlled/uncontrolled string-value selection, persistent option state, placeholder/disabled/group contracts, duplicate-value fail-safe behavior, shared anchored-overlay transport, Web keyboard/typeahead/focus behavior, long-list scrolling, and Dialog-local nesting without aliasing `DropdownMenu` command semantics.
- Provider-scoped Toast / transient notifications through `useToast()`, with descriptor-only content, three-visible FIFO queueing, timed or explicit persistent dismissal, actions, safe-area-aware stacking, and accessibility announcements without reusing the anchored-overlay portal or React Native core `Modal`.
- Release-package verification via `pnpm release:verify`, including package export checks, packed-manifest validation, clean-consumer installation, and a CI verification artifact.
- Native iOS Simulator compilation on the trusted macOS ARM64 runner for both the generated Expo Showcase and a fresh true bare React Native 0.86.2 consumer.
- Change-aware pull-request scheduling for the expensive native iOS job, with conservative fail-safe path classification, `ci:native` forcing, and full native iOS verification retained on every push to `main`.
- Persistent macOS Xcode/DerivedData and Bundler caches plus Xcode compilation caching/build timing summaries for native iOS verification; caches are performance-only and do not replace fresh consumer/package evaluation.
- Deterministic Chromium visual regression with 28 canonical light/dark screenshots across representative foundation, forms, navigation/data, Dialog, AlertDialog, Popover, and DropdownMenu states.
- Executable Showcase navigation between the preserved Component Gallery and a declarative Pattern Gallery over all 37 production screens, with local demo state, responsive mobile/desktop browsing, representative state inspection, and light/dark support.
- Durable browser integration QA owned by `apps/visual-regression`, including representative component/pattern smoke coverage, anchored-overlay context/dismissal scenarios, and a full 370-render Pattern Gallery acceptance matrix without committed Gallery PNG baselines.
- A phase-1 repository-local Registry + source-ownership CLI with deterministic dependency resolution, source transforms, collision protection, dry-run, doctor/verify, security/path validation, and initial public component/theme entries.
- `AlertDialog` composition for destructive/confirmation flows, including non-dismissible backdrops, explicit native request-close policy, cancel actions, and destructive actions.
- `FormGroup` legend/description/error composition with metadata inheritance for semantic `RadioGroup` descendants without collapsing child controls into one accessibility element.
- A pure anchored-overlay geometry resolver in `@beeui/core` with deterministic placement, flip, shift, collision padding, available-space metadata, and RTL-aware alignment.
- An internal anchored-overlay runtime under `BeeUIProvider` with root/modal-local scopes, window-coordinate measurement, safe-area/keyboard metadata, deterministic portal ordering, and topmost-only scoped dismissal.
- Public `Popover` composition with controlled/uncontrolled state, anchored placement, title/description accessibility fallbacks, explicit close actions, and topmost-only outside/back/Escape dismissal.
- Public `DropdownMenu` composition with anchored placement, normal/checkbox/radio items, disabled-state semantics, topmost dismissal, and deterministic Web Arrow/Home/End/Enter/Space navigation.
- Four production-oriented Showcase pattern packs containing 37 screens across Authentication/Onboarding, Dashboard/Finance, Commerce/Social, and Account/Settings.
- `docs/roadmap.md` as the canonical pre-1.0 production-readiness plan covering runtime device verification, theme/token v2, Select/Tooltip/Sheet, distribution, compatibility, accessibility, performance, motion, docs/demo, and later component/pattern expansion.

### Changed

- Production pattern implementation under `apps/showcase/patterns/**` is native-sensitive in the pull-request classifier because executable Showcase reaches those files; pattern-specific tests remain native-safe when not bundled.
- The existing component playground was extracted into a maintained Component Gallery instead of being replaced by Pattern Gallery-only navigation.
- The release contract separates automated Linux cross-platform/Android proof, automated macOS native iOS compile proof, deterministic browser evidence, and native runtime/device interaction evidence.
- The bare React Native smoke consumer installs packed BeeUI tarballs instead of copying package source directly.
- BeeUI package manifests define an explicit `src` packed surface while remaining private during pre-1.0 distribution.
- `DialogContent` can make native request-close paths notification-only through `dismissOnRequestClose={false}`.
- Anchored overlays now use a runtime-selected portal transport — Web `ReactDOM.createPortal`, native `react-native-teleport`, defensive legacy fallback — with consumer React context preserved on the context-preserving transports (#35). Each modal surface provisions its own overlay scope with portal host, measured geometry, stable dismiss controller, and semantic depth. Global dismissal selects the deepest active scope rather than effect-registration order, so initial-open and nested Dialogs remain correct; a root overlay behind a modal cannot steal modal-child dismissal even if the root overlay opens later. Native host/anchor `measureInWindow` uses latest-request-wins generations so stale asynchronous callbacks cannot overwrite newer geometry or spuriously close an overlay. `DialogContent` sets `transparent=true` only for `overFullScreen`; native `fullScreen`, `pageSheet`, and `formSheet` use `transparent=false` so RN Fabric can honor the requested presentation. Android Modal hardware back remains child-first; iOS/other native request-close is not child-intercepted. Live iOS sheet placement/swipe remains a simulator/device acceptance gate rather than a Jest claim.
- Active-scope state is runtime-local, but physical global Escape/back arbitration is documented for one application-root overlay runtime; nested `BeeUIProvider`s reuse that runtime, while simultaneous unrelated application roots are not promised cross-root event ownership.
- `react-native-teleport` is a peer dependency. `react-dom` is optional as BeeUI's own direct peer, though teleport's peer shape can still require it under strict native-only resolution.
- `Tooltip` remains component-level work with its own hover/focus/accessibility contract; a first-class `Sheet` remains separately gated. `Select` is now implemented as its own value-selection contract on the accepted anchored-overlay runtime.
- Documentation treats Registry/CLI as implemented phase-1 tooling and Wave 0 Pattern Gallery as implemented, while preserving that public `npx beeui` and public npm distribution do not exist yet.
