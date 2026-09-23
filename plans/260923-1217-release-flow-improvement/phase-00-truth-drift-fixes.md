# Phase 00 — fix truth drift that is wrong today

**Context:** audit reports §2/§4/§7 and the literal inventory.
**When:** after PR #622 merges, so rc.2 evidence edits do not conflict.
**Size:** S. Docs/evidence only; no release workflow behavior changes.

## Requirements

1. Correct the rc.1 provenance record without collapsing distinct SHAs:
   - keep the original verified candidate/source SHA `58d038dfd63267a0760b6eb1b5749e96939edb28` as historical candidate evidence;
   - record the `main` promotion/publish-run SHA separately. PR #538 merged to `main` as `ddf415b0d665c14e1b154bb02570a906585b4b98`; call it the publish SHA only if the actual npm workflow run/provenance proves publication ran from that SHA;
   - record registry `dist.integrity`, `dist.shasum` and unpacked size for all four packages;
   - where available, link/record npm provenance or the GitHub release workflow run so commit provenance is not inferred from npm integrity alone.
2. Preserve the old `58d038d` candidate table under a clear historical/frozen-candidate heading; do not rewrite history to pretend candidate SHA and promotion SHA are the same.
3. Verify the rc.1 status banner and publication/provenance section describe the current post-publish state.
4. Update `CONTRIBUTING.md` and `docs/beeui-1.0-owner-gates.md`: the repository is public/published, while registry mutation remains owner-gated per operation.
5. Move `docs/rc-ci-matrix.md` under `docs/archive/` or add a top-of-file superseded banner and remove it from current indexes.
6. Update `docs/npm-release-bootstrap.md` “Subsequent RCs” to the real sequence: release branch → PR to `development` → promotion/sync to `main` → explicit `stage-rc` dispatch → release-environment/2FA approval → registry observation → evidence update.
7. Document the GNU tar requirement for local `pnpm release:verify` on macOS, matching the deterministic artifact script.

## Files

Modify: `docs/rc-candidate.md`, `CONTRIBUTING.md`, `docs/beeui-1.0-owner-gates.md`, `docs/npm-release-bootstrap.md`, `docs/release.md`, `docs/rc-ci-matrix.md` (move or banner).

## Steps

1. Collect read-only registry metadata for rc.1 and the authoritative publication workflow/provenance record.
2. Edit the docs so candidate source, integration/promotion and publish provenance are separate fields.
3. Run `pnpm docs:public-truth:check`, `pnpm docs:surface:check`, `pnpm dist-policy:check`, `pnpm release-control-plane:check`.
4. Open/merge a docs-only PR into `development`.

## Validation

- `58d038d` is explicitly labeled candidate/source evidence, not silently replaced.
- `ddf415b` is labeled according to verified workflow provenance, not merely because it is PR #538’s merge commit.
- No current-state “not published” / “remains private” claim survives in contributor/owner-gate docs.
- Current release docs no longer direct users to the superseded CI matrix.
- All four documentation/release-policy gates above are green.

## Risks / rollback

Docs/evidence only; revert the PR. Do not touch the live policy JSON schema here (Phase 01 owns it).
