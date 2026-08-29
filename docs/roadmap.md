# BeeUI 1.0 Roadmap

> **Target:** BeeUI `1.0.0`  
> **Program tracker:** [#114](https://github.com/beobungbu/BeeUI/issues/114)  
> **Snapshot:** 2026-08-29  
> **Program base at creation:** `fe8733345ee09720808ec0f6a4db93be9ff4a78f`  
> **Worker model:** one atomic issue = one branch/PR; mandatory self-test + self-review; independent review; no self-merge.

This file is the BeeUI 1.0 **product-scope and issue-map authority**. It does not duplicate every child issue's implementation details.

## Execution authorities

Use these together:

1. [#114](https://github.com/beobungbu/BeeUI/issues/114) — program status and owner-locked release state.
2. `docs/roadmap.md` — product scope and issue map.
3. `docs/beeui-1.0-sequence.md` — authoritative dependency/eligibility/parallelization order.
4. `docs/agent-execution-contract.md` — mandatory worker startup, exact-base discipline, self-test, self-review and PR handoff.
5. `docs/beeui-1.0-integration-discipline.md` — shared-authority serialization.
6. `docs/beeui-1.0-owner-gates.md` — legal/business/account/visibility/release gates.
7. `docs/beeui-1.0-status-model.md` — canonical task states.
8. `docs/beeui-1.0-evidence-classes.md` — evidence terminology.
9. Assigned child issue body — task-specific dependencies, scope, acceptance and DoD.

Canonical Claude dispatcher prompt: `docs/claude-dispatch-prompt.md`.

**Issue number is not execution order.** Always use `docs/beeui-1.0-sequence.md`.

## Non-negotiable publication rule

**Release-ready is not released.**

Before explicit owner authorization, BeeUI packages and CLI may be packed, tested, provenance-prepared and verified in clean consumers, but must remain unpublished.

Only **#254 / R11.12** may publish stable BeeUI 1.0 artifacts, and #254 must abort unless the repository owner explicitly commands BeeUI 1.0 publication and the exact approved candidate remains current and green.

No earlier task may publish stable npm packages/CLI, mutate stable dist-tags, create the final `v1.0.0` release, or represent unpublished artifacts as public.

## BeeUI 1.0 hard gates

BeeUI is not **1.0-ready** until one exact immutable candidate proves:

- overlay/runtime correctness, including bounded native measurement completion;
- explicit `pageSheet`/`formSheet` support/quarantine policy;
- tested React/RN/Expo/Node/Uniwind/Tailwind/Web compatibility;
- RTL/logical direction, Dynamic Type/large text, localization, keyboard/focus, VoiceOver/TalkBack, high contrast and reduced motion;
- Tooltip;
- Sheet / BottomSheet;
- **Table / DataTable**;
- **Calendar / DatePicker / DateTimePicker**;
- reproducible performance and package-footprint baselines/budgets;
- OSS/security/repository governance;
- publication-ready packages and CLI, still unpublished;
- release-ready public docs, Web Showcase and native preview;
- **AI-native development:** canonical `llms.txt` family + agent-development contract + fresh-agent regression suite;
- clean Expo, bare RN, Web and source-owned consumers;
- at least one real-world external-consumer evaluation;
- **one production-grade demo/reference application on iOS, Android and Web**;
- API/token freeze, semver/migration audit, rollback runbook and exact-candidate release evidence.

## Baseline already shipped at program creation

Do not re-plan these as future work unless a regression is found:

- React Native + TypeScript packages `@beeui/core`, `@beeui/tokens`, `@beeui/ui`;
- Theme Tokens v3 canonical DTCG source/codegen/lifecycle, semantic-consumption guard, scoped themes, runtime overrides/readers, density, high contrast, dataviz and motion contracts;
- broad stable component surface including Select;
- context-preserving anchored-overlay architecture used by Popover/DropdownMenu/Select;
- Dialog/AlertDialog, Toast, KeyboardAwareScreen and safe-area contracts;
- 37-screen Pattern Gallery and Chromium visual/integration QA;
- Expo + bare React Native bundle/native-compile verification;
- native runtime-smoke foundation;
- repository-local source-ownership registry/CLI covering the current stable public surface.

---

# Authoritative high-level sequence

Detailed eligibility is in `docs/beeui-1.0-sequence.md`.

```text
S0  control plane + stale-state cleanup + protection
 ↓
S1  runtime + compatibility core + accessibility foundations
 ↓
S2  Tooltip | Sheet | Table | Calendar/date lanes
 ↓
S3  final Web compatibility + cross-component a11y/RTL/i18n
 ↓
S4  performance + OSS/security + distribution foundation
 ↓
S5  publication-ready packages + CLI — still unpublished
 ↓
S6  docs + Showcase + AI-native contract/evals
 ↓
S7  independent consumers + production demo
 ↓
S8  freeze + rollback runbook + immutable RC-ready evidence
 ↓
STOP — BeeUI is 1.0-ready, not released
 ↓ only after explicit owner release command
S9  #254 publish exact candidate → #255 verify public artifacts
```

Critical sequencing rules:

- R3 is split into pre-R4 **foundations** and post-R4 **acceptance** to avoid dependency cycles.
- Final Web contract #136–#138 follows stable hard-component Web surfaces; R4 Web implementations do not depend on #136.
- #179 benchmark harness may start early, but measurements wait for the surfaces being measured.
- Package/performance chain is `#197 → #198 → (#199 + #200) → #183 → #184 → #201 → #202 → #203 → #204`.
- #256 executes before #246/#251/#254 despite identifier R11.14.
- #237 is an integration epic; functional production-demo work is split into #258–#263.

---

# R0 — Program synchronization & governance

- **R0.1** #115 — close stale Theme v3 issues #65/#66. **Done** — #65/#66 reconciled and closed as completed, no regression, verified by passing contrast tests.
- **R0.2** #116 — supersede obsolete draft PR #86. **Done** — PR #86 closed unmerged, superseded by the canonical control-plane docs.
- **R0.3** #117 — synchronize current-state documentation.
- **R0.4** #114 — single BeeUI 1.0 tracker.
- **R0.5** #118 — 1.0 labels/milestone taxonomy. **Done** — planning taxonomy created: labels `1.0:blocker`/`1.0:p0`/`1.0:p1`/`1.0:stretch` + `area:*` (runtime, a11y, compatibility, distribution, docs, release, components, performance, ai-agent, demo-app) and milestone `BeeUI 1.0`.
- **R0.6** #119 — protect `main` and release paths using actual workflow/check names. **Owner-declined** — the repository owner explicitly closed #119 as not_planned/deferred; `main`/release branch protection is intentionally **not configured at this time** and may be revisited only by a future explicit owner decision.

# R1 — Runtime hardening

- **R1.1** #120 — ADR for unresponsive native measurement callbacks.
- **R1.2** #121 — bounded measurement completion.
- **R1.3** #122 — deterministic host fallback.
- **R1.4** #123 — anchor-unavailable completion/cleanup.
- **R1.5** #124 — development diagnostics.
- **R1.6** #125 — load-bearing race/fallback/ABA/unmount regression matrix.
- **R1.7** #126 — real iOS/Android runtime stress.
- **R1.8** #127 — independent final review and closure of #59.
- **R1.9** #128 — explicit #62 `pageSheet`/`formSheet` support/quarantine policy.

# R2 — Compatibility

`docs/compatibility-matrix.md` is the locked candidate support matrix authority
for this section (#129). #130–#135 narrow or prove its rows; #136–#138
finalize the Web contract after hard components exist.

## Core before hard-component final acceptance

- #129 support matrix. See `docs/compatibility-matrix.md`.
- #130 RN 0.86 row.
- #131 RN 0.87 row.
- #132 RN 0.85 decision.
- #133 React/ReactDOM major caps.
- #134 Node/tooling compatibility.
- #135 Uniwind/Tailwind tested range.

## Final after hard components exist

- #136 final reproducible Web support contract.
- #137 compatibility CI scheduling.
- #138 mechanically synchronized compatibility documentation.

# R3 — Accessibility, RTL, large text & localization

## Foundation before R4

- #139 direction architecture ADR.
- #140 logical-direction audit of existing reusable source.
- #143 Dynamic Type/large-text policy + reusable fixtures.
- #145 reusable automated Web a11y harness.

## Cross-component acceptance after R4

- #141 RTL overlay acceptance.
- #142 RTL component matrix.
- #144 localization/long-content stress.
- #146 keyboard/focus acceptance.
- #147 VoiceOver release matrix.
- #148 TalkBack release matrix.
- #149 reduced-motion acceptance.
- #150 final accessibility documentation contract.

# R4A — Tooltip — hard 1.0

`#151 → (#152 + #153) → #154 → #155`

- #151 product contract.
- #152 Web behavior.
- #153 native policy/behavior.
- #154 deterministic/browser/native regression matrix.
- #155 export/registry/docs/Showcase/AI integration.

# R4B — Sheet / BottomSheet — hard 1.0

`#156 → #157 → (#158 + #159) → #160 → #161`

- #156 gesture/dependency ADR.
- #157 stable API.
- #158 native implementation.
- #159 Web implementation.
- #160 dedicated native runtime acceptance.
- #161 registry/package dependency closure.

# R4C / R4D — explicit optional decisions

- #162 adaptive Select presentation after Sheet; may explicitly defer for 1.0.
- #163 Slider decision; no partial public Slider accepted.

# R4E — Table / DataTable — hard 1.0

`#164 → #165 → (#166 + #167 + #168) → #169 → #170`

- #164 architecture ADR.
- #165 core anatomy/API.
- #166 Web semantics/keyboard/a11y.
- #167 native rendering/a11y.
- #168 100/500-row performance envelope.
- #169 production patterns + visual/runtime acceptance.
- #170 registry/docs/AI metadata + clean consumers.

# R4F — Calendar / DatePicker / DateTimePicker — hard 1.0

`#171 → #172 → #173 → #174 → #175 → #176 → #177 → #178`

- #171 date/time architecture ADR.
- #172 Calendar API.
- #173 DatePicker API.
- #174 DateTimePicker API.
- #175 i18n/week-start/DST/date-only regression matrix.
- #176 component-local accessibility/keyboard/native assistive-tech acceptance.
- #177 visual + iOS/Android/Web runtime acceptance.
- #178 registry/docs/AI metadata + clean consumers.

## R4 integration discipline

#155, #161, #170 and #178 may be developed in independent lanes, but final shared exports/registry/docs/AI metadata integration is serialized according to `docs/beeui-1.0-integration-discipline.md`.

# R5 — Performance & footprint

- #179 reproducible benchmark harness.
- #180 render/update stress after Table/date exist.
- #181 overlay/Tooltip/Sheet latency after runtime/components stabilize.
- #182 Theme Tokens v3 runtime performance.
- #183 packed package/Web/Metro footprint after package output shape exists.
- #184 measured granular-export decision.
- #185 evidence-based regression budgets.
- #186 reproducible methodology/baseline report.

# R6 — OSS, security & repository governance

- #187 secret/history/asset audit.
- #188 license decision packet; final choice owner-gated where required.
- #189 SECURITY.md.
- #190 CONTRIBUTING.md.
- #191 Code of Conduct.
- #192 issue/PR templates.
- #193 Actions/fork/self-hosted-runner hardening.
- #194 dependency/security automation.
- #195 repository-public preflight; actual visibility action is owner-gated. **Visibility mutation owner-declined** — the repository owner has explicitly rejected the visibility change (recorded on #195); BeeUI remains a **private** repository and will not be made public autonomously. #195 stays open only for its optional non-mutating preflight audit; only a future explicit owner instruction could authorize the actual change. #254 publication remains a separate owner gate regardless.
- #196 final branch/tag/release ruleset.

# R7 — Packages — publication-ready only, DO NOT publish

- #197 distribution architecture ADR.
- #198 package/CLI names and permissions; owner/admin gate where required.
- #199 package metadata.
- #200 package output format.
- #201 final export maps after #184.
- #202 packed file inventory.
- #203 prerelease-equivalent retained artifacts.
- #204 clean consumers from packed artifacts.
- #205 trusted publishing/provenance preparation; account/environment changes gated.
- #206 dist-tag/prerelease policy only.
- #207 integrity/provenance verification path.
- #208 package consumer compatibility report.

# R8 — CLI/source ownership — publication-ready only, DO NOT publish

- #209 publication-ready packed CLI.
- #210 required command contract.
- #211 security invariants.
- #212 semver-aware dependency diagnostics.
- #213 project/platform detection.
- #214 deterministic `init` policy.
- #215 package-manager mutation policy.
- #216 registry delivery/integrity strategy.
- #217 complete stable 1.0 registry closure.
- #218 packed CLI clean-consumer E2E.
- #219 optional safe diff/update assistance or explicit defer.

# R9 — Docs, Showcase & AI-native development — hard 1.0

- #220 public docs site.
- #221 final per-component docs contract after stable component/registry surface.
- #222 executable/typechecked canonical examples.
- #223 production pattern docs.
- #224 release-ready Web Showcase.
- #225 native preview.
- #226 canonical `llms.txt`, `llms-full.txt`, `llms-components.txt`, `llms-patterns.txt`.
- #227 agent-development contract + prompt cookbook.
- #228 repeatable fresh-agent regression suite.
- #229 optional MCP decision; may defer.

Hard AI-native chain: `#226 → #227 → #228`.

# R10 — Independent consumers & production demo — hard 1.0

## Independent consumers

- #230 Expo package-consumption starter.
- #231 source-ownership starter.
- #232 bare RN starter.
- #233 independent Web consumer.
- #234 real-world external consumer; owner selection/access when private.
- #235 fresh-agent reference app from canonical context only.

## Production demo

- #236 architecture/spec.
- #237 functional integration epic.
  - #258 shell + mobile-first responsive navigation.
  - #259 dashboard/data overview.
  - #260 searchable/filterable Table/DataTable flow.
  - #261 detail/edit-form flow.
  - #262 scheduling/date-time flow.
  - #263 settings/accessibility preferences + integrated states/E2E.
- #238 final iOS/Android/Web platform/runtime quality matrix.
- #239 production engineering quality gate.
- #240 real rendered visual/product polish review.
- #241 fresh-agent extend/fix test on accepted demo.
- #242 classify all consumer/demo/agent findings before freeze.

The demo must be a coherent production-grade multi-screen app, not a component catalog, and must prove mobile-first responsive behavior across supported screen/form-factor classes.

# R11 — Freeze, immutable candidate & owner-gated release

Execution order is intentionally different from numeric identifier order:

1. #243 API freeze.
2. #244 token lifecycle/vocabulary freeze.
3. #245 semver/breaking-change audit.
4. **#256 rollback/hotfix/deprecation runbook + no-publication dry-run before candidate.**
5. #246 immutable `1.0.0-rc-ready.N` candidate, no publication.
6. #247 exact-candidate automated CI/consumer/compat/performance matrix.
7. #248 exact-candidate native runtime matrix.
8. #249 exact-candidate VoiceOver/TalkBack acceptance.
9. #250 exact-candidate Web accessibility/keyboard acceptance.
10. #251 security/release-readiness audit including #256.
11. #252 final changelog/migration guide.
12. #253 bounded RC soak/external feedback.
13. **STOP — BeeUI is 1.0-ready, not released.**
14. #254 owner-authorized exact-candidate `1.0.0` publication only.
15. #255 verify actual public artifacts after authorized publication.

If #255 finds an incident, execute the already-prepared #256 runbook. Never silently mutate immutable npm artifacts or rewrite release history.

---

# Mandatory worker protocol

Every child issue inherits `docs/agent-execution-contract.md` even if its body does not repeat it.

A task is not `READY_FOR_INDEPENDENT_REVIEW` until its worker has:

1. derived and recorded the accepted exact base;
2. verified every hard dependency on that base;
3. implemented only the assigned scope;
4. run every applicable exact-head self-test;
5. performed mandatory exact-head self-review;
6. fixed self-review findings and rerun affected verification;
7. opened/updated an unmerged PR with exact base/head SHA, evidence classes, skipped-gate reasons, risks and the statement `NOT MERGED — ready for independent review`.

Self-review never replaces independent review.

## Minimum self-review categories

- scope/DoD completeness and no unrelated change;
- public API/default/controlled-state/semver impact;
- deliberate Web/iOS/Android behavior;
- accessibility/keyboard/focus, RTL, large text, high contrast and reduced motion;
- async races/cleanup/unmount/Back/runtime failure paths where applicable;
- no duplicate theme/overlay/focus/direction/state authority;
- package/registry/private-import/workspace leakage;
- docs/AI metadata/generated-artifact consistency;
- file mode, EOF newline, whitespace, debug/temp/binary hygiene;
- load-bearing tests and evidence-class honesty;
- no owner/admin/release gate crossed.

# Owner/admin gates

Agents may research and prepare evidence/configuration but must stop at `OWNER_ACTION_REQUIRED` when the final action belongs to the owner/admin.

Explicit gated areas include:

- #188 final license choice when policy remains ambiguous;
- #195 repository visibility change;
- #198 npm scope/account permission actions;
- #205 trusted-publisher/release-environment account actions;
- #234 private external-consumer selection/access;
- #253 private reviewer/artifact sharing where authorization is required;
- **#254 BeeUI 1.0 publication**.

# Final acceptance checklist

## Runtime/components

- [ ] #59 bounded-completion remediation accepted.
- [ ] #62 support/quarantine policy explicit and honest.
- [ ] Tooltip stable and fully distributed.
- [ ] Sheet stable on native with coherent Web policy.
- [ ] Table/DataTable stable, accessible, responsive and performance-bounded.
- [ ] Calendar/DatePicker/DateTimePicker stable with explicit value/timezone/i18n semantics.

## Accessibility/compatibility

- [ ] RTL systemic across components/overlays/Table/date/demo.
- [ ] documented large-text stress passes.
- [ ] final Web keyboard + automated a11y gates pass.
- [ ] VoiceOver/TalkBack matrices recorded.
- [ ] compatibility docs/package peers/CLI diagnostics/CI agree.

## Distribution

- [ ] deterministic package + CLI tarballs exist.
- [ ] clean Expo/bare RN/Web/source-owned consumers pass.
- [ ] registry covers the complete stable 1.0 surface.
- [ ] provenance/release environment is prepared/protected.
- [ ] no stable package/CLI publication occurred before explicit owner authorization.

## AI-native/public DX

- [ ] public docs + Showcase + native preview release-ready.
- [ ] canonical `llms.txt` family freshness-checked.
- [ ] agent-development/dispatcher contract complete.
- [ ] fresh-agent regression suite meets accepted threshold.

## Product proof

- [ ] production demo is a real multi-screen application.
- [ ] demo passes iOS/Android/Web, mobile-first responsive, RTL, large-text, dark/high-contrast and runtime review.
- [ ] fresh agent can build and extend/fix representative BeeUI flows from canonical context.
- [ ] at least one independent real-world consumer evaluated.

## Release integrity

- [ ] API/token lifecycle frozen after all feedback.
- [ ] rollback/hotfix/deprecation runbook dry-run complete.
- [ ] changelog/migration guide matches exact candidate.
- [ ] one immutable RC-ready artifact set passes all required exact-candidate gates.
- [ ] no accepted P0/P1 blocker remains.
- [ ] repository owner separately and explicitly authorizes release before #254 executes.

## Maintenance rule

When accepted work changes current state, dependency order or a public contract, update #114 and the affected canonical docs in the same integration change or a linked synchronization PR.

Completed work must not remain described as future work. Future or release-ready-but-unpublished work must not be described as already public.
