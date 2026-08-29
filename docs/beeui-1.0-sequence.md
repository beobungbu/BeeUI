# BeeUI 1.0 Authoritative Execution Sequence

This is the dependency/dispatch authority for the BeeUI 1.0 program tracked by #114.

It exists to prevent agents from treating GitHub issue number order as dependency order. The roadmap defines product scope; issue bodies define task scope; `docs/agent-execution-contract.md` defines how every agent works; this file defines **when a task is eligible**.

## Dispatch invariants

- Never dispatch an issue merely because its issue number is next.
- A task is eligible only when every hard dependency below is merged/accepted on the chosen base.
- One worker = one issue/branch/PR unless the issue explicitly acts as an integration epic.
- Up to four workers may run in parallel only on independent lanes with low shared-file collision risk.
- Public exports, registry, package manifests, token vocabulary, docs metadata, and release workflow integration are serialized when sibling changes touch the same authority.
- Implementation agents self-test and self-review under `docs/agent-execution-contract.md`, then stop with an unmerged PR for independent review.
- Owner/admin gates are not autonomous tasks.

## S0 — Control plane and repository hygiene

The BeeUI 1.0 program should not dispatch implementation work until the canonical roadmap/sequence/execution-contract PR is merged.

After that merge:

### Parallel wave S0-A

- #115 — stale Theme v3 issue reconciliation.
- #116 — supersede obsolete PR #86.
- #118 — labels/milestone taxonomy.

### Serialized wave S0-B

- #117 — current-state documentation synchronization; run after S0-A so docs reflect the reconciled tracker state.
- #119 — `main`/release-path protection; may be prepared in parallel with #117, but rules must be validated against actual current check names after the control-plane merge.

Owner/admin actions discovered by #119 must stop at `OWNER_ACTION_REQUIRED` when the agent lacks permission or when policy choice is required.

## S1 — Runtime, compatibility core, accessibility foundation

These lanes can progress in parallel after S0 unless a task touches a shared runtime authority.

### Lane S1-Runtime

`#120 → #121 → (#122 + #123 + #124) → #125 → #126 → #127`

- #128 may research/formalize #62 policy in parallel after #120, but closure wording must use current runtime evidence.

### Lane S1-Compatibility core

`#129 → (#130 + #131 + #132 + #133 + #134 + #135)`

Do **not** run #136–#138 yet; final Web compatibility includes new 1.0 components and therefore belongs after R4 stabilization.

### Lane S1-Accessibility foundation

- `#139 → #140` — direction architecture then reusable existing-source logical-direction audit.
- #143 — establish large-text policy/baseline for existing components; new R4 surfaces are acceptance targets later, not blockers for the foundation portion.
- #145 — establish the reusable Web automated-a11y harness on existing representative surfaces; new R4/demo scenarios are added later.

Do **not** require #141/#142/#144/#146–#150 to close before R4. Those are cross-component acceptance tasks and must run after relevant R4 surfaces exist.

## S2 — Hard 1.0 component lanes

Start after runtime/direction foundations required by each lane are accepted. Four lanes may run concurrently, but final export/registry/docs integration tasks must be serialized.

### Tooltip lane

`#151 → (#152 + #153) → #154 → #155`

Hard prerequisites:

- #151: #120–#125 and #139 policy accepted.
- #152: #151 + Web focus/a11y harness from #145 + direction foundation #139/#140.
- #153: #151 + native accessibility policy from existing BeeUI contracts; it does not wait for final R3 release matrices.
- #154: #152/#153 plus runtime hardening.
- #155: #154.

### Sheet lane

`#156 → #157 → (#158 + #159) → #160 → #161`

Hard prerequisites:

- #158: #157 + runtime foundation + direction/large-text/reduced-motion policies.
- #159: #157 + established Web focus/a11y harness; it does not depend on final #136 Web compatibility report.
- #161 only after #160.

### Table/DataTable lane

`#164 → #165 → (#166 + #167 + #168) → #169 → #170`

Hard prerequisites:

