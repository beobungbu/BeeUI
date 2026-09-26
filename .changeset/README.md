# Changesets

Every change to the public surface carries a changeset: `pnpm changeset`, pick the packages, pick the bump, describe what a consumer must do. The four public packages are a `fixed` group, so one bump moves all of them — `docs/release.md` requires lockstep versions and this is where that is enforced.

`pnpm docs:surface:diff` compares `docs/public-surface.inventory.json` at HEAD against the base branch. A removed row, one that lost its root-barrel reach, or one that moved package is breaking and needs a changeset at or above the floor — `minor` or `major` while the root major is 0, `major` above. An added or reclassified row needs any changeset. The diff decides, not memory.

## Prerelease mode

The repository is in Changesets prerelease mode with tag `rc` (`.changeset/pre.json`). That file is written only by `pnpm exec changeset pre enter rc` / `pre exit`; never hand-edit it. While it is present, a `patch` changeset moves `0.86.2-rc.N` to `0.86.2-rc.N+1`, and after `pnpm exec changeset pre exit` the next version run lands on the stable `0.86.2`. `scripts/__tests__/release-version-packages.test.mjs` runs the installed Changesets against the real config to keep that arithmetic proven.

A `minor` or `major` changeset starts a new line (`0.87.0-rc.0`), and `pnpm release:version` refuses it until `candidateStableVersion` in `docs/dist-tag-policy.md` is moved to that line on purpose. A breaking change therefore waits for the next line; it does not ride into the current one.

## Cutting a version

1. `pnpm release:version` — runs `changeset version` (the four packages move together and each gets its `CHANGELOG.md` entry), refuses any result that is not one lockstep version on the `candidateStableVersion` line, syncs `package.json`, `web/worker/package.json` and the Expo identities, regenerates every derived surface and lists hand-written lines that still name the old version.
2. Review the diff, commit, and open the bump PR into `development` yourself. No workflow opens it: GitHub Actions may not create pull requests here, and one opened with `GITHUB_TOKEN` would not start the required checks.
3. `pnpm release:prepare <version>` sets an exact version instead, for a deliberate override such as leaving the prerelease line.
4. Publication, `v*` tags and dist-tag moves stay owner-gated; see `docs/release.md`.
