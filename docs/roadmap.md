# BeeUI production roadmap

This document is the canonical pre-1.0 roadmap for taking BeeUI from a strong React Native UI foundation to a production-ready public UI system comparable in practical utility and polish to mature ecosystems such as Gluestack and Tamagui, without copying their architecture, proprietary assets, or product surface.

BeeUI is intentionally not trying to reproduce Tamagui's compiler/styling engine or Gluestack's exact component/template catalog. BeeUI keeps Uniwind + Tailwind CSS v4 as the current styling engine and focuses its own engineering effort on semantic design contracts, cross-platform behavior, accessibility, production patterns, distribution, verification, and developer experience.

## Current baseline

As of the current pre-1.0 baseline, BeeUI already has:

- React Native + TypeScript foundation targeting Expo and bare React Native;
- semantic light/dark tokens through `@beeui/tokens`;
- reusable `@beeui/core`, `@beeui/tokens`, and `@beeui/ui` packages;
- safe-area integration through `BeeUIProvider` + `SafeArea`;
- broad layout, typography, action, form, selection, navigation, disclosure, data-display, feedback, state, and application-pattern coverage;
- React Native core `Modal`-based `Dialog` and `AlertDialog`;
- a shared non-modal anchored-overlay geometry/runtime used by `Popover` and `DropdownMenu`;
- provider-scoped descriptor-based Toast notifications with queueing, persistence, actions, safe-area-aware stacking, and accessibility announcements;
- deterministic React Native Testing Library contract coverage;
- deterministic Chromium component visual regression with 28 canonical light/dark screenshots;
- an executable Showcase root that preserves component inspection and integrates a production Pattern Gallery;
- four production Pattern Gallery domains containing 37 screens:
  - Authentication + Onboarding: 9;
  - Dashboard + Finance: 8;
  - Commerce + Social: 12;
  - Account + Settings: 8;
- a declarative Showcase-local pattern catalog with local controlled demo adapters, state inspection, responsive mobile/desktop browsing, and light/dark support;
- durable Playwright integration QA owned by `apps/visual-regression`, including representative Component/Pattern smoke coverage and a full no-baseline 370-render Pattern Gallery acceptance matrix;
- Expo Web/Android/iOS bundling and Expo Prebuild verification;
- fresh package-installed bare React Native consumer verification;
- bare Android native compilation;
- Expo Showcase and fresh bare React Native native iOS Simulator compilation on a trusted macOS ARM64 runner;
- change-aware native iOS scheduling on pull requests plus persistent Xcode/DerivedData build caches;
- a phase-1 repository-local Registry + source-ownership CLI with deterministic validation, collision protection, dry-run, doctor/verify, and initial component coverage.

The remaining gap is no longer primarily “more basic components.” The highest-value work is interaction infrastructure, runtime/device evidence, theming depth, distribution, compatibility, documentation, and integrated product-level stress testing.

## Product direction

BeeUI 1.0 should provide a coherent combination of:

```text
semantic design system
+ behavior/accessibility-first React Native components
+ Expo + bare React Native portability
+ production screen patterns
+ source-ownership CLI
+ package distribution
+ real runtime/device verification
+ visual regression
+ custom theming
+ consumer-grade documentation
```

The goal is not maximum component count. A component is promoted into the public foundation only when its behavior, accessibility, platform, and ownership boundaries are clear.

## Promotion policy

Use the existing Rule of Two:

1. If existing BeeUI components can compose the requirement cleanly, compose it.
2. If the requirement is domain-specific, keep it pattern-local.
3. Promote a new public primitive/composition only when the same meaningful need appears in at least two screens/domains, or one use has sufficiently complex behavior/accessibility/platform requirements to justify a shared contract.
4. Create or update a `gap:` issue before implementation when a reusable gap is discovered through product work.

Do not add components solely to match another library's catalog.

---

# Wave 0 — Integrated Pattern Gallery

**Priority:** P0  
**Status:** COMPLETE / IMPLEMENTED

