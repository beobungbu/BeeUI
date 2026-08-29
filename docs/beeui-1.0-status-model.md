# BeeUI 1.0 Task Status Model

Use these states consistently in #114, roadmap updates, dispatcher reports, implementation PRs and review summaries.

- `NOT_STARTED` — dependencies not yet evaluated for this wave.
- `ELIGIBLE` — all hard dependencies are accepted on the chosen base and no owner/admin gate blocks implementation.
- `IN_PROGRESS` — one implementation branch/PR owns the task.
- `BLOCKED_BY_DEPENDENCY` — a named hard dependency is not accepted on the base.
- `OWNER_ACTION_REQUIRED` — implementation/research may be prepared, but a business/legal/account/visibility/release action requires explicit owner/admin approval.
- `SELF_TEST_FAILED` — implementation exists but mandatory applicable self-tests are not green on exact head.
- `SELF_REVIEW_FAILED` — implementation agent found an unresolved blocker during mandatory self-review.
- `READY_FOR_INDEPENDENT_REVIEW` — implementation + applicable exact-head self-tests + self-review complete; PR open and unmerged.
- `REQUEST_CHANGES` — independent review found a blocker.
- `APPROVED` — independent review accepted the exact head; integration/merge still requires the authorized integration action.
- `MERGED` — accepted change is on the canonical integration branch/main as appropriate.
- `DEFERRED` — explicitly not required for BeeUI 1.0; must include rationale/owner or accepted-program decision when applicable.
- `SUPERSEDED` — replaced by a newer issue/contract.

## Rules

- `CI green` alone is not a status.
- A skipped check is not a pass.
- A PR cannot be `READY_FOR_INDEPENDENT_REVIEW` without mandatory self-review.
- `APPROVED` does not mean `MERGED`.
- `1.0-ready` does not mean `released`.
- #254 remains `OWNER_ACTION_REQUIRED` until the owner explicitly commands BeeUI 1.0 publication, regardless of technical status.
