# ADR-015 — Package version `0.86.2` supersedes the `20260902.0.0` date label

- **Status:** Accepted (owner decision, 2026-09-06)
- **Date:** 2026-09-06
- **Supersedes:** the version-label half of #407 (2026-09-02); the release-integrity findings of #407 stand
- **Machine authority:** `scripts/check-release-control-plane.mjs` (`EXPECTED_VERSION`), `docs/dist-tag-policy.md` (`dist-tag-policy` JSON block)

## Context

#407 replaced the `0.x → 1.0.0` scheme with the date label `20260902.0.0` so that the workspace could sit *at* its stable candidate from the start. That label was encoded into six manifests, three release checks, four test fixtures and the prerelease pattern `^20260902\.0\.0-rc\.N$`, and never published: `dist-tag-policy.published` has been `false` throughout and #254 (npm publication) remains owner-gated.

On 2026-09-05 the owner chose `0.86.2` instead, and on 2026-09-06 reaffirmed it after being shown #407 and the fact that `0.86.2` is also the React Native version this repository pins (`docs/compatibility-matrix.md`, RN 0.86.x row).

## Decision

- The lockstep package version is **`0.86.2`**. Prereleases are `0.86.2-rc.N`; the stable release is `0.86.2`, promoted to `latest` only after verification, exactly as `docs/dist-tag-policy.md` already describes.
- BeeUI 1.0 remains the **product milestone name**, not the package version.
- `docs/rc-candidate.md`, `docs/rc-ci-matrix.md` and `docs/release-integrity-20260902.md` keep their evidence and gain a one-line superseded pointer; they are not otherwise rewritten. `docs/consumer-compatibility-report.md` carries a machine-checked `candidateVersion` and moves with the version. ADR-014's `/api/health` example moves too, because that ADR is still the live authority for that endpoint.

## Consequences

- `package.json` ×6 and the two Expo `app.json` files move to `0.86.2`; `verify-release` and `check-release-control-plane` assert it.
- The coincidence with the React Native version is accepted knowingly. Any reader-facing statement of compatibility must name React Native explicitly (`>=0.86.0 <0.87.0`) rather than rely on the number.
- PR #478 (npm RC bootstrap) hard-codes the old label in its workflow default and prerelease regex; that file is under `.github/` and is changed by that PR's author, not here.
- Subsequent versions follow SemVer. The bump is decided by changesets and a public-surface inventory diff, introduced separately in PR #510; until that merges, `docs/release.md`'s changelog/migration-note requirement is the only rule.
