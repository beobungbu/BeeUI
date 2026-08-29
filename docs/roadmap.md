# BeeUI 1.0 Roadmap

> **Canonical target:** BeeUI `1.0.0`  
> **Program tracker:** [#114](https://github.com/beobungbu/BeeUI/issues/114)  
> **Snapshot:** 2026-08-29  
> **Authoritative base at program creation:** `fe8733345ee09720808ec0f6a4db93be9ff4a78f`  
> **Execution model:** one atomic implementation issue = one branch/PR; mandatory self-test + self-review; independent review; no self-merge.

This document is the BeeUI 1.0 product-scope and issue-map authority. It supersedes the old pre-1.0 wave ordering.

## Execution authority

BeeUI 1.0 execution uses these canonical documents together:

1. [#114](https://github.com/beobungbu/BeeUI/issues/114) — program status, hard gates and owner-locked release state.
2. `docs/roadmap.md` — product scope and issue map.
3. `docs/beeui-1.0-sequence.md` — **authoritative dependency/eligibility/parallelization order**.
4. `docs/agent-execution-contract.md` — mandatory worker startup, self-test, self-review and PR handoff protocol.
5. `docs/beeui-1.0-integration-discipline.md` — shared-authority serialization rules.
6. `docs/beeui-1.0-owner-gates.md` — legal/account/visibility/release actions that agents may not cross autonomously.
7. `docs/beeui-1.0-status-model.md` — canonical task states.
8. `docs/beeui-1.0-evidence-classes.md` — deterministic/browser/visual/compile/native/a11y/consumer/performance evidence language.
9. Assigned GitHub issue body — task-specific scope, decisions and DoD.

Ready-to-send Claude dispatcher prompt: `docs/claude-dispatch-prompt.md`.

Issue numbering is **not** execution order. Use `docs/beeui-1.0-sequence.md`.

## Non-negotiable publication rule

**Preparation is not publication.**

BeeUI packages and the BeeUI CLI must become completely publication-ready—packable, installable, provenance-ready and tested from clean consumers—but must remain unpublished until the repository owner explicitly commands the BeeUI 1.0 release.

The only task allowed to perform stable publication is **#254 / R11.12**, and #254 must abort without explicit owner release authorization even when every technical gate is green.

No earlier task may:

- publish `@beeui/core`, `@beeui/tokens`, `@beeui/ui`;
- publish the stable BeeUI CLI;
- mutate stable npm dist-tags;
- create the final `v1.0.0` release tag/GitHub Release;
- present release-ready artifacts as already publicly published.

## BeeUI 1.0 hard product gates

Before BeeUI can be called **1.0-ready**, one exact immutable candidate must prove all of the following:

- overlay/runtime correctness, including bounded native measurement completion;
- explicit `pageSheet`/`formSheet` support/quarantine policy;
- tested React/RN/Expo/Node/Uniwind/Tailwind/Web compatibility;
- RTL/logical direction;
- Dynamic Type/large text;
- localization/long-content handling;
- real keyboard/focus behavior;
- VoiceOver/TalkBack release acceptance;
- reduced motion/high contrast;
- Tooltip;
- Sheet / BottomSheet;
- **Table / DataTable**;
- **Calendar / DatePicker / DateTimePicker**;
- performance and package-footprint baselines/budgets;
- OSS/security/repository governance;
- publication-ready packages, still unpublished;
- publication-ready CLI/source ownership, still unpublished;
- release-ready public docs + Showcase + native preview;
- **AI-native developer support:** canonical `llms.txt` family + agent-development contract + fresh-agent regression suite;
- clean independent Expo/bare RN/Web/source-owned consumers;
- at least one real-world external-consumer evaluation;
- **one production-grade demo/reference application on iOS, Android and Web**;
- API/token freeze, semver/migration audit and immutable RC-ready evidence;
- tested rollback/hotfix/deprecation runbook before publication.

## Current baseline to preserve

Already shipped on `main` at program creation and therefore not future work:

- React Native + TypeScript monorepo split into `@beeui/core`, `@beeui/tokens`, `@beeui/ui`;
- Theme Tokens v3 canonical DTCG source/codegen, lifecycle, semantic-consumption guard, scoped themes, runtime overrides/readers, density, high contrast, dataviz and motion contracts;
- broad stable component surface including production Select;
- context-preserving anchored-overlay architecture used by Popover/DropdownMenu/Select;
- Dialog/AlertDialog, Toast, KeyboardAwareScreen and safe-area contracts;
- 37-screen Pattern Gallery plus Chromium visual/integration QA;
- Expo + bare React Native package/bundle/native-compile verification;
- native runtime-smoke foundation;
- source-ownership registry/CLI covering the current stable public component surface.

The remaining problem is not basic component count. It is runtime hardening, missing high-value 1.0 surfaces, systemic accessibility/compatibility proof, distribution readiness, public/agent DX and product-level evidence.

---

# Authoritative high-level sequence

Detailed eligibility rules live in `docs/beeui-1.0-sequence.md`.

```text
S0  control plane / stale-state cleanup / protection
 ↓
S1  runtime + compatibility core + accessibility foundations
 ↓
S2  Tooltip | Sheet | Table | Calendar/date lanes in parallel
 ↓
S3  final Web compatibility + cross-component RTL/a11y/localization
 ↓
S4  performance + OSS/security + package/distribution foundations
 ↓
S5  publication-ready packages + CLI (still unpublished)
 ↓
S6  docs + Showcase + llms.txt + agent contract/evals
 ↓
S7  independent consumers + production demo
 ↓
S8  API/token freeze + rollback runbook + immutable RC-ready evidence
 ↓
STOP — BeeUI 1.0-ready, not released
 ↓ only after explicit owner command
S9  #254 publish exact candidate → #255 verify public artifacts
```

### Important cycle breakers

The following sequencing rules are intentional:

- R3 has **foundation tasks before R4** and **cross-component acceptance tasks after R4**. Final R3 does not block initial hard-component implementation.
- Final Web support #136 runs after hard 1.0 Web components exist; Sheet/Table/Calendar Web implementation does not depend on #136.
- Performance harness #179 may start early, but component/package measurements run after the measured surfaces exist.
- Package footprint #183 → granular export decision #184 → final export maps #201. There is no circular R5/R7 dependency.
- #256 rollback/hotfix/deprecation runbook executes **before #246/#251/#254**, regardless of its R11.14 identifier.
- #237 is an integration epic; production-demo implementation is decomposed into #258–#263.

---

# R0 — Program synchronization & governance

- **R0.1** [#115](https://github.com/beobungbu/BeeUI/issues/115) — close stale Theme v3 issues #65/#66 with traceable evidence.
- **R0.2** [#116](https://github.com/beobungbu/BeeUI/issues/116) — supersede obsolete draft PR #86.
- **R0.3** [#117](https://github.com/beobungbu/BeeUI/issues/117) — synchronize current-state README/roadmap/architecture/release/native/components/changelog docs.
- **R0.4** [#114](https://github.com/beobungbu/BeeUI/issues/114) — single BeeUI 1.0 program tracker.
- **R0.5** [#118](https://github.com/beobungbu/BeeUI/issues/118) — 1.0 priority/area labels + milestone taxonomy.
- **R0.6** [#119](https://github.com/beobungbu/BeeUI/issues/119) — protect `main` and release path using real check names/classifier behavior.

R0 execution details: S0 in `docs/beeui-1.0-sequence.md`.

# R1 — Runtime hardening

No anchored overlay may remain invisibly open because a native async measurement callback never arrives.

- **R1.1** [#120](https://github.com/beobungbu/BeeUI/issues/120) — ADR for unresponsive native measurement callbacks.
- **R1.2** [#121](https://github.com/beobungbu/BeeUI/issues/121) — bounded measurement completion state machine.
- **R1.3** [#122](https://github.com/beobungbu/BeeUI/issues/122) — deterministic host measurement fallback.
- **R1.4** [#123](https://github.com/beobungbu/BeeUI/issues/123) — anchor-unavailable completion/cleanup.
- **R1.5** [#124](https://github.com/beobungbu/BeeUI/issues/124) — development diagnostics.
- **R1.6** [#125](https://github.com/beobungbu/BeeUI/issues/125) — load-bearing race/fallback/ABA/unmount matrix.
- **R1.7** [#126](https://github.com/beobungbu/BeeUI/issues/126) — real native runtime stress.
- **R1.8** [#127](https://github.com/beobungbu/BeeUI/issues/127) — independent final review/closure of #59.
- **R1.9** [#128](https://github.com/beobungbu/BeeUI/issues/128) — `pageSheet`/`formSheet` support/quarantine policy for #62.

# R2 — Compatibility contract

BeeUI promises only combinations it can reproduce/test.

## Compatibility core — before hard-component final acceptance

- **R2.1** [#129](https://github.com/beobungbu/BeeUI/issues/129) — candidate support matrix.
- **R2.2** [#130](https://github.com/beobungbu/BeeUI/issues/130) — RN 0.86 row.
- **R2.3** [#131](https://github.com/beobungbu/BeeUI/issues/131) — RN 0.87 row.
- **R2.4** [#132](https://github.com/beobungbu/BeeUI/issues/132) — evidence-based RN 0.85 decision.
- **R2.5** [#133](https://github.com/beobungbu/BeeUI/issues/133) — cap React/ReactDOM major peers.
- **R2.6** [#134](https://github.com/beobungbu/BeeUI/issues/134) — Node/package-tool compatibility.
- **R2.7** [#135](https://github.com/beobungbu/BeeUI/issues/135) — Uniwind/Tailwind tested range.

## Compatibility final — after hard components exist

- **R2.8** [#136](https://github.com/beobungbu/BeeUI/issues/136) — final reproducible Web support contract including Tooltip/Sheet/Table/date controls.
- **R2.9** [#137](https://github.com/beobungbu/BeeUI/issues/137) — compatibility CI scheduling.
- **R2.10** [#138](https://github.com/beobungbu/BeeUI/issues/138) — mechanically synchronized compatibility documentation.

# R3 — Accessibility, RTL, Dynamic Type & localization

Accessibility is split into **foundations** and **post-component acceptance** to avoid dependency cycles.

## Foundation — eligible before R4

- **R3.1** [#139](https://github.com/beobungbu/BeeUI/issues/139) — direction architecture ADR.
- **R3.2** [#140](https://github.com/beobungbu/BeeUI/issues/140) — existing reusable-source logical-direction audit.
- **R3.5** [#143](https://github.com/beobungbu/BeeUI/issues/143) — Dynamic Type/large-text policy + reusable stress fixtures.
- **R3.7** [#145](https://github.com/beobungbu/BeeUI/issues/145) — reusable automated Web a11y harness.

## Cross-component acceptance — after R4 surfaces exist

- **R3.3** [#141](https://github.com/beobungbu/BeeUI/issues/141) — RTL overlay acceptance including Tooltip.
- **R3.4** [#142](https://github.com/beobungbu/BeeUI/issues/142) — RTL component stress including Sheet/Table/date controls.
- **R3.6** [#144](https://github.com/beobungbu/BeeUI/issues/144) — localization/long-content stress.
- **R3.8** [#146](https://github.com/beobungbu/BeeUI/issues/146) — final keyboard/focus matrix.
- **R3.9** [#147](https://github.com/beobungbu/BeeUI/issues/147) — VoiceOver release matrix.
- **R3.10** [#148](https://github.com/beobungbu/BeeUI/issues/148) — TalkBack release matrix.
- **R3.11** [#149](https://github.com/beobungbu/BeeUI/issues/149) — reduced-motion acceptance.
- **R3.12** [#150](https://github.com/beobungbu/BeeUI/issues/150) — final accessibility docs contract.

# R4A — Tooltip — hard 1.0 gate

Tooltip is non-interactive contextual disclosure and reuses the shared anchored-overlay runtime.

- **R4A.1** [#151](https://github.com/beobungbu/BeeUI/issues/151) — public product contract.
- **R4A.2** [#152](https://github.com/beobungbu/BeeUI/issues/152) — Web hover/focus/delay/Escape behavior.
- **R4A.3** [#153](https://github.com/beobungbu/BeeUI/issues/153) — platform-honest native policy.
- **R4A.4** [#154](https://github.com/beobungbu/BeeUI/issues/154) — deterministic/browser/native integration test matrix.
- **R4A.5** [#155](https://github.com/beobungbu/BeeUI/issues/155) — export/registry/docs/Showcase/AI metadata integration.

# R4B — Sheet / BottomSheet — hard 1.0 gate

BeeUI owns Sheet semantics/API/tests; gesture physics may use a justified proven optional engine.

- **R4B.1** [#156](https://github.com/beobungbu/BeeUI/issues/156) — gesture/dependency architecture ADR.
- **R4B.2** [#157](https://github.com/beobungbu/BeeUI/issues/157) — stable Sheet API.
- **R4B.3** [#158](https://github.com/beobungbu/BeeUI/issues/158) — native Sheet implementation/runtime-local tests.
- **R4B.4** [#159](https://github.com/beobungbu/BeeUI/issues/159) — coherent Web bottom/drawer policy.
- **R4B.5** [#160](https://github.com/beobungbu/BeeUI/issues/160) — dedicated native runtime acceptance.
- **R4B.6** [#161](https://github.com/beobungbu/BeeUI/issues/161) — source-ownership/package dependency closure.

# R4C / R4D — explicit optional decisions

- **R4C** [#162](https://github.com/beobungbu/BeeUI/issues/162) — adaptive Select presentation after Sheet; may explicitly defer for 1.0.
- **R4D** [#163](https://github.com/beobungbu/BeeUI/issues/163) — Slider decision; no partial public Slider accepted.

# R4E — Table / DataTable — hard 1.0 gate

BeeUI owns semantic layout/composition/accessibility/density/responsive presentation; application/backend query ownership remains outside BeeUI.

- **R4E.1** [#164](https://github.com/beobungbu/BeeUI/issues/164) — architecture ADR.
- **R4E.2** [#165](https://github.com/beobungbu/BeeUI/issues/165) — core anatomy/API.
- **R4E.3** [#166](https://github.com/beobungbu/BeeUI/issues/166) — Web semantics/keyboard/a11y.
- **R4E.4** [#167](https://github.com/beobungbu/BeeUI/issues/167) — native rendering/a11y.
- **R4E.5** [#168](https://github.com/beobungbu/BeeUI/issues/168) — 100/500-row performance envelope.
- **R4E.6** [#169](https://github.com/beobungbu/BeeUI/issues/169) — production patterns/visual/runtime acceptance.
- **R4E.7** [#170](https://github.com/beobungbu/BeeUI/issues/170) — registry/docs/AI metadata + clean consumers.

# R4F — Calendar / DatePicker / DateTimePicker — hard 1.0 gate

Date-only values must not silently shift day because of timezone conversion. BeeUI does not own backend timezone storage/business-calendar rules.

- **R4F.1** [#171](https://github.com/beobungbu/BeeUI/issues/171) — date/time architecture ADR.
- **R4F.2** [#172](https://github.com/beobungbu/BeeUI/issues/172) — Calendar stable API.
- **R4F.3** [#173](https://github.com/beobungbu/BeeUI/issues/173) — DatePicker stable API.
- **R4F.4** [#174](https://github.com/beobungbu/BeeUI/issues/174) — DateTimePicker stable API.
- **R4F.5** [#175](https://github.com/beobungbu/BeeUI/issues/175) — locale/week-start/DST/date-only regression matrix.
- **R4F.6** [#176](https://github.com/beobungbu/BeeUI/issues/176) — component-local a11y/keyboard/assistive-tech acceptance.
- **R4F.7** [#177](https://github.com/beobungbu/BeeUI/issues/177) — visual + iOS/Android/Web runtime acceptance.
- **R4F.8** [#178](https://github.com/beobungbu/BeeUI/issues/178) — registry/docs/AI metadata + clean consumers.

## R4 shared-authority integration rule

#155, #161, #170 and #178 may be developed from independent feature lanes, but final integration touching shared exports/registry/docs/AI metadata must be serialized according to `docs/beeui-1.0-integration-discipline.md`.

# R5 — Performance & footprint

- **R5.1** [#179](https://github.com/beobungbu/BeeUI/issues/179) — reproducible benchmark harness; may start early.
- **R5.2** [#180](https://github.com/beobungbu/BeeUI/issues/180) — render/update stress after Table/date exist.
- **R5.3** [#181](https://github.com/beobungbu/BeeUI/issues/181) — overlay/Tooltip/Sheet open latency after runtime/components stabilize.
- **R5.4** [#182](https://github.com/beobungbu/BeeUI/issues/182) — Theme Tokens v3 runtime performance.
- **R5.5** [#183](https://github.com/beobungbu/BeeUI/issues/183) — packed package/Web/Metro footprint after package output shape is known.
- **R5.6** [#184](https://github.com/beobungbu/BeeUI/issues/184) — measured granular-export decision.
- **R5.7** [#185](https://github.com/beobungbu/BeeUI/issues/185) — evidence-based regression budgets.
- **R5.8** [#186](https://github.com/beobungbu/BeeUI/issues/186) — reproducible methodology/baseline report.

Critical packaging/performance sequence:

`#197 → #198 → (#199 + #200) → #183 → #184 → #201 → #202 → #203 → #204 → #185 → #186`

# R6 — OSS, security & repository governance

- **R6.1** [#187](https://github.com/beobungbu/BeeUI/issues/187) — secret/history/asset audit.
- **R6.2** [#188](https://github.com/beobungbu/BeeUI/issues/188) — OSS license decision packet + owner-approved final choice when required.
- **R6.3** [#189](https://github.com/beobungbu/BeeUI/issues/189) — SECURITY.md/vulnerability process.
- **R6.4** [#190](https://github.com/beobungbu/BeeUI/issues/190) — CONTRIBUTING.md.
- **R6.5** [#191](https://github.com/beobungbu/BeeUI/issues/191) — Code of Conduct.
- **R6.6** [#192](https://github.com/beobungbu/BeeUI/issues/192) — issue/PR templates.
- **R6.7** [#193](https://github.com/beobungbu/BeeUI/issues/193) — GitHub Actions/fork/self-hosted runner security.
- **R6.8** [#194](https://github.com/beobungbu/BeeUI/issues/194) — dependency/security update automation.
- **R6.9** [#195](https://github.com/beobungbu/BeeUI/issues/195) — repository-public preflight; final visibility change is owner-gated.
- **R6.10** [#196](https://github.com/beobungbu/BeeUI/issues/196) — final branch/tag/release ruleset.

# R7 — Packages — publication-ready only, DO NOT publish

- **R7.1** [#197](https://github.com/beobungbu/BeeUI/issues/197) — distribution architecture ADR.
- **R7.2** [#198](https://github.com/beobungbu/BeeUI/issues/198) — package/CLI names + permissions; owner/admin gate where needed.
- **R7.3** [#199](https://github.com/beobungbu/BeeUI/issues/199) — public package metadata.
- **R7.4** [#200](https://github.com/beobungbu/BeeUI/issues/200) — final package output format.
- **R7.5** [#201](https://github.com/beobungbu/BeeUI/issues/201) — final export maps after #184 decision.
- **R7.6** [#202](https://github.com/beobungbu/BeeUI/issues/202) — packed file inventory audit.
- **R7.7** [#203](https://github.com/beobungbu/BeeUI/issues/203) — prerelease-equivalent retained artifacts without registry mutation.
- **R7.8** [#204](https://github.com/beobungbu/BeeUI/issues/204) — clean consumers from packed artifacts.
- **R7.9** [#205](https://github.com/beobungbu/BeeUI/issues/205) — trusted publishing/provenance preparation; owner/admin account actions gated.
- **R7.10** [#206](https://github.com/beobungbu/BeeUI/issues/206) — dist-tag/prerelease policy only; no mutation.
- **R7.11** [#207](https://github.com/beobungbu/BeeUI/issues/207) — integrity/provenance verification path.
- **R7.12** [#208](https://github.com/beobungbu/BeeUI/issues/208) — package consumer compatibility report.

# R8 — CLI/source ownership — publication-ready only, DO NOT publish

- **R8.1** [#209](https://github.com/beobungbu/BeeUI/issues/209) — publication-ready packed CLI package.
- **R8.2** [#210](https://github.com/beobungbu/BeeUI/issues/210) — `init/list/add/add --all/dry-run/overwrite/doctor/help/version` contract.
- **R8.3** [#211](https://github.com/beobungbu/BeeUI/issues/211) — security invariants.
- **R8.4** [#212](https://github.com/beobungbu/BeeUI/issues/212) — semver-aware dependency diagnostics.
- **R8.5** [#213](https://github.com/beobungbu/BeeUI/issues/213) — project/platform detection.
- **R8.6** [#214](https://github.com/beobungbu/BeeUI/issues/214) — deterministic `init` config policy.
- **R8.7** [#215](https://github.com/beobungbu/BeeUI/issues/215) — package-manager mutation policy.
- **R8.8** [#216](https://github.com/beobungbu/BeeUI/issues/216) — registry delivery/integrity strategy.
- **R8.9** [#217](https://github.com/beobungbu/BeeUI/issues/217) — complete stable 1.0 registry closure.
- **R8.10** [#218](https://github.com/beobungbu/BeeUI/issues/218) — packed CLI clean-consumer E2E matrix.
- **R8.11** [#219](https://github.com/beobungbu/BeeUI/issues/219) — optional source-owned update/diff assistance; may defer.

# R9 — Public docs, Showcase & AI-native development — hard 1.0 gate

- **R9.1** [#220](https://github.com/beobungbu/BeeUI/issues/220) — release-ready public documentation site.
- **R9.2** [#221](https://github.com/beobungbu/BeeUI/issues/221) — complete per-component documentation contract after stable registry/API.
- **R9.3** [#222](https://github.com/beobungbu/BeeUI/issues/222) — executable/typechecked docs examples including packed CLI/source ownership.
- **R9.4** [#223](https://github.com/beobungbu/BeeUI/issues/223) — production pattern library documentation.
- **R9.5** [#224](https://github.com/beobungbu/BeeUI/issues/224) — publish-ready Web Showcase.
- **R9.6** [#225](https://github.com/beobungbu/BeeUI/issues/225) — native preview path.
- **R9.7** [#226](https://github.com/beobungbu/BeeUI/issues/226) — canonical `llms.txt`, `llms-full.txt`, `llms-components.txt`, `llms-patterns.txt`.
- **R9.8** [#227](https://github.com/beobungbu/BeeUI/issues/227) — AI-agent development contract + prompt cookbook.
- **R9.9** [#228](https://github.com/beobungbu/BeeUI/issues/228) — repeatable fresh-agent regression suite.
- **R9.10** [#229](https://github.com/beobungbu/BeeUI/issues/229) — optional MCP decision; not a hard 1.0 gate if static canonical corpus + agent regression proof pass.

Hard AI-native chain:

`#226 → #227 → #228`

# R10 — Independent consumers & production demo — hard 1.0 gate

## Independent consumers

- **R10.1** [#230](https://github.com/beobungbu/BeeUI/issues/230) — Expo package-consumption starter from retained packed artifacts.
- **R10.2** [#231](https://github.com/beobungbu/BeeUI/issues/231) — source-ownership starter using packed unpublished CLI.
- **R10.3** [#232](https://github.com/beobungbu/BeeUI/issues/232) — true bare RN starter/consumer.
- **R10.4** [#233](https://github.com/beobungbu/BeeUI/issues/233) — independent Web reference consumer.
- **R10.5** [#234](https://github.com/beobungbu/BeeUI/issues/234) — independent real-world external consumer; owner selection/access when private.
- **R10.6** [#235](https://github.com/beobungbu/BeeUI/issues/235) — fresh-agent reference app from canonical context only.

## Production demo architecture and implementation

- **R10.7** [#236](https://github.com/beobungbu/BeeUI/issues/236) — production demo architecture/spec and child-boundary plan.
- **R10.8** [#237](https://github.com/beobungbu/BeeUI/issues/237) — production-demo functional **integration epic**.
  - **R10.8a** [#258](https://github.com/beobungbu/BeeUI/issues/258) — shell + responsive/mobile-first navigation.
  - **R10.8b** [#259](https://github.com/beobungbu/BeeUI/issues/259) — dashboard/data overview + state variants.
  - **R10.8c** [#260](https://github.com/beobungbu/BeeUI/issues/260) — searchable/filterable Table/DataTable flow.
  - **R10.8d** [#261](https://github.com/beobungbu/BeeUI/issues/261) — detail/edit-form flow.
  - **R10.8e** [#262](https://github.com/beobungbu/BeeUI/issues/262) — scheduling/date-time flow.
  - **R10.8f** [#263](https://github.com/beobungbu/BeeUI/issues/263) — settings/accessibility preferences + integrated states/E2E.
- **R10.9** [#238](https://github.com/beobungbu/BeeUI/issues/238) — final iOS/Android/Web platform quality matrix.
- **R10.10** [#239](https://github.com/beobungbu/BeeUI/issues/239) — production engineering quality gate.
- **R10.11** [#240](https://github.com/beobungbu/BeeUI/issues/240) — real rendered visual/product polish review.
- **R10.12** [#241](https://github.com/beobungbu/BeeUI/issues/241) — fresh-agent extend/fix test on accepted production demo.
- **R10.13** [#242](https://github.com/beobungbu/BeeUI/issues/242) — classify all consumer/demo/agent feedback before freeze.

The production demo must be a coherent multi-screen app, not a component catalog, and must prove mobile-first responsive behavior on real supported dimensions/platforms.

# R11 — Freeze, immutable candidate & owner-gated release

## Freeze/readiness

- **R11.1** [#243](https://github.com/beobungbu/BeeUI/issues/243) — freeze public API only after consumer/demo/cross-cutting evidence.
- **R11.2** [#244](https://github.com/beobungbu/BeeUI/issues/244) — freeze token lifecycle/vocabulary after real new-component needs.
- **R11.3** [#245](https://github.com/beobungbu/BeeUI/issues/245) — final semver/breaking-change audit.
- **R11.14 / pre-candidate execution** [#256](https://github.com/beobungbu/BeeUI/issues/256) — rollback/hotfix/deprecation runbook + dry-run **before candidate/final release audit**.
- **R11.4** [#246](https://github.com/beobungbu/BeeUI/issues/246) — immutable `1.0.0-rc-ready.N` evidence candidate, no publication.
- **R11.5** [#247](https://github.com/beobungbu/BeeUI/issues/247) — exact-candidate automated CI/consumer/compat/performance matrix.
- **R11.6** [#248](https://github.com/beobungbu/BeeUI/issues/248) — exact-candidate native runtime matrix.
- **R11.7** [#249](https://github.com/beobungbu/BeeUI/issues/249) — exact-candidate VoiceOver/TalkBack acceptance.
- **R11.8** [#250](https://github.com/beobungbu/BeeUI/issues/250) — exact-candidate Web accessibility/keyboard acceptance.
- **R11.9** [#251](https://github.com/beobungbu/BeeUI/issues/251) — exact-candidate security/release-readiness audit including #256 runbook.
- **R11.10** [#252](https://github.com/beobungbu/BeeUI/issues/252) — final changelog/migration guide.
- **R11.11** [#253](https://github.com/beobungbu/BeeUI/issues/253) — bounded RC soak/external feedback; still no publication.

After #253, **STOP**. If all gates are green, BeeUI is **1.0-ready**, not released.

## Owner-authorized publication only

- **R11.12** [#254](https://github.com/beobungbu/BeeUI/issues/254) — owner-authorized exact-candidate `1.0.0` publication only.
- **R11.13** [#255](https://github.com/beobungbu/BeeUI/issues/255) — verify the actual public npm/CLI/docs/tag/release artifacts after authorized publication.

If #255 discovers an incident, execute the already-prepared #256 runbook. Do not silently patch, mutate immutable npm versions or rewrite release history.

---

# Mandatory implementation-agent protocol

Every child issue inherits `docs/agent-execution-contract.md` even when the issue body does not repeat it.

A task is not `READY_FOR_INDEPENDENT_REVIEW` until the implementation agent has:

1. derived the accepted exact base;
2. verified dependencies on that base;
3. implemented only the assigned scope;
4. run all applicable exact-head self-tests;
5. performed mandatory self-review;
6. fixed self-review findings and rerun affected tests;
7. opened/updated an unmerged PR with exact base/head SHA and evidence-class-accurate results.

Self-review does not replace independent review.

## Minimum self-review categories

- scope/DoD completeness;
- API/semver/default/controlled-state behavior;
- Web/iOS/Android differences;
- accessibility/keyboard/focus;
- RTL/large text/high contrast/reduced motion;
- async races/cleanup/unmount/Back/runtime failure states when applicable;
- duplicate provider/runtime/state authority;
- package/registry/private-import/workspace leakage;
- docs/AI metadata/current generated artifacts;
- file mode, EOF newline, whitespace, debug/temp/binary hygiene;
- exact evidence class and skipped-gate honesty.

# Owner/admin gates

Agents may prepare but not autonomously cross owner/business/legal/account/release boundaries. See `docs/beeui-1.0-owner-gates.md`.

Explicit gated areas include:

- #188 final license decision when policy choice remains;
- #195 repository visibility change;
- #198 npm scope/account permission actions;
- #205 trusted-publisher/release-environment account actions;
- #234 private external-consumer selection/access;
- #253 private reviewer/artifact sharing when owner approval is required;
- #254 BeeUI 1.0 publication.

# Definition of Done for implementation issues

Unless a task is explicitly docs/decision/acceptance-only, its PR must report:

1. public contract added/changed;
2. why behavior belongs in BeeUI vs application/pattern code;
3. architecture/dependency authority reused/changed;
4. Web/iOS/Android behavior;
5. accessibility/RTL/large-text/high-contrast/reduced-motion impact;
6. compatibility rows affected;
7. deterministic load-bearing tests;
8. real browser/native/runtime evidence required and obtained;
9. registry/package/docs/AI metadata changes;
10. migration/semver impact;
11. explicit out-of-scope items;
12. exact base/head SHA + applicable CI/evidence;
13. mandatory self-review findings/fixes;
14. `NOT MERGED — ready for independent review` when complete.

A compile-only result is not runtime proof. Browser proof is not native proof. A skipped check is not a pass.

# BeeUI 1.0 final acceptance checklist

## Runtime/components

- [ ] #59 bounded-completion remediation accepted.
- [ ] #62 support/quarantine policy explicit and honest.
- [ ] Tooltip stable and distributed.
- [ ] Sheet stable on native plus coherent Web policy.
- [ ] Table/DataTable stable, accessible, responsive and performance-bounded.
- [ ] Calendar/DatePicker/DateTimePicker stable with explicit value/timezone/i18n semantics.

## Accessibility/compatibility

- [ ] RTL is systemic across components/overlays/Table/date/demo.
- [ ] documented Dynamic Type/large-text stress passes.
- [ ] final Web keyboard + automated a11y gates pass.
- [ ] VoiceOver/TalkBack release matrices recorded.
- [ ] compatibility docs/package peers/CLI diagnostics/CI agree.

## Distribution

- [ ] deterministic package tarballs and CLI tarball exist.
- [ ] clean Expo/bare RN/Web/source-owned consumers pass.
- [ ] registry covers complete stable 1.0 surface.
- [ ] provenance/release environment is prepared and protected.
- [ ] **no npm package/CLI stable publication occurred before explicit owner authorization.**

## AI-native/public DX

- [ ] release-ready public docs + Showcase + native preview complete.
- [ ] canonical `llms.txt` family freshness-checked.
- [ ] agent-development cookbook/dispatcher contract complete.
- [ ] fresh-agent regression suite meets accepted threshold.

## Product proof

- [ ] production demo is a real multi-screen application.
- [ ] demo passes iOS/Android/Web, mobile-first responsive, RTL, large text, dark/high-contrast and runtime review.
- [ ] fresh agent can build and extend/fix representative BeeUI flows from canonical context.
- [ ] at least one independent real-world consumer has been evaluated.

## Release integrity

- [ ] public API/token lifecycle frozen after all feedback.
- [ ] rollback/hotfix/deprecation runbook dry-run complete.
- [ ] changelog/migration guide matches exact candidate.
- [ ] one immutable RC-ready artifact set passes all exact-candidate gates.
- [ ] no accepted P0/P1 blocker remains.
- [ ] repository owner separately and explicitly authorizes release before #254 executes.

# Maintenance rule

When a child issue ships, update #114 and affected canonical docs in the same integration change or an explicitly linked synchronization PR.

Completed work must never remain described as future work. Future or release-ready-but-unpublished work must never be documented as already public.

The assigned issue body is the task-level implementation specification; this roadmap remains the canonical product-scope/issue-map control plane.