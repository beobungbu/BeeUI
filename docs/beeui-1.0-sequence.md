# BeeUI 1.0 Authoritative Execution Sequence

This file is the dependency/dispatch authority for the BeeUI 1.0 program tracked by #114.

**Issue number is not execution order.** The roadmap defines product scope, each issue defines task scope, `docs/agent-execution-contract.md` defines worker behavior, and this file defines when work is eligible.

## Dispatch invariants

- Never dispatch an issue merely because its number is next.
- A task is `ELIGIBLE` only when every hard dependency is merged/accepted on the selected base.
- One worker = one issue/branch/PR unless an issue is explicitly an integration epic.
- Maximum ordinary parallelism: six independent workers. Six is a ceiling, not a utilization target — dispatch fewer whenever eligibility or collision analysis does not support six independent workers.
- Sibling work touching public exports, registry, package manifests, tokens, canonical docs/AI metadata, release workflows, or shared demo shell/state authorities must integrate serially.
- Every worker follows `docs/agent-execution-contract.md`, completes exact-head self-tests + self-review, then stops with an unmerged PR for independent review.
- Owner/admin/legal/account/release gates return `OWNER_ACTION_REQUIRED`; they are not autonomous actions.
- Never automatically continue into a newly unblocked wave when only the current wave was requested.

## S0 — Control plane and repository hygiene

Do not dispatch BeeUI 1.0 implementation work from `main` until the canonical control-plane PR containing this file, `docs/roadmap.md`, and `docs/agent-execution-contract.md` is merged.

### S0-A — parallel

- #115 — reconcile stale Theme v3 issues.
- #116 — supersede obsolete PR #86.
- #118 — labels/milestone taxonomy.

### S0-B

- #117 — current-state documentation synchronization after S0-A reconciliation.
- #119 — protect `main`/release paths using actual workflow/check names; owner/admin-only changes stop at the appropriate gate.

## S1 — Runtime, compatibility core, accessibility foundations

These lanes can progress in parallel when their changed-file authorities do not collide.

### Runtime lane

`#120 → #121 → (#122 + #123 + #124) → #125 → #126 → #127`

- #128 may research/formalize #62 policy after #120, but final wording/lifecycle uses current runtime evidence.

### Compatibility-core lane

`#129 → (#130 + #131 + #132 + #133 + #134 + #135)`

Do not run #136–#138 yet; final Web compatibility includes the new hard 1.0 surfaces.

### Accessibility-foundation lane

- `#139 → #140` — direction architecture then existing reusable-source logical-direction audit.
- #143 — Dynamic Type/large-text policy and reusable stress fixtures on the current stable surface.
- #145 — reusable automated Web accessibility harness on existing representative surfaces.

Do not require #141/#142/#144/#146–#150 before R4. Those are post-component acceptance tasks.

### Early performance foundation

- #179 benchmark harness may run in S1 if it does not collide with active runtime infrastructure.

## S2 — Hard 1.0 component lanes

Four feature lanes may run in parallel. Their final shared export/registry/docs/AI integrations are serialized.

### Tooltip

`#151 → (#152 + #153) → #154 → #155`

- #151 uses runtime contract #120–#125 + direction foundation #139.
- #152 uses #151 + #125 + #139/#140 + Web a11y harness #145.
- #153 uses #151 + #139 + large-text policy #143; it does not wait for final VoiceOver/TalkBack matrices.
- #154 uses #152/#153 + final runtime hardening #127.

### Sheet / BottomSheet

`#156 → #157 → (#158 + #159) → #160 → #161`

- #158 uses #156/#157 + #127 + #139 + #143.
- #159 uses #157 + #139/#140 + #145 and does not depend on final Web contract #136.
- #160 performs dedicated native runtime acceptance.

### Table / DataTable

`#164 → #165 → (#166 + #167 + #168) → #169 → #170`

- #166 uses direction/a11y foundations #139/#140/#145, not final cross-component R3 acceptance.
- #167 uses #139/#143 and local native semantics, not final #147/#148.
- #168 uses benchmark harness #179; it does not wait for complete R5.

### Calendar / DatePicker / DateTimePicker

`#171 → #172 → #173 → #174 → #175 → #176 → #177 → #178`

If #171 selects a presentation that requires Sheet, update downstream issues with the exact required #157/#158/#159 dependency rather than vague `R4B` wording.

### Serialized R4 integration

