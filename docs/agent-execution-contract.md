# BeeUI 1.0 Agent Execution Contract

This document is the mandatory execution protocol for every BeeUI 1.0 child issue under [#114](https://github.com/beobungbu/BeeUI/issues/114).

A child issue may add stricter requirements, but it may not weaken this contract. When an issue body and this file appear to conflict, stop and report the conflict before implementation.

## Roles

### Implementation agent

Claude, Codex, or another coding agent may implement an assigned issue, run tests, perform self-review, push a branch, and open/update a PR.

The implementation agent must **not**:

- merge its own PR;
- merge sibling PRs;
- update `main` directly;
- publish npm packages, the BeeUI CLI, release tags, or stable dist-tags;
- make the repository public;
- choose a legal/business policy that is explicitly owner-gated;
- weaken required checks to make a PR green;
- claim browser/compile/simulator evidence proves a stronger runtime/device class than was actually tested.

### Independent reviewer

A different review pass reviews the implementation agent's exact PR head for scope, behavior, tests, architecture, accessibility, compatibility, evidence quality, and integration risk.

An implementation agent's self-review is mandatory but is **not** a substitute for independent review.

## Authoritative inputs

Before starting any issue, read:

1. the assigned GitHub issue body;
2. parent tracker #114;
3. `docs/roadmap.md`;
4. this execution contract;
5. directly referenced ADRs/contracts/current implementation files.

Do not use stale SHAs, old prompt copies, or issue comments as authority when current `main`, #114, or the current issue says otherwise.

## Startup protocol

For every implementation issue:

1. `git fetch origin`.
2. Record the exact current accepted base SHA.
3. Verify all hard dependencies named in the issue and `docs/roadmap.md` are complete/merged on that base.
4. If a dependency is missing, stale, red, or only present in an unmerged sibling PR, **STOP** and report `BLOCKED_BY_DEPENDENCY`.
5. Create one branch for one issue from the accepted base.
6. Record the branch and base SHA in the PR body.
7. Inspect current code before changing it; do not implement from issue prose alone.

Never silently rebase onto a different behavioral base after implementation. If the base changes materially, re-evaluate and rerun affected verification.

## Scope discipline

One issue = one primary deliverable.

Allowed adjacent changes are limited to what is necessary for the issue's contract: tests, types, docs, registry metadata, generated artifacts, examples, and CI wiring directly required by the change.

If implementation uncovers a reusable unrelated gap:

- do not opportunistically redesign it;
- create/report a focused follow-up issue;
- continue only if the current issue remains correct without that unrelated change.

Shared integration surfaces—public exports, registry, package manifests, token vocabulary, release workflows, docs metadata—must be serialized when sibling PRs can collide.

## Implementation quality rules

Every implementation must preserve BeeUI's established invariants unless an accepted ADR explicitly changes them:

- semantic-token consumption; no new brand literals in reusable components;
- no duplicate theme, overlay, focus, direction, or state authority;
- Web/native behavior may differ when platform-honest, but public contracts must remain coherent;
- router/data fetching/backend/auth/payment/form-library ownership stays outside BeeUI unless the issue explicitly changes that boundary;
- accessibility, RTL, large text, high contrast, and reduced motion are part of component correctness;
- controlled/uncontrolled contracts must handle delayed parent updates and cleanup deterministically;
- async/runtime paths must cover stale callbacks, unmount/close, supersession, and failure states where applicable;
- source-owned code may not leak `workspace:*`, private monorepo imports, or undeclared dependencies;
- release-ready is not the same as publicly published.

## Mandatory self-test protocol

The implementation agent must run all verification applicable to the exact PR head.

### Always required

- repository hygiene / formatting checks provided by the repo;
- `git diff --check` or equivalent whitespace validation;
- strict TypeScript/typecheck;
- targeted tests for the changed behavior;
- the repository's normal test suite when reasonably applicable;
- release/package verification when public package surface or release contracts are affected.

### Required when applicable

- generated-token freshness and token lifecycle/semantic-consumption guards;
- registry verification for public/source-owned component changes;
- packed-artifact/clean-consumer checks for package or CLI changes;
- real Playwright interaction tests for Web behavior;
- visual regression for rendered UI changes;
- Android/iOS native compile for native-sensitive changes;
- real simulator/emulator/device runtime proof for gesture, keyboard, Back, measurement, presentation, or other runtime-sensitive behavior;
- Web automated accessibility + keyboard tests for Web-capable interactive changes;
- VoiceOver/TalkBack evidence when the issue explicitly requires assistive-technology acceptance;
- performance harness when the issue changes a performance-budgeted path.

Do not mark a test as passed if it was skipped. Record `SKIPPED` with the policy reason and whether the skip is acceptable for this issue.

## Load-bearing test requirement

New regression tests must fail when the intended fix/contract is reverted or bypassed.

Do not satisfy an issue with tests that only exercise mocks, snapshots, type compilation, or implementation details when the reported risk is runtime/interaction behavior.

Avoid arbitrary sleeps for async correctness when deterministic schedulers/seams are possible.

## Mandatory self-review protocol

Before opening or handing off a PR, the implementation agent must review the exact head as if reviewing another contributor.

Check all of the following:

- issue scope and every DoD item are actually satisfied;
- no unrelated behavioral change or scope creep;
- no accidental public API expansion or semver break;
- defaults and controlled/uncontrolled behavior remain coherent;
- Web/iOS/Android differences are intentional and documented;
- accessibility roles/names/states/focus/keyboard are correct;
- RTL/logical direction, large text, high contrast, reduced motion are handled where applicable;
- cleanup, stale async callbacks, races, duplicate registration, and unmount/close behavior are covered where applicable;
- no duplicate runtime/provider/store/portal/theme authority was introduced;
- no private/workspace/deep-import leakage;
- registry/package/docs/AI metadata were updated when the stable public surface changed;
- generated artifacts are current;
- file modes, EOF newlines, accidental binaries, temporary files, logs, and debug output are clean;
- tests are load-bearing and the claimed evidence class matches what actually ran;
- owner/admin/release gates were not crossed.

If self-review finds a problem, fix it and rerun affected tests before handoff.

## PR handoff contract

Every implementation PR must contain:

- issue link;
- exact base SHA;
- exact head SHA;
- concise behavior/API summary;
- files/areas changed;
- explicit out-of-scope items;
- compatibility/platform impact;
- accessibility/RTL/large-text/reduced-motion impact;
- deterministic test commands and results;
- browser/visual/native/runtime evidence and exact environment where applicable;
- skipped gates and why the skip is valid;
- package/registry/docs/AI metadata changes;
- migration/semver impact;
- self-review findings and fixes;
- remaining risks/limitations;
- statement: `NOT MERGED — ready for independent review`.

Never report only "CI green". Identify the exact head and the actual gates that are green on that head.

## Decision and owner gates

The following actions require explicit owner approval and are not autonomous implementation actions:

- legal/license business decision when multiple viable policies remain;
- switching repository visibility to public;
- actions requiring npm organization/scope ownership or account-level permission changes;
- release-environment/account changes that cannot be safely prepared without owner/admin action;
- choosing a private/customer real-world consumer when owner selection/access is required;
- final BeeUI 1.0 publication (#254).

For these issues the agent may research, prepare code/config/docs, and produce a decision packet, then stop at `OWNER_ACTION_REQUIRED` instead of guessing.

## Publication hard stop

No task except owner-authorized #254 may publish stable BeeUI packages/CLI or create the final 1.0 release.

Even #254 must abort unless the owner explicitly commands the release and the exact approved candidate/evidence remains current and green.

## Completion state

An implementation issue is ready for independent review only when:

1. dependencies were satisfied on the recorded base;
2. implementation matches scope and DoD;
3. applicable self-tests pass on exact head;
4. mandatory self-review is complete;
5. required evidence is attached or linked;
6. no owner/admin gate was crossed;
7. PR is open and unmerged.

Anything less is `NOT_READY` or `BLOCKED`, not complete.
