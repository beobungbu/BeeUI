# BeeUI 1.0 Owner and Admin Gates

This file identifies BeeUI 1.0 tasks where an implementation agent may prepare evidence/configuration but must not autonomously cross the final decision/action boundary.

## General rule

When a task reaches an owner/admin boundary, the agent must stop with:

`OWNER_ACTION_REQUIRED`

and report:

- exact issue;
- exact requested decision/action;
- options and recommendation when applicable;
- evidence already prepared;
- what remains blocked;
- whether any code/config PR is ready for independent review.

Do not invent credentials, permissions, organization ownership, legal policy, customer access, or release authorization.

## Explicit gates

### #188 — OSS license

The agent may audit dependencies/assets, compare viable licenses, prepare LICENSE/package/doc changes, and recommend a default. The final legal/business license choice requires owner approval when more than one viable policy remains.

### #195 — repository visibility

The agent may perform all public-readiness preflight work and produce the exact visibility-change checklist. It must not autonomously switch the repository from private to public.

### #198 — npm package/scope ownership

The agent may verify availability using authorized access and prepare naming alternatives. Account/org/scope ownership decisions or permission changes requiring owner action must stop at the gate. No package publication is allowed.

### #205 — trusted publishing / release environment

The agent may prepare workflow/configuration and verify least-privilege design. Any account-level setup, environment approval, or credential/provenance authority requiring owner/admin interaction must stop at the gate. No registry publication is allowed.

The concrete npm-side bootstrap, temporary-token teardown, and Trusted Publisher binding handoff is documented in [docs/npm-release-bootstrap.md](npm-release-bootstrap.md).

### #234 — independent real-world consumer

If the selected external application is private/customer-owned or otherwise requires owner choice/access, the agent must request that selection/access rather than guessing a codebase.

### #253 — external feedback/soak

The agent may prepare the candidate, review packet and evidence collection. Selection of private external reviewers or sharing private artifacts must follow owner approval/access policy.

### #254 — BeeUI 1.0 publication

Hard gate. Technical readiness is not authorization.

The issue may execute only after the repository owner explicitly commands BeeUI 1.0 release/publication and confirms the approved exact candidate.

Without that explicit command, the correct state is `OWNER_ACTION_REQUIRED` / `STOP`.

## Non-gated engineering decisions

Normal engineering decisions already bounded by an accepted issue/ADR may be made by the implementation agent and reviewed independently. Do not escalate every implementation choice to the owner; use this gate only for genuine business/legal/account/visibility/release authority.