- #166 uses the R3 direction/a11y/focus **policies/harness**, not final cross-component R3 acceptance.
- #167 uses direction/large-text/native semantics policies, not final VoiceOver/TalkBack release matrices.
- #168 coordinates with the benchmark harness #179 if available; it must not wait for the complete R5 report.

### Calendar/date lane

`#171 → #172 → #173 → #174 → #175 → #176 → #177 → #178`

If the accepted #171 architecture makes DatePicker/DateTimePicker presentation depend on Sheet, record the exact dependency on #157/#158/#159 instead of using a vague `R4B` dependency.

### Serialized R4 integration

Because #155, #161, #170, and #178 can all touch exports, registry, component docs metadata, examples and agent metadata, merge/integrate them one at a time against the latest accepted integration base and rerun impacted closure checks.

### Optional decisions

- #162 — after stable Sheet; may explicitly defer adaptive Select for 1.0.
- #163 — independent Slider decision; if implementation is promoted, it must receive its own complete implementation/test/registry/docs execution plan rather than a partial opportunistic patch.

## S3 — Cross-cutting acceptance and final compatibility

After Tooltip, Sheet, Table and Calendar/date implementations exist:

### Compatibility final

`#136 → #137 → #138`

#136 proves the final Web contract including new 1.0 surfaces. #137 wires the actual support matrix. #138 publishes/mechanically validates the final contract.

### Accessibility/RTL/localization final

- #141 — RTL overlay acceptance after Tooltip exists and runtime hardening is accepted.
- #142 — full RTL component stress after Table/Calendar exist; production-demo rows may be appended after demo exists.
- #144 — full localization/long-content suite after new components exist; production-demo coverage may be appended later.
- #146 — final keyboard/focus acceptance after Web implementations exist.
- #147 — VoiceOver release checklist/acceptance after native new components exist.
- #148 — TalkBack release checklist/acceptance after native new components exist.
- #149 — reduced-motion acceptance after motion-consuming new components exist.
- #150 — accessibility documentation after #141–#149 and stable component contracts.

These tasks do not block initial R4 implementation; they block 1.0 freeze.

## S4 — Performance, OSS/security, distribution foundation

### Performance

- #179 benchmark harness may start in S1/S2.
- After relevant components are stable: `#180 + #181 + #182`.
- Packaging-dependent chain is coordinated with R7:
  - #197 distribution ADR
  - #198 package names/permissions
  - #199 package metadata and #200 package output format
  - #183 footprint baseline on real packed layout
  - #184 granular-export decision
  - #201 final export maps
  - #202 packed inventory
  - #203 prerelease-equivalent retained artifacts
  - #204 clean packed consumers
- After measurement data is stable: `#185 → #186`.

This order removes the previous R5.5/R5.6/R7.5 circular wait.

### OSS/security/governance

Independent preparation may run in parallel:

- #187 secret/history/asset audit.
- #189 SECURITY.md.
- #190 CONTRIBUTING.md.
- #191 Code of Conduct draft/template selection.
- #192 issue/PR templates.
- #193 Actions security audit/hardening.
- #194 dependency automation.

Owner/decision gates:

- #188 license choice: agent prepares a decision packet; final legal/business choice is owner-approved.
- #195 repository-public conversion: **OWNER ACTION REQUIRED**; agent may prepare/preflight but must not autonomously change visibility.
- #196 final ruleset after #119/#193 and chosen public/release policy.

## S5 — Packages and CLI, release-ready but unpublished

### Package chain

`#197 → #198 → (#199 + #200) → #183 → #184 → #201 → #202 → #203 → #204`

Then:

- #205 trusted publishing/provenance preparation after security and package naming/metadata are stable. Account/environment changes may require `OWNER_ACTION_REQUIRED`.
- #206 dist-tag/prerelease policy after #205 design is known.
- #207 provenance/integrity verification after #203/#205.
- #208 compatibility report after #204 and final #138 matrix.

No task in this chain publishes npm artifacts.

### CLI chain

`#209 → (#210 + #211 + #213 + #216)`

Then:

- #212 after final compatibility ranges are available.
- #214 after #213.
- #215 after #212/#213.
- #217 after stable R4 integration (#155/#161/#170/#178).
- #218 after #210–#217.
- #219 optional after #218; may explicitly defer.