Wave 0 shipped the production-quality executable Showcase integration over all 37 production screens.

Implemented behavior:

- four domains and 37 screens registered through a declarative Showcase-local catalog;
- local controlled-state adapters without router/backend/auth/payment ownership;
- Pattern Gallery home → domain → screen navigation on narrow mobile;
- wide master/detail browsing at the 960px desktop breakpoint with a constrained 760px preview canvas;
- representative loading/empty/error/processing/warning state inspection;
- light/dark theme control through the existing Uniwind integration;
- demo-only Toast feedback where appropriate;
- controlled demo state reset when a screen is reopened;
- an executable Showcase root that exposes **Components** and **Patterns** while mounting only the active heavy surface;
- preservation/extraction of the pre-existing interactive component playground rather than replacing it;
- durable Playwright browser QA owned by `apps/visual-regression`, with representative normal-CI coverage and a full 5-viewport × 2-theme × 37-screen acceptance matrix using structural checks/in-memory screenshots rather than 370 committed PNG baselines;
- executable native Showcase integration, which makes production pattern implementation files native-sensitive CI inputs.

The Gallery is now the canonical product-quality inspection surface for BeeUI production patterns and an evidence source for future Rule-of-Two promotion decisions.

Do not mark later waves complete merely because Gallery integration exercises their current primitives.

---

# Wave 1A — Context-preserving anchored-overlay transport — COMPLETE

