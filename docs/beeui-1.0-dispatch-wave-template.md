# BeeUI 1.0 Dispatch Wave Template

Use this structure in every implementation-dispatch request/report.

## Wave input

- Program: #114
- Requested wave: `<sequence wave / explicit issue set>`
- Repository: `beobungbu/BeeUI`
- `AUTHORITATIVE_BASE_SHA`: derive from current accepted `origin/main` at dispatch time.
- Maximum workers: 4 unless a narrower limit is stated.

## Eligibility table

| Issue | Dependency state | Collision state | Owner gate | Dispatch result |
| --- | --- | --- | --- | --- |
| #... | satisfied / missing #... | independent / serialize after #... | none / OWNER_ACTION_REQUIRED | ELIGIBLE / BLOCKED |

## Worker contract

Each worker:

- one issue / one branch / one PR;
- current issue + #114 + roadmap + sequence + execution contract read before coding;
- exact base recorded;
- mandatory applicable self-tests on exact head;
- mandatory self-review;
- PR remains unmerged for independent review.

## Final wave report

For each dispatched issue record:

| Issue | Branch | PR | Base SHA | Head SHA | Self-test | Self-review | CI exact head | Review state |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

Also report:

- blocked issues and exact missing dependency;
- shared-authority serialization required next;
- owner/admin actions required;
- confirmation that no child PR was merged;
- confirmation that no npm/CLI/release publication occurred;
- confirmation that no newly unblocked wave was started automatically.