No task in this chain publishes the CLI.

## S6 — Docs, Showcase and AI-native contract

Some site infrastructure can start earlier, but final acceptance uses stable APIs.

- #220 docs-site infrastructure/IA may start before all APIs freeze; final content must wait for stable component/package/CLI contracts.
- #221 final per-component docs contract after stable 1.0 component APIs/registry.
- #223 production pattern docs after stable component/pattern additions.
- `#221 + #220 → #222` for executable canonical examples.
- #224 Web Showcase after stable component/pattern surface.
- #225 native preview after stable native Showcase/components.
- **AI-native hard chain:** `#226 → #227 → #228`.
- #229 MCP decision only after #228; stretch and may defer.

## S7 — Independent consumers and production demo

### Independent starters/consumers

After packed package/CLI artifacts exist:

- #230 Expo package starter.
- #231 source-ownership starter.
- #232 bare RN starter.
- #233 independent Web consumer.

These may run in parallel if they do not edit the same shared fixture/config authorities.

### External/agent proof

- #234 real-world external consumer: owner selects/provides access when required; agent must not assume a private/customer codebase.
- #235 fresh-agent reference app after #226–#228 and packed artifacts.

### Production demo

- #236 architecture/spec first.
- #237 is the production-demo **integration epic**, not a single giant worker task. Its implementation is decomposed into dedicated child issues referenced from #237.
- Child implementation work must follow #236 and be integrated serially when it touches shared app shell/navigation/state authorities.
- #238 platform/runtime quality after #237 integration complete.
- #239 engineering quality after #238.
- #240 visual/product polish after #239.
- #241 fresh-agent extension/fix after #240 and #228.
- #242 classify findings after #234/#235/#241.

## S8 — Freeze, immutable candidate, release-readiness

Only after every hard product/component/accessibility/compatibility/consumer/demo blocker is resolved:

1. `#243 + #244` — API and token freeze; may run in parallel, then integrate.
2. #245 — semver/breaking-change audit.
3. #256 — rollback/hotfix/deprecation runbook **before publication**, including dry-run incident exercise.
4. #246 — create immutable `1.0.0-rc-ready.N` evidence candidate without publication.
5. #247 — exact-candidate automated CI matrix.
6. #248 — exact-candidate native runtime matrix.
7. `#249 + #250` — exact-candidate assistive-tech and Web a11y acceptance.
8. #251 — security/release-readiness audit, including owner gate and #256 runbook.
9. #252 — final changelog/migration guide matched to candidate.
10. #253 — bounded RC soak/external feedback.
11. **STOP. BeeUI is 1.0-ready, not released.**

Any accepted P0/P1 fix after #246 invalidates candidate evidence: create a new candidate and rerun all affected exact-candidate gates.

## S9 — Owner-authorized publication only

#254 is not dispatched automatically.

It may run only after the repository owner explicitly commands BeeUI 1.0 publication and confirms the approved exact candidate.

After #254:

- #255 verifies actual public artifacts/channels.
- If verification finds an incident, execute the already-prepared #256 runbook; do not silently patch or rewrite history.

## Suggested maximum parallelism

Use at most four implementation workers in ordinary waves.

Good parallel examples:

- S1: runtime + compatibility core + direction foundation + benchmark harness.
- S2: Tooltip + Sheet + Table + Calendar lanes.
- S7: Expo starter + source-owned starter + bare RN starter + Web starter.

Bad parallel examples:

- #155/#161/#170/#178 all editing registry/exports/docs metadata simultaneously;
- package export-map decisions while the packaging ADR is unsettled;
- multiple workers rewriting the same production-demo shell/navigation/state core;
- any release/publication task in parallel with candidate-changing implementation.

## Eligibility reporting

A dispatcher should report each wave as:

- `AUTHORITATIVE_BASE_SHA`
- eligible issues and exact dependencies satisfied
- blocked issues and missing dependency
- collision/serialization notes
- worker branch/PR/head SHA
- exact-head self-test status
- self-review status
- independent-review status

Never continue automatically into a newly unblocked wave when the user requested only the current dispatch wave.