#155, #161, #170 and #178 may originate from independent lanes but must integrate one at a time against the latest accepted base because they can collide in exports, registry, docs metadata and AI metadata.

### Optional decisions

- #162 — after stable Sheet; may explicitly defer adaptive Select for 1.0.
- #163 — Slider decision; if promoted, implementation must be complete/tested/registered/documented, never partial.

## S3 — Final compatibility and cross-component acceptance

After Tooltip, Sheet, Table and date controls are stable:

### Final compatibility

`#136 → #137 → #138`

#136 proves the complete Web contract including new 1.0 surfaces. #137 wires the support matrix. #138 publishes/mechanically validates the final compatibility contract.

### Final accessibility / RTL / localization

- #141 — RTL overlay acceptance after #154/#127.
- #142 — full RTL component stress after #155/#161/#170/#178.
- #144 — localization/long-content stress after the hard-component integrations.
- #146 — final keyboard/focus matrix after #152/#159/#166/#176 + #145.
- #147 — VoiceOver matrix after #153/#160/#167/#176.
- #148 — TalkBack matrix after #153/#160/#167/#176.
- #149 — reduced-motion acceptance after #154/#160/#177.
- #150 — final accessibility documentation after #141–#149 and stable component contracts.

Demo-specific rows may be appended later, but all required component-level acceptance must be complete before freeze.

## S4 — Performance, OSS/security and distribution foundation

### Performance

After the measured component surfaces exist:

- #180 render/update stress.
- #181 overlay/Tooltip/Sheet latency.
- #182 theme runtime performance.

Packaging-dependent performance uses this exact order:

`#197 → #198 → (#199 + #200) → #183 → #184 → #201 → #202 → #203 → #204`

Then:

`#185 → #186`

This explicitly removes the old R5.5/R5.6/R7.5 circular wait.

### OSS/security/governance — parallel preparation

- #187 secret/history/asset audit.
- #189 SECURITY.md.
- #190 CONTRIBUTING.md.
- #191 Code of Conduct.
- #192 issue/PR templates.
- #193 Actions/fork/self-hosted-runner hardening.
- #194 dependency/security automation.

Owner/decision-gated:

- #188 license decision packet; final business/legal choice may require owner approval.
- #195 repository-public preflight; actual visibility change is owner-gated.
- #196 final ruleset after #119/#193 and chosen release/public policy.

## S5 — Publication-ready packages and CLI, still unpublished

### Packages

Primary chain:

`#197 → #198 → (#199 + #200) → #183 → #184 → #201 → #202 → #203 → #204`

Then:

- #205 trusted-publishing/provenance preparation after #193/#196/#198/#199; account/environment actions may return `OWNER_ACTION_REQUIRED`.
- #206 dist-tag/prerelease policy after #205 design is known.
- #207 integrity/provenance verification after #203/#205.
- #208 package compatibility report after #204 + final #138.

No task in this chain publishes npm packages.

### CLI/source ownership

`#209 → (#210 + #211 + #213 + #216)`

Then:

- #212 after final compatibility ranges #138.
- #214 after #213.
- #215 after #212/#213.
- #217 after stable R4 integrations #155/#161/#170/#178.
- #218 after #210–#217.
- #219 optional after #218; may explicitly defer.

No task in this chain publishes the CLI.

## S6 — Docs, Showcase and AI-native development

Site infrastructure may start earlier, but final acceptance uses stable contracts.

- #220 docs-site infrastructure/IA may start before API freeze; final content must match stable component/package/CLI contracts.
- #221 final per-component docs after #155/#161/#170/#178 + #217.
- #223 final production pattern docs after #169/#177.
- #222 after #220/#221/#218 for executable canonical examples.
- #224 final Web Showcase after stable components/patterns + #150.
- #225 native preview after stable native components/runtime foundation.

Hard AI-native chain:

`#226 → #227 → #228`

- #226 consumes final compatibility #138, accessibility docs #150, package report #208, CLI E2E #218, component docs #221, executable examples #222 and pattern docs #223.
- #227 defines the agent-development/prompt contract and canonical dispatcher behavior.
- #228 runs repeatable fresh-agent regression from canonical context + retained packed artifacts.
- #229 MCP is stretch and may defer after #228.

## S7 — Independent consumers and production demo

### Independent starters/consumers

When their exact dependencies are satisfied, these can run in parallel:

- #230 — Expo package starter after #203/#208 + stable hard components.
- #231 — source-ownership starter after #218.
- #232 — bare RN starter after #138/#203/#208.
- #233 — independent Web consumer after #136/#203/#208.

### External/agent proof

- #234 — real-world external consumer; if private/customer-owned selection/access is needed, stop at `OWNER_ACTION_REQUIRED`.
- #235 — fresh-agent reference app after #228/#203/#218.

### Production-demo architecture

- #236 — architecture/spec after accepted hard-component contracts #151/#157/#164/#171.

### Production-demo functional implementation

#237 is an **integration epic**, not one giant implementation-worker issue.

1. #258 — shell + mobile-first responsive navigation. Establishes shared demo shell/navigation authority.
2. After accepted #258 integration base:
   - #259 — dashboard/data overview.
   - #260 — searchable/filterable Table/DataTable flow; also requires stable #170.
   - #261 — detail/edit-form flow.
   - #262 — scheduling/date-time flow; also requires stable #178.
3. #263 — settings/accessibility preferences + integrated states/E2E after #259–#262 are accepted/integrated.
4. #237 closes only after #258–#263 are independently accepted and the integrated exact head passes functional critical-path E2E.

Feature work may be implemented in parallel only when changed-file ownership is independent. Shared shell/navigation/state/service authority changes integrate serially under `docs/beeui-1.0-integration-discipline.md`.

### Demo acceptance

`#237/#263 → #238 → #239 → #240 → #241 → #242`

- #238 final iOS/Android/Web platform/runtime matrix also depends on final #136 and #141–#149.
- #239 production engineering quality.
- #240 real rendered visual/product polish.
- #241 fresh-agent extension/fix after #228 and accepted demo through #240.
- #242 classifies #234/#235/#241 and all demo/consumer findings before freeze.

## S8 — Freeze, rollback readiness and immutable RC-ready evidence

Only after every hard component/accessibility/compatibility/consumer/demo blocker is resolved:

1. `#243 + #244` — API and token freeze; may run in parallel, then integrate.
2. #245 — final semver/breaking-change audit.
3. **#256 — rollback/hotfix/deprecation runbook + no-publication incident dry-run.** This intentionally executes here despite identifier R11.14.
4. #246 — create immutable `1.0.0-rc-ready.N` candidate without publication.
5. #247 — exact-candidate automated CI/consumer/compat/performance matrix.
6. #248 — exact-candidate native runtime matrix.
7. `#249 + #250` — exact-candidate VoiceOver/TalkBack and Web accessibility acceptance.
8. #251 — security/release-readiness audit, including #256 and owner-gate verification.
9. #252 — final changelog/migration guide matched to exact candidate.
10. #253 — bounded RC soak/external feedback.
11. **STOP — BeeUI is 1.0-ready, not released.**

Any accepted P0/P1 fix after #246 invalidates the candidate. Create a new candidate and rerun every affected exact-candidate gate.

## S9 — Owner-authorized publication only

#254 is never auto-dispatched.

It may execute only after the repository owner explicitly commands BeeUI 1.0 publication and confirms the approved exact candidate remains current/green.

After #254:

- #255 verifies the actual public npm/CLI/docs/tag/release artifacts.
- If #255 finds an incident, execute the already-prepared #256 runbook; do not silently patch immutable artifacts or rewrite release history.

## Parallelism examples

Good:

- S1: runtime + compatibility core + accessibility foundation + benchmark harness.
- S2: Tooltip + Sheet + Table + Calendar/date implementation lanes.
- S7: independent Expo + source-owned + bare RN + Web consumer lanes.

Bad:

- #155/#161/#170/#178 integrating exports/registry/docs metadata simultaneously.
- export-map work before #184 is decided.
- multiple workers rewriting the same production-demo shell/navigation/state core.
- any candidate-changing implementation in parallel with S8 release evidence.
- any autonomous publication/visibility/account action.

## Dispatcher eligibility report

Every dispatch wave reports:

- `AUTHORITATIVE_BASE_SHA`;
- issues considered;
- `ELIGIBLE` issues and exact satisfied dependencies;
- blocked issues and exact missing dependency;
- collision/serialization notes;
- worker branch → PR → exact head SHA;
- self-test state;
- self-review state;
- exact-head CI/evidence state;
- independent-review state;
- owner/admin action required, if any;
- confirmation that no PR was self-merged and no npm/CLI/release publication occurred.
