# Changelog

All notable consumer-facing changes to BeeUI are recorded here.

## Unreleased

No unreleased consumer-facing changes are recorded after the first public release candidate yet.

## [0.86.2-rc.1] — 2026-09-09

First public BeeUI release candidate. Published from exact source SHA
`ddf415b0d665c14e1b154bb02570a906585b4b98` through the protected `npm-release` workflow.

### Distribution

- Published `@beemvp/beeui-core`, `@beemvp/beeui-tokens`, `@beemvp/beeui-ui`, and `@beemvp/beeui-cli` in lockstep at `0.86.2-rc.1`.
- Published the release candidate under npm dist-tag **`next`** with provenance. Stable **`latest`** is intentionally not promoted to this prerelease.
- Public RC install path:

  ```bash
  npm install @beemvp/beeui-ui@next @beemvp/beeui-core@next @beemvp/beeui-tokens@next
  npx @beemvp/beeui-cli@next --help
  ```

- Release artifacts are canonicalized and reproducibility-checked before registry mutation; the release workflow publishes the same verified tarballs rather than independently rebuilding a second artifact.
- Clean-consumer verification covers package installation, public exports/subpaths, the CLI binary, Expo package consumption, bare React Native consumption, and Web consumption.

### Added

- Packaging-verification chain closing R7's packed-inventory/prerelease-artifact/clean-consumer gap (#202, #203, #204): `pnpm release:verify` asserts every packed tarball excludes generated build junk, test fixtures, and repository-private config, ships LICENSE/README, and that every declared export target (including all 62 `@beemvp/beeui-ui` granular subpaths) is actually inside the tarball, not just present on disk pre-pack. `pnpm pack:artifacts` produces the exact release-equivalent tarballs with checksums into `.artifacts/pack/`; the bare, Web, and Expo clean-consumer verification paths install package artifacts rather than workspace links.
- A reproducible performance benchmark harness (`pnpm bench:web` / `pnpm bench:native`, tested via `pnpm bench:test`) that records OS/CPU/runtime/React Native/Node/git-SHA environment metadata, applies a documented warm-up/sampling strategy, and emits machine-readable JSON plus a human-readable summary. Web and native methodologies are kept separate; native measurements defer off-device instead of fabricating device timings.
- Real component-render/commit stress, overlay open-latency, and theme-runtime performance scenarios (`pnpm bench:components`) covering representative components, overlays, light/dark and high-contrast themes, runtime overrides, density, and token-reader theme switches.
- Theme Tokens v3: canonical DTCG token source/codegen, typed theme registry/scoping, runtime overrides/readers, density, high-contrast, semantic data-viz, and motion/layout/typography contracts, enforced by semantic-consumption guardrails and targeted visual acceptance coverage.
- Machine-readable token lifecycle/deprecation governance in the canonical token model, including stable/experimental/deprecated status, replacement paths, reasons, optional removal targets, generated TypeScript deprecation metadata, CSS compatibility aliases, lifecycle manifest, and deterministic migration reporting.
- Production `Select` composition with controlled/uncontrolled string-value selection, persistent option state, placeholder/disabled/group contracts, duplicate-value fail-safe behavior, shared anchored-overlay transport, Web keyboard/typeahead/focus behavior, long-list scrolling, and Dialog-local nesting.
- Provider-scoped Toast / transient notifications through `useToast()`, including descriptor-only content, FIFO queueing, timed or explicit persistent dismissal, actions, safe-area-aware stacking, and accessibility announcements.
- Release-package verification via `pnpm release:verify`, including package export checks, packed-manifest validation, clean-consumer installation, and a CI verification artifact.
- Native iOS Simulator compilation for both the generated Expo Showcase and a fresh true bare React Native 0.86.2 consumer.
- Change-aware pull-request scheduling for expensive native iOS verification, with conservative fail-safe path classification and full native iOS verification retained where required.
- Persistent macOS Xcode/DerivedData and Bundler caches plus build-timing summaries for native iOS verification; caches are performance-only and do not replace fresh consumer/package evaluation.
- Deterministic Chromium visual regression across representative foundation, forms, navigation/data, Dialog, AlertDialog, Popover, DropdownMenu, and pattern states.
- Executable Showcase navigation between Component Gallery and Pattern Gallery over 37 production screens, with local demo state, responsive mobile/desktop browsing, representative state inspection, and light/dark support.
- Durable browser integration QA owned by `apps/visual-regression`, including representative component/pattern smoke coverage, anchored-overlay context/dismissal scenarios, and full Pattern Gallery acceptance coverage.
- Registry + source-ownership CLI with deterministic dependency resolution, source transforms, collision protection, dry-run, `doctor`/`verify`, security/path validation, `diff`, and `update` workflows.
- `AlertDialog` composition for destructive/confirmation flows, including non-dismissible backdrops, explicit native request-close policy, cancel actions, and destructive actions.
- `FormGroup` legend/description/error composition with metadata inheritance for semantic `RadioGroup` descendants without collapsing child controls into one accessibility element.
- A pure anchored-overlay geometry resolver in `@beemvp/beeui-core` with deterministic placement, flip, shift, collision padding, available-space metadata, and RTL-aware alignment.
- An internal anchored-overlay runtime under `BeeUIProvider` with root/modal-local scopes, window-coordinate measurement, safe-area/keyboard metadata, deterministic portal ordering, and topmost-only scoped dismissal.
- Public `Popover` and `DropdownMenu` compositions with anchored placement, controlled/uncontrolled state where applicable, keyboard/focus behavior, topmost dismissal, and deterministic interaction semantics.
- Four production-oriented Showcase pattern packs containing 37 screens across Authentication/Onboarding, Dashboard/Finance, Commerce/Social, and Account/Settings.
- AI-native discovery surfaces through the `llms.txt` family and agent documentation.
- Maintained Expo package consumer, true bare React Native consumer, Vite + React Native Web consumer, routed demo, and Showcase applications.

