# BeeUI 1.0 Integration Discipline

BeeUI 1.0 uses parallel implementation only where branches are truly independent. This file defines high-risk shared authorities that require serialized integration.

## Shared authorities

Treat these paths/concerns as integration-sensitive:

- public package barrels/exports;
- Registry source map, transforms and public-barrel invariants;
- package manifests, export maps, versions and release metadata;
- canonical token source/lifecycle/generated artifacts;
- compatibility support matrix and peer ranges;
- canonical component/AI/docs metadata;
- release workflows, OIDC/provenance and protected environments;
- shared production-demo application shell, routing/navigation and state/service authorities.

## Parallel worker rule

Sibling workers may independently build feature internals and tests from the same accepted base when their changed-file sets and semantic authorities do not overlap materially.

Before integration, compare each sibling PR against the latest accepted integration head.

## Serialized integration rule

For shared-authority changes:

1. Select one approved PR.
2. Integrate it against the current accepted base.
3. Record the new integration SHA.
4. Rebase/update the next approved sibling against that SHA.
5. Resolve semantic conflicts deliberately; do not take `ours/theirs` blindly for generated/public-authority files.
6. Rerun all affected exact-head verification.
7. Repeat one sibling at a time.

## Known serialized BeeUI 1.0 points

- #155, #161, #170, #178 final component export/registry/docs/AI integration.
- R7 package export/manifests/tarball chain.
- R8 complete registry closure and packed CLI integration.
- R9 final docs/component metadata/llms generation.
- R10 production-demo shell integration.
- R11 API/token freeze and release candidate construction.

## No stale-head approval

If a sibling PR was approved before a shared-authority predecessor changed its base, the reviewer must decide whether the approval remains valid. Where behavior/public artifacts changed, update the branch and rerun relevant tests/review instead of treating the old exact-head approval as transferable.
