# Changesets

Every change to the public surface carries a changeset: `pnpm changeset`, pick the packages, pick the bump, describe what a consumer must do. The four public packages are a `fixed` group, so one bump moves all of them — `docs/release.md` requires lockstep versions and this is where that is enforced.

`pnpm docs:surface:diff` compares `docs/public-surface.inventory.json` at HEAD against the base branch. A removed row, one that lost its root-barrel reach, or one that moved package is breaking and needs a changeset at or above the floor — `minor` or `major` while the root major is 0, `major` above. An added or reclassified row needs any changeset. The diff decides, not memory.

## Cutting a version

1. `pnpm exec changeset version` — bumps the four public packages together (`fixed` group) and writes `CHANGELOG.md` entries from the changesets. It cannot touch the root manifest (private, not a workspace member), the Worker manifest or the Expo identities.
2. `pnpm version:sync` — copies the packages' version onto `package.json`, `web/worker/package.json`, `apps/demo/app.json` and `apps/showcase/app.json`; `release-control-plane:check` fails until this runs.
3. Update `currentVersion` / `candidateStableVersion` / `prereleaseVersionPattern` / `prereleaseExample` in the `dist-tag-policy` block of `docs/dist-tag-policy.md`, and `candidateVersion` in `docs/consumer-compatibility-report.md`. `pnpm dist-policy:check` fails until they match the root.
4. `pnpm release-control-plane:check` (lockstep), `pnpm web:check` (Expo and Worker identities), `pnpm docs:surface:acknowledge` if the ownership gate asks.
5. Publication stays owner-gated (#254).
