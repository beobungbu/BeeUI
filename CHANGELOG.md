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
- Executable Showcase navigation between the preserved Component Gallery and a declarative Pattern Gallery over all 37 production screens, with local demo state, responsive mobile/desktop browsing, representative state inspection, and light/dark support.
- Durable real-Showcase Playwright integration QA owned by `apps/visual-regression`, including representative component/pattern smoke coverage and a full 370-render Pattern Gallery acceptance matrix without committed Gallery PNG baselines.
- A phase-1 repository-local Registry + source-ownership CLI with deterministic dependency resolution, source transforms, collision protection, dry-run, doctor/verify, security/path validation, and initial public component/theme entries.
- `AlertDialog` composition for destructive/confirmation flows, including non-dismissible backdrops, explicit native request-close policy, cancel actions, and destructive actions.
- `FormGroup` legend/description/error composition with metadata inheritance for semantic `RadioGroup` descendants without collapsing child controls into one accessibility element.
- A pure anchored-overlay geometry resolver in `@beeui/core` with deterministic placement, flip, shift, collision padding, available-space metadata, and RTL-aware alignment.
- An internal anchored-overlay runtime under `BeeUIProvider` with one shared host, window-coordinate measurement, safe-area/keyboard viewport metadata, deterministic portal ordering, and topmost-only back/Escape/outside dismissal.
- Public `Popover` composition with controlled/uncontrolled state, anchored placement, title/description accessibility fallbacks, explicit close actions, and topmost-only outside/back/Escape dismissal.
- Public `DropdownMenu` composition with anchored placement, normal/checkbox/radio items, disabled-state semantics, topmost dismissal, and deterministic Web Arrow/Home/End/Enter/Space navigation.
- Four production-oriented Showcase pattern packs containing 37 screens across Authentication/Onboarding, Dashboard/Finance, Commerce/Social, and Account/Settings.
- `docs/roadmap.md` as the canonical pre-1.0 production-readiness plan covering integrated Pattern Gallery maintenance, context-preserving anchored-overlay transport, runtime device verification, theme/token v2, Select/Tooltip/Sheet, distribution, compatibility, accessibility, performance, motion, docs/demo, and later component/pattern expansion.

### Changed

- Production pattern implementation under `apps/showcase/patterns/**` is now native-sensitive in the pull-request classifier because the executable Showcase reaches those files through the Pattern Gallery; pattern-specific tests remain native-safe because they are not bundled into the native Showcase.
- The existing component playground was extracted into a maintained Component Gallery instead of being replaced by Pattern Gallery-only navigation; `App.tsx` now remains a concise provider/root shell.
- The release contract now separates automated Linux cross-platform/Android proof, automated macOS native iOS compile proof, deterministic Web visual/component-Gallery integration evidence, and still-unautomated native runtime/device interaction evidence.
- The bare React Native smoke consumer installs packed BeeUI tarballs instead of copying package source directly, so Metro/native verification exercises the actual package boundary.
- BeeUI package manifests define an explicit `src` packed surface while remaining private during the pre-1.0 distribution phase.
- `DialogContent` can make native request-close paths notification-only through `dismissOnRequestClose={false}`, enabling higher-level modal contracts without replacing the core Modal kernel.
- Anchored overlays have accepted geometry/runtime kernels plus public `Popover` and `DropdownMenu`. The portal is a runtime-selected transport (web `ReactDOM.createPortal`, native `react-native-teleport`, defensive legacy fallback) that preserves consumer React context declared below `BeeUIProvider`, including inside a `Dialog` modal-local host; proven by a jest transport suite, a Playwright web regression, and iOS/Android device evidence (#35). Each modal-class surface provisions a coherent **overlay scope** — its own portal host, its own measured geometry origin (so overlays inside a `pageSheet`/`formSheet` position relative to the sheet, not the root window), and its own dismiss stack (so outside press, accessibility escape, web Escape, and hardware back stay scoped: a root overlay behind a modal never steals dismissal from a modal-local child, regardless of open order). Platform request-close is routed by platform — **Android** hardware back (which reaches BeeUI only via `Modal.onRequestClose`) is intercepted child-first, while **iOS/other** request-close (which can be a native `pageSheet`/`formSheet` swipe dismissal) is not intercepted, so React `Dialog` state never desyncs from the native modal. `onRequestClose` fires exactly once per native request on all platforms; `AlertDialog` inherits the child-first policy and its `cancelOnRequestClose` applies only once no child remains. `react-native-teleport` is a peer dependency. `react-dom` is optional as BeeUI's own direct peer (used only by the web transport), but `react-native-teleport` peers on `react-dom` too, so a strict package manager may still require a matching `react-dom` in a native-only consumer — the bare-native smoke installs one for that reason.
- `Select` and `Tooltip` remain separate component-level work with their own keyboard/focus/accessibility contracts; `Sheet` remains a separately gated gesture/keyboard/safe-area behavior class.
- Documentation now treats the Registry/CLI as implemented phase-1 repository tooling and Wave 0 Pattern Gallery as implemented, while preserving that public `npx beeui` and public npm distribution do not exist yet.
