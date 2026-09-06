# Changesets

Every change to the public surface carries a changeset: `pnpm changeset`, pick the packages, pick the bump, describe what a consumer must do. The four public packages are a `fixed` group, so one bump moves all of them — `docs/release.md` requires lockstep versions and this is where that is enforced.

`pnpm docs:surface:diff` compares `docs/public-surface.inventory.json` at HEAD against the base branch. A removed or de-published row is breaking and needs a `minor` or `major` changeset; an added row needs any changeset. The diff decides, not memory.