**Priority:** P0  
**Status:** COMPLETE (#35)

`OverlayPortal` is now a runtime-selected transport separated from the shared overlay runtime, and consumer React context declared below `BeeUIProvider` is preserved inside anchored overlay content:

- **web** → `ReactDOM.createPortal`;
- **native + New Architecture** → `react-native-teleport` (native context-preserving portal);
- **defensive fallback** (native without Fabric, or host view unregistered) → the legacy store host, which does not preserve context, with a one-time dev warning. This is a fallback, not an advertised production configuration — BeeUI peers React Native >= 0.85 where the New Architecture is the norm.

The accepted contracts are retained across transports: non-modal positioning, shared geometry/collision handling, safe-area and keyboard policy, deterministic topmost dismissal, nested overlay behavior, accessibility semantics, and no silent conversion to a full-screen React Native `Modal`. Each modal-class surface provisions a coherent **overlay scope** (generic — future `Select`/`Tooltip` inherit it): its own portal host, its own **measured geometry origin** (overlays inside a `pageSheet`/`formSheet` position relative to the sheet, not the root window), and its own **dismiss stack** (outside press, accessibility escape, web Escape, and hardware back are scope-local, so a root overlay behind a modal never steals dismissal from a modal-local child). Platform request-close is routed by platform: **Android** hardware back (reaching BeeUI only via `Modal.onRequestClose`) is intercepted child-first; **iOS/other** request-close (which can be a native sheet-swipe dismissal) is not intercepted, so React `Dialog` state never desyncs from the native modal.

Regression evidence:

- **Deterministic (jest)** transport + scope contract suite: native teleport preserves context; legacy fallback drops it; capability selection; open/unmount lifecycle; Dialog → Popover; Dialog → DropdownMenu (opens, preserves context, selects, closes, dialog stays open, child-first dismissal); modal request-close child-first on Android hardware back (back #1 closes the child and keeps the Dialog, back #2 closes the Dialog; a root Popover behind the Dialog is never consumed; AlertDialog child-first + `cancelOnRequestClose`; nested Dialog scope isolation); scope-aware dismissal (outside press and accessibility escape close the modal-local child even when a root overlay registered later); iOS `pageSheet`/`formSheet` request-close closes the Dialog rather than intercepting the child (controlled + uncontrolled); modal-local **geometry** resolves against the modal host origin, not the root (deterministic non-zero-origin case); an open overlay **remeasures its anchor when the host geometry changes**; **dismiss ordering is stable across geometry changes** (stable controller identity); synchronous (layout-effect) registration so a request-close immediately after open still routes child-first; controlled overlay with a delayed parent update does not duplicate registration or emit spurious callbacks; **independent-runtime isolation** (a global dismiss in one runtime never dismisses another's overlays); legacy insertion-order preserved on independent portal updates; legacy host-lifecycle cleanup and independent host-outlet remount (content regained, no leaked destinations).
- **Deterministic (Playwright, real Showcase web browser):** consumer context resolves inside Popover, DropdownMenu, a Dialog-nested Popover, and a Dialog-nested DropdownMenu (with selection closing the menu while the dialog stays visible); web Escape is scope-aware (closes the dialog-nested menu, Dialog stays open); and **CASE C** — a root Popover behind an open Dialog menu is not dismissed by Escape (`ReactDOM.createPortal`).
- **Final-head device runtime (exact final head):** Android (real `KEYCODE_BACK`) — root Popover context + back-to-close; Dialog → DropdownMenu context, in the modal-local host, back #1 closes the menu / back #2 closes the Dialog. iOS — root Popover/DropdownMenu context (teleport); Dialog `overFullScreen` → DropdownMenu in front + context preserved. The **root-behind-modal** ordering and **`pageSheet`/`formSheet`** geometry/request-close are proven **deterministically** (jest), not by live device sheet interaction, which remains a Wave 1B release gate along with VoiceOver/TalkBack focus.

The #35 regression now proves consumer-context preservation for the context-preserving transports and pins the legacy fallback's documented loss.

---

# Wave 1B — Runtime iOS/Android verification foundation

**Priority:** P0

BeeUI CI already proves native compilation. Compilation is not runtime interaction proof.

Add a protected runtime smoke tier using real iOS Simulator and Android Emulator/device execution.

Representative flows should cover:

- Showcase launch;
- light/dark switching;
- Pattern Gallery navigation;
- non-zero safe areas;
- Dialog and AlertDialog dismissal paths;
- Popover and DropdownMenu open/close/positioning;
- Toast delivery and dismissal;
- input focus and keyboard appearance;
- Android hardware back;
- basic scrolling and reduced-height layouts.

Recommended scheduling:

```text
pull request
  -> contract tests + visual Web + native compile as classified

main
  -> full native compile

nightly / release candidate
  -> real iOS + Android runtime smoke
```

Runtime automation must not turn every ordinary pull request into an hour-long device matrix.

---

# Wave 1C — Theme/token system v2

**Priority:** P0/P1

The current token package establishes semantic colors, spacing, and radius. Production theming needs a broader stable vocabulary.

Add or explicitly standardize:

### Typography

- font families;
- font sizes;
- line heights;
- weights;
- letter spacing.

### Sizing

- control heights;
- icon sizes;
- avatar sizes;
- content-width contracts.

### Elevation

- semantic shadows;
- native elevation mapping where applicable.

### Motion

- semantic durations;
- easing;
- reduced-motion policy.

### Focus

- ring width;
- offset;
- focus visibility policy.

### Branding

Support application branding by changing semantic theme values rather than editing component implementations.

Prefer Uniwind/Tailwind CSS variables and scoped/runtime variable capabilities over creating another BeeUI styling engine.

Do not build a Tamagui-style compiler or replace Uniwind without new evidence.

---

# Wave 1D — Documentation/release state synchronization

**Priority:** P0  
**Status:** ongoing maintenance rule

Documentation must always distinguish current implementation from future roadmap.

In particular:

- Registry/CLI phase 1 exists today but public `npx beeui` does not;
- native iOS compilation is automated today, while runtime/device interaction remains separate;
- Toast v1 exists today;
- visual regression phase 1 exists today;
- the executable Showcase exposes both the preserved Component Gallery and the implemented 37-screen Pattern Gallery today;
- durable Playwright Showcase integration QA is owned by `apps/visual-regression` today;
- production pattern implementation is a native-sensitive Showcase input today;
- issue #35 is resolved: the context-preserving overlay transport (Wave 1A) is complete and proven;
- packages remain private and are not publicly published to npm.

Any implementation PR that invalidates a current-state statement must update the corresponding canonical documentation in the same change or an explicitly linked synchronization PR.

---

# Wave 2A — Select

**Priority:** P0 after anchored-overlay transport decision

`Select` must be a real selection component, not a visual alias of `DropdownMenu`.

Minimum contract:

- controlled and uncontrolled state where appropriate;
- selected value and placeholder;
- disabled state;
- option/value semantics;
- labels/groups if justified;
- keyboard navigation;
- typeahead where practical;
- focus management/restoration policy;
- accessibility semantics;
- long option-list behavior;
- Web/native presentation policy;
- reuse of accepted anchored geometry/runtime infrastructure.

Do not couple Select to routers, forms libraries, persistence, or domain data fetching.

---

# Wave 2B — Tooltip

**Priority:** P0 after anchored-overlay transport decision

Tooltip owns non-interactive disclosure semantics; it must not inherit menu selection semantics.

Web contract should address:

- hover;
- keyboard focus;
- delay;
- Escape/dismiss behavior;
- placement;
- accessibility relationships.

Native policy must not fake browser hover. A native visual tooltip should exist only if interaction and accessibility evidence justify it; accessibility-label/hint behavior may be the correct native path for some usages.

---

# Wave 2C — Sheet / Bottom Sheet

**Priority:** P0 before 1.0 if BeeUI wants strong mobile-product coverage

Sheet remains separate from the centered Dialog kernel because its contract is gesture- and layout-heavy.

Minimum contract should address:

- controlled/uncontrolled open state;
- snap points/presentation sizes;
- backdrop and dismissal policy;
- drag handle;
- gesture behavior;
- keyboard interaction;
- bottom safe area;
- scrollable/nested content;
- inputs inside Sheet;
- Android hardware back;
- accessibility;
- reduced motion.

Potential higher-level compositions such as action sheets or mobile Select presentation should reuse a proven Sheet contract rather than creating independent gesture runtimes.

---

# Wave 2D — Slider

**Priority:** P1

Add only with a clear cross-platform gesture and accessibility contract covering value normalization, min/max/step, disabled state, keyboard interaction on Web, native accessibility actions, and theming.

---

# Wave 3A — Registry/CLI v2

**Priority:** P0/P1

The phase-1 repository-local CLI is implemented. The next tranche is productization, not reinvention.

Expand toward a publishable consumer workflow such as:

```sh
npx beeui init
npx beeui add button
npx beeui add dialog
npx beeui add --all
npx beeui doctor
```

Possible later capabilities:

- publishable CLI package/binary naming;
- expanded registry coverage for stable components;
- semver-aware external dependency diagnostics;
- optional package-manager mutation only behind an explicit safe contract;
- component diff/update assistance for source-owned components;
- version/integrity controls for any future remote registry.

Preserve current strengths:

- deterministic dependency resolution;
- no silent overwrite;
- dry-run parity with real add;
- path/symlink/traversal protection;
- no arbitrary executable registry payloads.

---

# Wave 3B — Public package distribution

**Priority:** P0/P1

Current packages remain `private: true` and packed tarballs are verification artifacts, not public distribution.

Before public 1.0, decide and implement supported public consumption paths.

Recommended direction:

1. package consumption for consumers who prefer centralized upgrades;
2. source ownership for consumers who prefer editable local component source.

Public package publication needs:

- final package names;
- package metadata;
- export maps;
- provenance/signing policy where applicable;
- public install documentation;
- clean-consumer verification from the actual published artifact;
- explicit compatibility ranges.

---

# Wave 3C — Release automation

**Priority:** P0/P1

Automate deterministic release preparation and publication:

- version bump;
- lockstep package versions;
- changelog cut;
- migration-note validation;
- tag;
- release candidate versions;
- package publication when enabled;
- GitHub Release;
- package smoke from published artifacts;
- release evidence retention.

Example release flow:

```text
0.x.y-rc.1
  -> exact-candidate CI/runtime gates
  -> review
  -> 0.x.y
```

---

# Wave 3D — Compatibility matrix

**Priority:** P0/P1

Do not claim a broad peer range that CI does not exercise.

At minimum, test:

- minimum supported React Native version;
- current supported React Native version;
- minimum supported Expo SDK if a range is documented;
- current supported Expo SDK;
- supported Node/pnpm toolchain;
- supported Uniwind/Tailwind major versions.

Compatibility claims in package manifests and docs must match this matrix.

---

# Wave 4A — Accessibility, RTL, large-text, and localization gates

**Priority:** P0/P1

Add systematic coverage beyond per-component semantic tests.

### Web

- automated accessibility audit for representative pages/components;
- target WCAG 2.2 AA where React Native Web exposes the relevant browser semantics;
- automated semantic-token contrast checks where deterministic.

### Native

- RNTL semantic contracts;
- VoiceOver release matrix;
- TalkBack release matrix;
- accessibility escape/back behavior;
- focus-order checks for representative flows.

### Layout stress

Test:

- RTL;
- 1.3x/1.5x font scaling;
- long English/German-like strings;
- Vietnamese;
- CJK;
- Arabic/RTL content;
- short-height/landscape layouts.

Pay particular attention to logical start/end semantics in anchored overlays, breadcrumbs, pagination, stepper, settings rows, and application chrome.

---

# Wave 4B — Performance benchmark harness

**Priority:** P1

BeeUI needs a measurable performance story rather than generic claims.

Benchmark the abstraction overhead BeeUI controls, for example:

- large Button/Badge sets;
- hundreds of ListItems/SettingsItems;
- large settings screens;
- theme switching;
- Dialog open latency;
- Popover/DropdownMenu open latency;
- large menu item counts;
- Toast queue activity;
- Pattern Gallery bundle/runtime footprint.

Track where useful:

- render/commit time;
- memory;
- Web bundle size;
- native bundle/startup delta;
- regression thresholds.

The benchmark question is “what overhead does BeeUI add over the underlying React Native + Uniwind stack?”, not “can BeeUI beat every other framework benchmark?”.

---

# Wave 4C — Motion system

**Priority:** P1

Create semantic motion contracts for common UI transitions:

- Dialog/AlertDialog;
- Popover/DropdownMenu;
- Toast;
- Tabs indicator;
- Collapsible/Accordion;
- Sheet;
- pressed/loading transitions.

The base component system should remain usable without requiring Reanimated everywhere. Use an optional enhanced-motion path where native-thread gestures/transitions materially justify it.

Reduced-motion behavior is required.

---

# Wave 5A — Consumer documentation website

**Priority:** P0/P1 for public launch

Markdown engineering contracts are not enough for a public UI product.

The public docs experience should include:

- Getting Started;
- Expo installation;
- bare React Native installation;
- provider setup;
- theming/custom branding;
- components;
- patterns;
- accessibility;
- platform-specific behavior;
- Registry/CLI;
- migration/versioning;
- troubleshooting;
- compatibility/support matrix.

Per component, document where relevant:

- preview;
- anatomy;
- usage;
- props;
- controlled/uncontrolled behavior;
- accessibility;
- iOS behavior;
- Android behavior;
- Web behavior;
- examples and limitations.

---

# Wave 5B — Public Showcase / Expo demo

**Priority:** P0/P1 for public launch

Publish the existing Showcase architecture as a product surface:

- browse components;
- browse production patterns;
- switch light/dark;
- provide an Expo/native demo path where practical;
- link install/docs/source.

The public demo should be built from the same contracts consumers receive, not a separate marketing-only implementation.

---

# Wave 5C — Starter projects

**Priority:** P1

Provide small verified starter consumers, not another application framework:

- Expo starter;
- bare React Native starter;
- optionally a Web-enabled React Native starter if the support contract is stable.

Starters should demonstrate provider/theme setup, source-owned component setup where applicable, and the current compatibility matrix.

---

# Wave 6 — Additional high-value components

**Priority:** P2, evidence-driven

Candidate areas after the P0/P1 foundation is stable:

### Table / DataTable foundation

Useful for admin/CRM/finance/tablet/Web. Core Table should own layout/semantics, not fetching, sorting state, pagination state, or virtualization policy unless those behaviors are separately justified.

### Calendar / Date / DateTime

High value for booking, CRM, finance, events, and travel, but requires deliberate locale, timezone, range-selection, keyboard, accessibility, and Web/native presentation contracts.

### Icon abstraction

Prefer a small semantic `Icon`/`createIcon` integration surface over bundling a large proprietary icon set. Keep compatibility with consumer-selected icon libraries and custom SVG sources.

Other components should be driven by Pattern Gallery/product evidence.

---

# Wave 7 — Expand production pattern library

**Priority:** P2 after infrastructure stabilization

The current 37 screens prove four product domains. A later target of roughly 60–80 high-quality production screens is reasonable only after the core/runtime/distribution work above is stable.

Potential packs:

- chat/messaging;
- calendar/scheduling;
- utility/offline/permissions/maintenance;
- business CRUD/list/detail/create/edit/filter flows;
- media/upload/gallery/player;
- navigation shells including tabs/sidebar/master-detail.

Patterns remain original BeeUI compositions. Do not copy proprietary Gluestack Pro, Tamagui Takeout, or other paid template source/assets.

---

# Explicit non-goals

BeeUI should not:

- build its own styling compiler merely to resemble Tamagui;
- replace Uniwind without concrete technical evidence;
- force Expo Router, React Navigation, or another router into public component contracts;
- own backend/data fetching;
- own auth SDKs;
- own payment SDKs;
- own React Hook Form/Zod or another validation library;
- add a chart framework to the core UI system;
- promote one-off domain components solely to increase component count;
- copy proprietary commercial templates or assets.

Router-neutral Expo + bare React Native support is an intentional product advantage, not a missing feature.

---

# BeeUI 1.0 exit criteria

BeeUI should not declare 1.0 solely because the package has many components.

A 1.0 candidate should have, at minimum:

## Component/runtime

- stable semantic token names;
- broad stable component coverage already proven by product patterns;
- context-preserving anchored-overlay transport (Wave 1A, complete);
- production-ready Select;
- production-ready Tooltip policy;
- production-ready Sheet if BeeUI claims first-class modern mobile application coverage;
- stable Toast v1 contract;
- no known architecture blocker hidden by documentation wording.

## Product proof

- integrated Pattern Gallery retained as a supported executable Showcase surface;
- at least the current 37 production screens retained and browsable;
- representative integration visual-regression/browser coverage;
- no unresolved cross-domain P0 gap discovered by the gallery.

## Quality

- deterministic behavioral tests;
- deterministic Web visual regression;
- native iOS and Android compile evidence;
- protected runtime simulator/device smoke;
- documented VoiceOver/TalkBack release process;
- RTL/large-text/long-content coverage;
- accessibility/contrast checks appropriate to each platform;
- performance benchmark baseline.

## Theming

- stable semantic colors;
- typography/sizing/elevation/motion/focus contracts;
- consumer branding/custom-theme path;
- reduced-motion policy.

## Distribution/DX

- publishable Registry/CLI workflow;
- substantial registry coverage for stable source-owned components;
- public package distribution decision implemented;
- release automation;
- compatibility matrix enforced by CI;
- consumer documentation website;
- public Showcase/demo;
- migration/versioning policy.

## Release integrity

- exact-candidate automated gates green;
- applicable runtime/device gates recorded;
- changelog complete;
- migration notes present for intentional breaking changes;
- public install artifacts proven in clean consumers.

---

# Roadmap maintenance

This file describes direction, not proof that a future item already exists.

When a roadmap item ships:

1. update this file's status/wording;
2. update `README.md` current-state summaries;
3. update `docs/architecture.md` if architecture boundaries changed;
4. update `docs/release.md` if verification/distribution changed;
5. update the relevant component/runtime document;
6. add a consumer-facing `CHANGELOG.md` entry when appropriate.

Current-state documentation must never describe implemented work as future work or future work as already supported.
