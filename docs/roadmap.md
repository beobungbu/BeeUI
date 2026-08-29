# BeeUI 1.0 Roadmap

> **Canonical target:** BeeUI `1.0.0`  
> **Program tracker:** [#114](https://github.com/beobungbu/BeeUI/issues/114)  
> **Snapshot:** 2026-08-29  
> **Authoritative base at roadmap creation:** `fe8733345ee09720808ec0f6a4db93be9ff4a78f`  
> **Execution model:** one roadmap point = one GitHub issue; implementation PRs require independent review and exact-head evidence.

This document supersedes the previous pre-1.0 ordering. It reconciles the current BeeUI repository after Theme Tokens v3 with the Claude competitive/BeeMVP reports and the updated 2026 market scan.

## Non-negotiable release rule

**Preparation is not publication.** BeeUI packages and the BeeUI CLI must become completely release-ready—packable, installable, provenance-ready and tested from clean consumers—but **must not be published to npm or exposed as a stable public CLI until the repository owner explicitly commands the BeeUI 1.0 release**.

The only task allowed to perform stable publication is **R11.12 / #254**, and even that task must not execute merely because all technical gates are green.

## BeeUI 1.0 hard product gates

BeeUI 1.0 requires all of the following before release authorization:

- overlay/runtime correctness and explicit native presentation support policy;
- tested React Native / Expo / Web / toolchain compatibility;
- RTL, Dynamic Type/large text, localization, keyboard, VoiceOver/TalkBack and reduced motion;
- Tooltip;
- Sheet / BottomSheet;
- **Table / DataTable**;
- **Calendar / DatePicker / DateTimePicker**;
- performance and package-footprint baselines;
- OSS/security/release governance;
- publication-ready packages and CLI, still unpublished;
- public/release-ready documentation and Showcase;
- **AI-native developer support** via `llms.txt` family + agent-development contract + agent regression suite;
- **one production-grade demo/reference application on iOS, Android and Web**;
- clean independent consumers and one immutable exact-candidate release evidence set.

## Current baseline to preserve

Already complete on `main` and therefore not future work:

- React Native + TypeScript monorepo split into `@beeui/core`, `@beeui/tokens`, `@beeui/ui`;
- Theme Tokens v3 canonical DTCG source/codegen, lifecycle, semantic-consumption guard, scoped themes, runtime overrides/readers, density, high contrast, dataviz and motion contracts;
- broad stable component surface including production Select;
- context-preserving anchored-overlay architecture used by Popover/DropdownMenu/Select;
- Dialog/AlertDialog, Toast, KeyboardAwareScreen and safe-area contracts;
- 37-screen Pattern Gallery plus Chromium visual/integration QA;
- Expo + bare React Native package/bundle/native-compile verification;
- native runtime-smoke foundation;
- source-ownership registry/CLI with full current stable public component-module coverage.

The remaining problem is not basic component count. It is runtime hardening, missing high-value 1.0 surfaces, accessibility/compatibility proof, distribution readiness, public/agent DX and product-level evidence.

## Dependency spine

```text
R0
├─> R1 runtime hardening
├─> R2 compatibility
└─> R3 accessibility foundation
      ↓
R4A Tooltip + R4B Sheet + R4E Table + R4F Date/Time
      ↓
R5 performance / R6 OSS-security
      ↓
R7 package readiness + R8 CLI readiness
      ↓
R9 docs + AI-native
      ↓
R10 independent consumers + production demo
      ↓
R11 freeze + immutable RC-ready evidence
      ↓
STOP
      ↓ only after explicit owner command
R11.12 publish → R11.13 verify
```

Parallel work is allowed only when dependencies and shared-file collision risk make it safe. Integration touching shared exports, registry, tokens or release contracts should be serialized.

---

# R0 — Program synchronization & governance

Make the roadmap truthful before new implementation, reconcile stale Theme v3 state, synchronize canonical docs, establish the single 1.0 tracker/taxonomy and protect `main`.

- **R0.1** [#115](https://github.com/beobungbu/BeeUI/issues/115) — close stale Theme v3 issues #65/#66 with traceable evidence.
- **R0.2** [#116](https://github.com/beobungbu/BeeUI/issues/116) — supersede obsolete draft PR #86 rather than reintroducing pre-v3 work.
- **R0.3** [#117](https://github.com/beobungbu/BeeUI/issues/117) — synchronize README, roadmap, architecture, release/native docs, components and changelog.
- **R0.4** [#114](https://github.com/beobungbu/BeeUI/issues/114) — maintain the single BeeUI 1.0 parent tracker.
- **R0.5** [#118](https://github.com/beobungbu/BeeUI/issues/118) — establish 1.0 priority/area labels and milestone taxonomy.
- **R0.6** [#119](https://github.com/beobungbu/BeeUI/issues/119) — protect `main` and the eventual release path with real required checks and no force-push/deletion.

# R1 — Runtime hardening

No overlay may remain invisibly open because an async native measurement callback never arrives. Preserve the existing latest-request-wins, scope and dismissal architecture.

- **R1.1** [#120](https://github.com/beobungbu/BeeUI/issues/120) — ADR for unresponsive native `measureInWindow()` callbacks.
- **R1.2** [#121](https://github.com/beobungbu/BeeUI/issues/121) — bounded measurement completion state machine.
- **R1.3** [#122](https://github.com/beobungbu/BeeUI/issues/122) — deterministic host measurement fallback.
- **R1.4** [#123](https://github.com/beobungbu/BeeUI/issues/123) — anchor-unavailable completion and cleanup.
- **R1.5** [#124](https://github.com/beobungbu/BeeUI/issues/124) — development diagnostics without noisy production logging.
- **R1.6** [#125](https://github.com/beobungbu/BeeUI/issues/125) — load-bearing race/fallback/ABA/unmount regression matrix.
- **R1.7** [#126](https://github.com/beobungbu/BeeUI/issues/126) — real iOS/Android overlay runtime stress.
- **R1.8** [#127](https://github.com/beobungbu/BeeUI/issues/127) — independent final review and closure of #59.
- **R1.9** [#128](https://github.com/beobungbu/BeeUI/issues/128) — formalize `pageSheet`/`formSheet` support/quarantine policy for 1.0.

# R2 — Compatibility contract

Replace optimistic peer ranges with a tested support matrix. If BeeUI cannot continuously test a combination, narrow the public promise.

- **R2.1–R2.10:** [#129](https://github.com/beobungbu/BeeUI/issues/129), [#130](https://github.com/beobungbu/BeeUI/issues/130), [#131](https://github.com/beobungbu/BeeUI/issues/131), [#132](https://github.com/beobungbu/BeeUI/issues/132), [#133](https://github.com/beobungbu/BeeUI/issues/133), [#134](https://github.com/beobungbu/BeeUI/issues/134), [#135](https://github.com/beobungbu/BeeUI/issues/135), [#136](https://github.com/beobungbu/BeeUI/issues/136), [#137](https://github.com/beobungbu/BeeUI/issues/137), [#138](https://github.com/beobungbu/BeeUI/issues/138).
- Required outcomes: explicit React/RN/Expo/Node/Uniwind/Tailwind/Web rows; RN 0.86 and 0.87 clean consumers; evidence-based RN 0.85 decision; capped React major peers; Node 22/24 tooling proof; independent Web consumer; scheduled compatibility CI; mechanically synchronized compatibility docs/package peers/CLI diagnostics.

# R3 — Accessibility, RTL, Dynamic Type & localization

RTL and large text are system properties, not per-component polish. New 1.0 surfaces are not complete until they pass the same accessibility contract.

- **R3.1–R3.12:** [#139](https://github.com/beobungbu/BeeUI/issues/139) through [#150](https://github.com/beobungbu/BeeUI/issues/150).
- Required outcomes: direction architecture ADR; logical start/end audit; RTL overlay and component stress; Dynamic Type/font scaling through 2x stress; Vietnamese/long English/CJK/Arabic content; Web axe gate; real keyboard/focus matrix; VoiceOver and TalkBack release matrices; reduced-motion acceptance; accessibility docs matching tested platform behavior.

# R4A — Tooltip — hard 1.0 gate

Tooltip must reuse the anchored-overlay runtime and remain distinct from menu/select semantics. Web owns hover/focus/delay; native behavior must be platform-honest and must not fake browser hover.

- **R4A.1–R4A.5:** [#151](https://github.com/beobungbu/BeeUI/issues/151)–[#155](https://github.com/beobungbu/BeeUI/issues/155).
- Required outcomes: reviewed product contract; real Web hover/focus/delay/Escape behavior; explicit native accessibility/visual policy; deterministic/browser/native regression matrix; package export, registry closure, Showcase, docs and AI metadata.

# R4B — Sheet / BottomSheet — hard 1.0 gate

Sheet is a separate gesture/layout-heavy surface. BeeUI owns semantics/API/tests; it should prefer a proven optional gesture engine if that best satisfies the contract instead of writing physics for its own sake.

- **R4B.1–R4B.6:** [#156](https://github.com/beobungbu/BeeUI/issues/156)–[#161](https://github.com/beobungbu/BeeUI/issues/161).
- Required outcomes: dependency/gesture ADR; stable controlled/uncontrolled API; snap/presentation sizes, backdrop, drag handle, keyboard, nested scroll, safe area, Android Back, a11y, RTL, Dynamic Type, reduced motion; deliberate Web policy; exact-head native runtime proof; source-ownership closure.

# R4C — Adaptive Select — P1 decision

- **R4C** [#162](https://github.com/beobungbu/BeeUI/issues/162) — after Sheet stabilizes, decide whether Select gains `popover | sheet | dialog | auto` presentation while keeping one selection-state implementation. This may be explicitly deferred if anchored Select remains the accepted 1.0 native policy.

# R4D — Slider — stretch decision

- **R4D** [#163](https://github.com/beobungbu/BeeUI/issues/163) — either ship a complete cross-platform Slider contract or explicitly defer it. Partial public Slider code is not acceptable.

# R4E — Table / DataTable — hard 1.0 gate

BeeUI 1.0 **must include Table/DataTable**. BeeUI owns semantic table layout, row/cell composition, accessibility, density and responsive presentation. It does not own fetching/backend query state. Sorting/filtering/selection must remain caller-controlled or narrowly headless.

- **R4E.1** [#164](https://github.com/beobungbu/BeeUI/issues/164) — architecture ADR: ownership, responsive policy, semantics, virtualization boundary, performance targets.
- **R4E.2** [#165](https://github.com/beobungbu/BeeUI/issues/165) — stable Table/DataTable anatomy/API including header/body/footer, rows/cells, caption, states, selection/sort intent, density and responsive strategies.
- **R4E.3** [#166](https://github.com/beobungbu/BeeUI/issues/166) — Web table/grid semantics, keyboard, sort/selection announcements, zoom, RTL and accessibility audit.
- **R4E.4** [#167](https://github.com/beobungbu/BeeUI/issues/167) — native phone/tablet rendering, VoiceOver/TalkBack semantics, hit targets, RTL and 2x font scaling.
- **R4E.5** [#168](https://github.com/beobungbu/BeeUI/issues/168) — performance envelope at representative 100/500-row scale and explicit virtualization limits.
- **R4E.6** [#169](https://github.com/beobungbu/BeeUI/issues/169) — production CRM/finance/admin patterns and visual acceptance across phone/tablet/Web/theme/density/RTL/large text.
- **R4E.7** [#170](https://github.com/beobungbu/BeeUI/issues/170) — package/registry/docs/AI metadata and clean package/source-owned consumer proof.

# R4F — Calendar / DatePicker / DateTimePicker — hard 1.0 gate

BeeUI 1.0 **must include Calendar, DatePicker and DateTimePicker**. Date-only values must not silently shift day because of timezone conversion. BeeUI does not own backend timezone storage or business-calendar rules.

- **R4F.1** [#171](https://github.com/beobungbu/BeeUI/issues/171) — date/time architecture ADR: value model, timezone boundary, locale/week-start ownership, native-system vs custom Calendar responsibility, Web/Sheet/Popover presentation.
- **R4F.2** [#172](https://github.com/beobungbu/BeeUI/issues/172) — stable Calendar API with month navigation, bounds, disabled/today state, locale/week start, RTL/large-text/theming.
- **R4F.3** [#173](https://github.com/beobungbu/BeeUI/issues/173) — stable DatePicker API with Field validation, focus restoration, keyboard/native presentation and clearing policy.
- **R4F.4** [#174](https://github.com/beobungbu/BeeUI/issues/174) — stable DateTimePicker with coherent date+time value model and explicit 12/24h/timezone boundaries.
- **R4F.5** [#175](https://github.com/beobungbu/BeeUI/issues/175) — Vietnamese/English/Arabic/CJK, week-start, DST and date-only timezone regression matrix.
- **R4F.6** [#176](https://github.com/beobungbu/BeeUI/issues/176) — Calendar/date accessibility and real keyboard acceptance.
- **R4F.7** [#177](https://github.com/beobungbu/BeeUI/issues/177) — visual + iOS/Android/Web runtime acceptance.
- **R4F.8** [#178](https://github.com/beobungbu/BeeUI/issues/178) — package/registry/docs/AI metadata and clean consumer proof.

# R5 — Performance & footprint

BeeUI must have a measurable performance story rather than generic claims.

- **R5.1–R5.8:** [#179](https://github.com/beobungbu/BeeUI/issues/179)–[#186](https://github.com/beobungbu/BeeUI/issues/186).
- Required outcomes: reproducible benchmark harness; render/update stress; overlay open latency; theme runtime switching; Table 100/500-row scale; tarball/Web/Metro footprint; granular export decision; evidence-based regression budgets; public methodology with explicit non-claims.

# R6 — OSS, security & repository governance

Prepare BeeUI for credible public OSS use before release publication.

- **R6.1–R6.10:** [#187](https://github.com/beobungbu/BeeUI/issues/187)–[#196](https://github.com/beobungbu/BeeUI/issues/196).
- Required outcomes: secret/history/asset audit; LICENSE; SECURITY.md; CONTRIBUTING.md; Code of Conduct; issue/PR templates; GitHub Actions/fork/self-hosted-runner hardening; dependency automation; public-repository transition only after audits pass; final branch/tag/release ruleset.

# R7 — Public packages — release-ready only, DO NOT publish

All package work in R7 is preparation. It must end with deterministic packed artifacts and clean-consumer proof, not npm publication.

- **R7.1–R7.12:** [#197](https://github.com/beobungbu/BeeUI/issues/197)–[#208](https://github.com/beobungbu/BeeUI/issues/208).
- Required outcomes: distribution ADR; final package names; metadata; source/built output format; export maps; tarball inventory; prerelease-equivalent retained artifacts; Expo/bare RN/Web clean consumers; trusted publishing/OIDC/provenance setup; dist-tag policy; integrity checks; package compatibility report.
- **Hard guard:** no `npm publish`, no stable dist-tag mutation and no package release before R11.12 receives explicit owner authorization.

# R8 — Public CLI — release-ready only, DO NOT publish

Productize the proven repository-local source-ownership engine while preserving its deterministic/security invariants.

- **R8.1–R8.11:** [#209](https://github.com/beobungbu/BeeUI/issues/209)–[#219](https://github.com/beobungbu/BeeUI/issues/219).
- Required outcomes: packed publication-ready CLI; `init`, `list`, `add`, `add --all`, `--dry-run`, `--overwrite`, `doctor/verify`, help/version; security regression suite; semver-aware dependency diagnostics; Expo/bare/Web project detection; config policy; explicit package-manager mutation decision; registry delivery/integrity model; full stable 1.0 registry closure; Node 22/24 clean-consumer E2E; optional safe diff/update assistance.
- **Hard guard:** do not publish the CLI before owner-authorized R11.12.

# R9 — Docs, Showcase & AI-native development — hard 1.0 gate

AI-native support must be tested, not marketing copy.

- **R9.1–R9.6:** [#220](https://github.com/beobungbu/BeeUI/issues/220)–[#225](https://github.com/beobungbu/BeeUI/issues/225) — release-ready public docs, per-component documentation contract, executable examples, pattern docs, public Web Showcase and native preview path.
- **R9.7** [#226](https://github.com/beobungbu/BeeUI/issues/226) — canonical `/llms.txt`, `/llms-full.txt`, `/llms-components.txt`, `/llms-patterns.txt`, generated/validated against stable APIs and support boundaries.
- **R9.8** [#227](https://github.com/beobungbu/BeeUI/issues/227) — agent-development contract and prompt cookbook covering setup, package/source ownership, Rule of Two, a11y/RTL/large text, Table/date ownership boundaries, overlays/Sheet and contribution verification.
- **R9.9** [#228](https://github.com/beobungbu/BeeUI/issues/228) — repeatable fresh-agent regression suite that actually builds/forms/Table/date/Tooltip/Sheet/theme flows and mechanically validates generated output.
- **R9.10** [#229](https://github.com/beobungbu/BeeUI/issues/229) — MCP decision is stretch; static canonical llms content + agent contract + regression proof satisfy the hard AI-native gate without requiring a server.

# R10 — Independent consumers & production demo — hard 1.0 gate

BeeUI 1.0 must prove itself outside its own monorepo and must ship one credible production-grade reference app, not merely a component catalog.

- **R10.1** [#230](https://github.com/beobungbu/BeeUI/issues/230) — clean Expo package-consumption starter using packed unpublished artifacts.
- **R10.2** [#231](https://github.com/beobungbu/BeeUI/issues/231) — source-ownership starter using packed unpublished CLI/registry.
- **R10.3** [#232](https://github.com/beobungbu/BeeUI/issues/232) — true bare RN starter/consumer.
- **R10.4** [#233](https://github.com/beobungbu/BeeUI/issues/233) — independent Web reference consumer.
- **R10.5** [#234](https://github.com/beobungbu/BeeUI/issues/234) — at least one real-world consumer outside the BeeUI monorepo.
- **R10.6** [#235](https://github.com/beobungbu/BeeUI/issues/235) — fresh coding agent builds a reference app from canonical/public context only.
- **R10.7** [#236](https://github.com/beobungbu/BeeUI/issues/236) — production demo architecture/spec for iOS + Android + Web.
- **R10.8** [#237](https://github.com/beobungbu/BeeUI/issues/237) — functional multi-screen demo: dashboard, table/list, detail/edit form, scheduling/date-time, settings/accessibility, modal/anchored actions, Sheet and states.
- **R10.9** [#238](https://github.com/beobungbu/BeeUI/issues/238) — platform/runtime quality matrix across phone/tablet/Web, portrait/short-height, themes, RTL and large text.
- **R10.10** [#239](https://github.com/beobungbu/BeeUI/issues/239) — production engineering quality: strict TS, tests/E2E, service/state boundaries, error recovery, reproducible builds and performance smoke.
- **R10.11** [#240](https://github.com/beobungbu/BeeUI/issues/240) — real rendered visual/product polish review.
- **R10.12** [#241](https://github.com/beobungbu/BeeUI/issues/241) — fresh coding agent can extend/fix the production demo from canonical BeeUI context.
- **R10.13** [#242](https://github.com/beobungbu/BeeUI/issues/242) — classify all consumer/demo findings before API freeze.

# R11 — API freeze, RC evidence & owner-gated release

Build one immutable exact-candidate evidence set, run every required gate, then **STOP**. Technical readiness does not imply publication permission.

- **R11.1** [#243](https://github.com/beobungbu/BeeUI/issues/243) — freeze public API inventory.
- **R11.2** [#244](https://github.com/beobungbu/BeeUI/issues/244) — freeze token lifecycle/semantic vocabulary after new component needs are known.
- **R11.3** [#245](https://github.com/beobungbu/BeeUI/issues/245) — final semver/breaking-change audit.
- **R11.4** [#246](https://github.com/beobungbu/BeeUI/issues/246) — build immutable `1.0.0-rc-ready.1` package/CLI/docs/demo evidence candidate without publication.
- **R11.5** [#247](https://github.com/beobungbu/BeeUI/issues/247) — exact-candidate automated CI/consumer/compatibility/performance matrix.
- **R11.6** [#248](https://github.com/beobungbu/BeeUI/issues/248) — exact-candidate iOS/Android runtime matrix.
- **R11.7** [#249](https://github.com/beobungbu/BeeUI/issues/249) — exact-candidate VoiceOver/TalkBack acceptance.
- **R11.8** [#250](https://github.com/beobungbu/BeeUI/issues/250) — exact-candidate Web accessibility/keyboard acceptance.
- **R11.9** [#251](https://github.com/beobungbu/BeeUI/issues/251) — final security/release-readiness audit and protected-owner publication dry run.
- **R11.10** [#252](https://github.com/beobungbu/BeeUI/issues/252) — final changelog + migration guide.
- **R11.11** [#253](https://github.com/beobungbu/BeeUI/issues/253) — bounded RC soak/external feedback; any P0/P1 fix creates a new candidate and requires rerunning evidence.
- **R11.12** [#254](https://github.com/beobungbu/BeeUI/issues/254) — **OWNER-AUTHORIZED `1.0.0` PUBLICATION ONLY.** No explicit owner command = do not execute. After authorization only: tag, npm packages, public CLI, dist-tags, GitHub Release and release messaging.
- **R11.13** [#255](https://github.com/beobungbu/BeeUI/issues/255) — verify the actual published npm/CLI/docs/release artifacts after authorized publication.
- **R11.14** [#256](https://github.com/beobungbu/BeeUI/issues/256) — rollback/hotfix/deprecation incident runbook.

---

## Definition of Done for every implementation issue

Unless an issue explicitly narrows the requirement, every implementation PR must state:

1. public contract added/changed;
2. why the behavior belongs in BeeUI rather than application/pattern-local code;
3. reused architecture and any new dependency/runtime authority;
4. Web vs iOS vs Android differences;
5. accessibility, RTL, large-text and reduced-motion behavior;
6. compatibility rows affected;
7. deterministic tests;
8. real browser/native runtime evidence required;
9. registry/package/docs/AI metadata changes;
10. migration/semver impact;
11. explicit out-of-scope items;
12. exact PR head SHA and applicable CI evidence.

A compile-only result is not runtime proof. A browser-only result is not native proof. Simulator/device evidence must identify the tested SHA/build/environment.

## BeeUI 1.0 final acceptance checklist

### Runtime / components
- [ ] #59 is resolved under the bounded-completion contract.
- [ ] #62 has one explicit support/quarantine policy with no false-green wording.
- [ ] Tooltip is stable and verified.
- [ ] Sheet is stable and verified on native plus its Web policy.
- [ ] Table/DataTable is stable, accessible, responsive and performance-bounded.
- [ ] Calendar, DatePicker and DateTimePicker are stable with explicit date/timezone/i18n semantics.

### Accessibility / compatibility
- [ ] RTL is systemic across components, overlays, Table, date controls and demo.
- [ ] Dynamic Type/large text passes the documented stress level.
- [ ] Web keyboard + automated accessibility gates are green.
- [ ] VoiceOver and TalkBack release matrices are recorded on the exact candidate.
- [ ] compatibility docs, package peers and CI matrix agree.

### Distribution
- [ ] package tarballs and CLI tarball are deterministic and clean-consumer tested.
- [ ] registry covers the full stable 1.0 public component surface.
- [ ] trusted-publishing/provenance/release environment is configured.
- [ ] **no npm package/CLI has been published before explicit owner authorization.**

### AI-native / public DX
- [ ] release-ready public docs and Showcase are complete.
- [ ] `llms.txt`, `llms-full.txt`, `llms-components.txt`, `llms-patterns.txt` are canonical and freshness-checked.
- [ ] agent-development cookbook exists.
- [ ] agent regression suite meets accepted success thresholds.

### Product proof
- [ ] production demo is a real multi-screen application, not a component catalog.
- [ ] demo passes iOS/Android/Web, RTL, large text, dark/high-contrast and runtime quality review.
- [ ] fresh coding agent can build/extend/fix representative BeeUI application flows from canonical context.
- [ ] at least one independent real-world consumer has been evaluated.

### Release integrity
- [ ] public API and token lifecycle are frozen.
- [ ] changelog/migration guide matches the candidate.
- [ ] one immutable `1.0.0-rc-ready` artifact set passes all exact-candidate gates.
- [ ] no accepted P0/P1 1.0 blocker remains.
- [ ] **repository owner explicitly authorizes release before R11.12.**

## Roadmap maintenance rule

When a child issue ships, update this roadmap and #114 in the same integration change or a linked synchronization PR. Completed work must never remain described as future work, and release-ready-but-unpublished behavior must never be documented as publicly available.

The body of each linked issue is the detailed execution specification for Claude/Codex/other implementers; this file is the canonical dependency/order/status control plane.