### Fixed

- `@beemvp/beeui-ui` no longer leaks Babel-compiled `.d.js` / `.d.js.map` declaration artifacts into the packed tarball; the release verification inventory catches this class of packaging regression.
- Release reproducibility drift caused by nondeterministic packed publish-manifest serialization was removed by canonicalizing safe manifest regions while preserving order-sensitive export conditions.
- Web-delivery gate handling no longer lets a skipped duplicate check name overwrite a valid successful check.

### Changed

- Production pattern implementation under `apps/showcase/patterns/**` is treated as native-sensitive by the pull-request classifier because executable Showcase reaches those files; pattern-specific tests remain native-safe when not bundled.
- The component playground was retained as a maintained Component Gallery alongside Pattern Gallery navigation rather than being replaced.
- The release contract separates Linux cross-platform/Android proof, macOS native iOS compile proof, deterministic browser evidence, and native runtime/device interaction evidence.
- Bare React Native and other clean-consumer paths consume BeeUI through package artifacts instead of copying package source directly.
- Public package manifests expose built `dist/` output (dual ESM + CJS + `.d.ts`) as the primary package artifact while retaining governed source required for source ownership and styling discovery.
- Package `exports` define public root and granular subpath boundaries with explicit `types`, `source`, `react-native`, `import`, `require`, `browser`, and `default` conditions where applicable.
- Web theme import is `@import '@beemvp/beeui-tokens/theme.css'`.
- `react-native-teleport` is a peer dependency; `react-dom` is optional as BeeUI's own direct peer, subject to the compatibility matrix and transitive peer behavior.
- Anchored overlays use a runtime-selected portal transport with context-preserving Web/native paths, modal-local scopes, latest-request-wins measurement, and deepest-active-scope dismissal arbitration.
- Active-scope state is runtime-local; nested `BeeUIProvider`s reuse the application-root runtime while unrelated simultaneous application roots are not promised cross-root event ownership.
- The public Registry/CLI is no longer repository-only: external consumers can use `@beemvp/beeui-cli@next`; repository-local `pnpm beeui ...` remains a maintainer path.
- Documentation, landing, generated release state, and public Web checks now derive publication status from `docs/dist-tag-policy.md` and correctly model a published prerelease on `next`.

### Compatibility

The tested/declared compatibility line is governed by `docs/compatibility-matrix.md` and `docs/consumer-compatibility-report.md`. Key RC1 points include:

- React `>=19 <20` with React 19.2.3 used in maintained consumers;
- React Native `>=0.86.0 <0.87.0`, with 0.87 excluded on real native compile-failure evidence outside BeeUI's supported line;
- Expo SDK 57 as the maintained Expo line;
- React Native Web 0.21.x in the maintained Web consumer;
- Tailwind CSS `>=4 <5` and Uniwind `>=1.10.1 <2`;
- Chromium browser evidence for the current Web support contract.

### Known limitations

- iOS `pageSheet` / `formSheet` presentation remains experimental until the repository's native-runtime acceptance gate promotes it; `overFullScreen` is unaffected.
- Web support is currently evidence-bounded to Chromium with Expo/Metro and Vite + React Native Web. Firefox/WebKit, other bundlers, SSR, and SSG are not claimed unless separately documented.
- Native runtime evidence for some optional peer-backed components remains narrower than deterministic/compile evidence; see `docs/consumer-compatibility-report.md` and `docs/release.md` for exact evidence classes.

Stable `0.86.2` is a separate future release event. RC1 publication under `next` does not authorize or imply promotion of `latest`.
