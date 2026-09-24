# Changelog

All notable consumer-facing changes to BeeUI are recorded here.

## Unreleased

No unreleased consumer-facing changes are recorded after `0.86.2-rc.3` yet.

## [0.86.2-rc.3] — 2026-09-24

Third release candidate on the `0.86.2` line. It carries the fixes from the BeePOS consumer verification of `0.86.2-rc.2` (BeeUI #568–#631, landed through #633). The frozen candidate source SHA and the packed-tarball identities are recorded in `docs/rc-candidate.md`. Published from `main@9b1fb09` through npm-release run `35977601708` (`operation=stage-rc`), with owner approval of each staged package.

### Distribution

- `@beemvp/beeui-core`, `@beemvp/beeui-tokens`, `@beemvp/beeui-ui`, and `@beemvp/beeui-cli` move in lockstep to `0.86.2-rc.3`.
- The prerelease channel stays npm dist-tag **`next`**. During the `0.86.2` prerelease line `latest` follows the newest complete, verified RC: once all four `0.86.2-rc.3` packages are published and verified, the owner moves `latest` for all four in one npm 2FA operation and records the observation (owner decision 2026-09-24, issue #561; `docs/dist-tag-policy.md`). The release workflow never moves dist-tags. The post-publication observation at 2026-09-24T09:02:17Z recorded `next` → `0.86.2-rc.3` with `latest` still on `0.86.2-rc.1`. After verification the owner moved `latest`, and at 2026-09-24T09:27:49Z all four packages resolved both `next` and `latest` to `0.86.2-rc.3`.
- Public RC install path:

  ```bash
  npm install @beemvp/beeui-ui@next @beemvp/beeui-core@next @beemvp/beeui-tokens@next
  npx @beemvp/beeui-cli@next --help
  ```

- Generated public docs, `llms.txt` surfaces, release state, and component portal pages are regenerated from the dist-tag policy; they name `0.86.2-rc.3` as the current candidate and state the last observed registry dist-tags separately.

### Fixed

- **Sheet (native) no longer crashes without `SheetProvider`** (#629). With the rc.1 root wiring (an outer `BottomSheetModalProvider`, no `SheetProvider`) the sheet opens instead of blanking the app; with no gorhom provider at all it stays closed. Either way one development error names the required `BeeUIProvider > SheetProvider > app` wiring.
- **Select commits the option under the pointer** (#612). Hovering an option no longer scrolls the list, so a press on a long, scrolling list can no longer commit a different option or select nothing.
- **Select inside `Field`** (#630) is named by the field label and exposes required, invalid, disabled and the field's description or error, like `Input`. `Input` and `Select` now point `aria-describedby` at the Field's helper text on Web.
- **Keys typed in a focused `Input`/`SearchInput` bubble to `window` and `document` on Web** (#606); React ancestors still treat the key as handled.
- **Typography and contrast:** `text-caption` keeps its size and the default text colour (#599); Avatar fallback initials scale with the avatar size (#599); plain table cells use the foreground colour in dark (#604); the current Stepper step title meets 4.5:1 (#631).
- **Input/SearchInput** no longer clip descenders at accessibility text sizes (#589). **SegmentedControl** sizes segments from their labels and no longer breaks words mid-word in narrow containers (#600). **IconButton `size="sm"`** renders at its small size; native keeps a 44dp hit target (#568). Wrapped button labels are centred (#631).
- **Forms:** a Checkbox list inside `FormGroup` is exposed as a group labelled by its legend, linked to its error and marked invalid/required (#571). `KeyboardAwareScreen` no longer calls the deprecated `currentlyFocusedField()` and reserves keyboard space on iOS too, so the last field inside a shell layout scrolls above the keyboard (#588, #631).
- **Web accent colours:** Spinner, Switch and Input placeholder resolve their colour from theme variables, so a late-loaded stylesheet no longer logs the `accent-primary` warning (#592).
- **Web popovers opened after the page scrolls** stay adjacent to their trigger.

### Changed

- `FormGroup` no longer appends an English "required" to its legend by default; pass a localized `requiredAccessibilityLabel`, as with the other form primitives (#631).
- Native bottom toasts dock above a standard bottom-navigation band (safe-area inset + 80) so they do not cover a tab bar (#631).

### Added

- `Select` `locale` prop for its built-in placeholder copy (`vi-VN` → "Chọn một mục"; other locales fall back to English) (#587).

## [0.86.2-rc.2] — 2026-09-22

Second release candidate on the `0.86.2` line. It carries the consumer-audit batch from the BeePOS and BeeECOM validation programs (BeeUI #543–#615, landed through #617 and #618) and the follow-up portal-page regeneration (#621). The frozen candidate source SHA and the packed-tarball identities are recorded in `docs/rc-candidate.md`. Publication happens only through the protected `npm-release` workflow (`operation=stage-rc`) with owner approval of each staged package.

### Distribution

- `@beemvp/beeui-core`, `@beemvp/beeui-tokens`, `@beemvp/beeui-ui`, and `@beemvp/beeui-cli` move in lockstep to `0.86.2-rc.2`.
- The prerelease channel stays npm dist-tag **`next`**. This candidate does not deliberately promote stable **`latest`**; the observation that `latest` also resolved to `0.86.2-rc.1` after the bootstrap publish is re-verified against the live registry once the rc.2 staged publish is approved (`docs/dist-tag-policy.md`).
- Public RC install path:

  ```bash
  npm install @beemvp/beeui-ui@next @beemvp/beeui-core@next @beemvp/beeui-tokens@next
  npx @beemvp/beeui-cli@next --help
  ```

- `@beemvp/beeui-ui` gains the `./toolbar` export subpath (63 granular subpaths).
- Generated public docs, `llms.txt` surfaces, release state, and component portal pages are regenerated from the dist-tag policy so they describe this candidate.

### Added

- `Toolbar` / `ToolbarItem` family with priority-based overflow into a dropdown menu (`priority`, `overflowAccessibilityLabel`, `icon`, `disabled`, `onPress`), overflow math that measures the trigger and gaps, and roving keyboard focus whose sequence is derived only from items that registered a focusable child (overflow trigger is the last stop). New Registry item, export subpath, Showcase fixture, and component page.
- `Tabs`: `TabsList scrollable` and `addon`; `TabsTrigger closable`, `onClose`, and `closeAccessibilityLabel` (required with `closable`; BeeUI does not synthesize an English default). Arrow-key roving focus with wrap, Home/End, and RTL for scrollable tablists; in a Web scrollable tablist the close control stays out of sequential Tab order and Delete on the focused closable tab closes it. Closing the selected tab moves selection to the previous sibling, else the next.
- `Sheet`: public `SheetProvider` (with `SheetProviderProps`). Native apps mount it directly below `BeeUIProvider`; it owns the `@gorhom/bottom-sheet` modal provider and `GestureHandlerRootView` wiring so gorhom's portal host sits below BeeUI's runtime contexts by construction. Web and the RN `Modal` fallback are pass-through. `SheetContent bridgeContexts` preserves consumer-owned React contexts (query, i18n, navigation, app stores) across gorhom's store-backed portal; BeeUI's own Sheet, safe-area, overlay, toast, and theme state are bridged automatically.
- `Select listProps` for the Web list host, which is a plain overflow `View` rather than a `ScrollView` (#612).
- `Table density` (`TableDensity`; new `spacing.row-dense` 48 token), `TableCell align` (`TableAlign`), and `TableRow onPress`. On Web, row activation that originates from an interactive descendant (click, Enter, Space) is ignored.
- `BeeUIProvider toastPlacement` and the `ToastPlacement` type; toasts default to the bottom edge on native. `SafeArea toastPlacement` follows the same contract.
- `OTPInput appearance="segmented"`.
- `IconButton size` and `count` (with `countClassName`); `ListItem active`; `Chip` static tag variant (`interactive={false}`) and `ChipGroup allowDeselect`; `DropdownMenuItem description` (with `descriptionClassName`); `Stepper orientation`; `Screen scroll`; `SearchInput trailing` (with `containerClassName`); `Field requiredLabel`; `Label presentational`.
- Prerequisites lines on the hand-written docs pages, runnable example blocks and pattern contract blocks that are `tsc`-verified, and a Toolbar Registry entry.

### Fixed

- Web ARIA across `Tabs`, `Pagination`, `Stepper`, `Accordion`, `Collapsible`, `Progress`, `Calendar`, `DropdownMenu`, `Switch`, and `Field`; `AlertDialog` carries the `alertdialog` role; exactly one labelled dialog owner on Web, including under reduced motion, where the preference is now read synchronously so the first open render already has the right role.
- `BeeThemeScope` on Web: `theme.css` emitted `:root:where(.theme …)` blocks that could only match `<html>`, so nested scopes never applied. Scoped semantic variables are now emitted as un-anchored `.theme {}` blocks (packed-consumer reproduction and Playwright proof; the packed Vite consumer asserts scoped values differ).
- `Sheet` never presented on iOS in a real Expo 57 consumer (#584): `SheetContent` no longer calls `dismiss()` on mount, content gets an in-flow `flex: 1` box so it fills the snap point, gorhom's container no longer collapses the sheet into one accessibility element, a rapid close→reopen race is fixed with presentation/dismiss generation counters, and the toast viewport renders topmost inside the sheet. Proven on the iOS simulator; a real-device run is still recommended.
- Runtime: styleq crash on `className={cond ? x : undefined}`; `SafeArea className`, with insets and caller padding composed additively instead of dropping a safe edge; Sheet viewport geometry; `Select` mouse pick in scrolled lists; `Input` Dynamic Type and VoiceOver value, and a masked `Input` no longer exposes its value through `accessibilityValue.text`; `KeyboardAwareScreen` scroll-into-view on iOS; dark-mode `Table` header and `Avatar` contrast; `IconButton` renders the `Button` directly when `count` is absent and keeps a 44dp width at `size="sm"`.
- Date pickers: focusing the selected day no longer scrolls the document to the popover's off-screen measuring position.
- i18n: no injected English "required", "Show", or "Hide" copy; `Field required` and `PasswordInput` follow a localized-copy contract; DatePicker and DateTimePicker locale copy.
- Docs generators: prop defaults, optionality, and phantom types in the generated props tables; stale "maintainer checkout" / "unpublished" claims; component portal pages regenerated after the final follow-ups so the published pages match the generators (#621).

### Changed

- `Select scrollViewProps` on Web is deprecated in favor of `listProps`. View-compatible fields are still forwarded to the Web list host for migration, with `listProps` winning conflicts, and a development warning asks Web consumers to migrate; `ScrollView`-only fields have no Web effect. Native behavior is unchanged.
- Native `Sheet` app-root wiring moved from consumer-mounted `GestureHandlerRootView` + `BottomSheetModalProvider` to BeeUI's `SheetProvider` below `BeeUIProvider`. `SheetProvider` deliberately does not reuse an already-present outer gorhom provider; that arrangement is reported as a development-time misconfiguration while BeeUI mounts its own inner provider.
- `DateTimePicker locale` now localizes the picker's own copy (placeholder, Done); `vi-VN` copy added.
- Token lifecycle manifest governs 107 stable tokens (was 106) with the new `spacing.row-dense` token.
- `docs/dist-tag-policy.md`, the README, the AI cookbook, and the generators state the real npm behavior observed for rc.1 (`latest` and `next` both resolving to `0.86.2-rc.1` until the first stable publish) as an observation with its mechanism unestablished, instead of asserting general npm first-publish semantics (owner decision 2026-09-19).
- `docs/compatibility-matrix.md` documents the Expo consumer-starter pins (`react-native@0.86.3`, `@expo/metro-runtime@~57.0.16`) as a deliberate narrow exception that does not widen the repo-tested `0.86.2` claim.

### Compatibility

The governed line is unchanged from rc.1 (`docs/compatibility-matrix.md`, `docs/consumer-compatibility-report.md`): React `>=19 <20`, React Native `>=0.86.0 <0.87.0` with `0.86.2` as the repo-tested pin, Expo SDK 57, React Native Web 0.21.x, Tailwind CSS `>=4 <5`, Uniwind `>=1.10.1 <2`, Chromium browser evidence.

### Known limitations

- Native runtime smoke for `Sheet` is wired for iOS only; Android smoke is not wired, and a real-device run of the #584 fix is still recommended.
- Web keydown bubbling through react-native-web's Modal is documented as an upstream root cause (#606) and its spec is kept as `fixme`; the native half of #609 is documented rather than changed.
- iOS `pageSheet` / `formSheet` presentation remains experimental until the native-runtime acceptance gate promotes it; `overFullScreen` is unaffected.
- Web support remains evidence-bounded to Chromium with Expo/Metro and Vite + React Native Web.

Stable `0.86.2` is a separate future release event. rc.2 publication under `next` does not authorize or imply promotion of `latest`.

### Upgrading from 0.86.2-rc.1

*Added to this entry after `0.86.2-rc.2` publication (2026-09-23), from rc.2 consumer verification findings. Not part of the original rc.2 release notes above.*

If your app already installed `0.86.2-rc.1`, four changes need action when you move to `0.86.2-rc.2`. Full detail: [Migration & versioning](https://github.com/beobungbu/BeeUI/blob/main/apps/docs/src/content/docs/guides/migration-versioning.md#upgrading-from-0862-rc1-to-0862-rc2).

1. **`Sheet` native root wiring changed and is now required.** rc.1's guidance was `GestureHandlerRootView` > `BottomSheetModalProvider` > `BeeUIProvider`. On rc.2, mount BeeUI's public `SheetProvider` directly below `BeeUIProvider` instead (`BeeUIProvider` > `SheetProvider` > app) and remove the outer `BottomSheetModalProvider` — `SheetProvider` installs `GestureHandlerRootView` and gorhom's `BottomSheetModalProvider` itself, and deliberately does not reuse an already-present outer one.
2. **Context bridging for Sheet content.** `SheetContent` only sees React contexts mounted above `SheetProvider`. Keep app-wide providers (query client, i18n, navigation, app stores) above `SheetProvider`; pass a screen-scoped provider's value through `SheetContent`'s `bridgeContexts` prop instead.
3. **`Calendar` day cells are now `role="gridcell"` on Web** (previously `"cell"`). Update Web test selectors from `getByRole('cell')` to `getByRole('gridcell')` for calendar day cells; native is unchanged.
4. **Workarounds you can drop:** per-table row density classes (use `Table density="dense48"`); a wrapping pressable for row-level navigation inside `TableRow`/`TableCell` (use `TableRow onPress`); a custom closable tab strip (use `TabsList scrollable` with `TabsTrigger closable`); a hover wrapper around `DropdownMenuTrigger` (it now carries its own hover affordance); manually splitting a `Button`'s label across two `Text` nodes for large text (a long label now wraps and the button grows instead of clipping).

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
