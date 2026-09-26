---
title: Migration & versioning
description: Understand BeeUI's public RC channel, version authority, and the migration rules that will govern later upgrades.
releaseStatus: true
---

The first public release candidate was `0.86.2-rc.1`. During the `0.86.2` prerelease line **`latest`** follows the newest complete, verified RC only after the owner moves it for all four packages, so it can lag `next`, and it moves to the stable version at the `0.86.2` stable promotion; the last observed `latest` target is recorded in [`docs/dist-tag-policy.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/dist-tag-policy.md).

`0.86.2-rc.1` was the first public package release and `0.86.2-rc.2` was the second — see the release status above for the current RC. Consumers who installed the RC channel now have a real upgrade to make — see [Upgrading from 0.86.2-rc.1](#upgrading-from-0862-rc1-to-0862-rc2) below. The migration work described in the rest of this page (moving repository/internal consumers onto the public package boundary) is a separate, one-time move.

Canonical source: https://github.com/beobungbu/BeeUI/blob/main/docs/dist-tag-policy.md

**Prerequisites:** know which BeeUI packages and versions your app currently installs
(`npm ls @beemvp/beeui-ui @beemvp/beeui-core @beemvp/beeui-tokens @beemvp/beeui-cli`).

## Which channel am I on?

| Channel | Exists today | What it means |
| --- | --- | --- |
| **Prerelease (`next`)** | Yes | Public opt-in release-candidate channel; tracks the newest published RC (see the release status above for the currently observed version and timestamp). |
| **Default (`latest`)** | Yes | Last observed target recorded in `docs/dist-tag-policy.md`. During the `0.86.2` prerelease line it follows the newest complete, verified RC only after the owner moves it for all four packages, so it lags `next` in between. At the `0.86.2` stable promotion it moves to the stable version and never returns to a prerelease after that. |
| **Repository source** | Yes | Development/evaluation path for exact commits and unpublished work. |

Install the current RC explicitly:

```bash
npm install @beemvp/beeui-ui@next @beemvp/beeui-core@next @beemvp/beeui-tokens@next
npx @beemvp/beeui-cli@next --help
```

Pin the exact version from `CHANGELOG.md` instead of `@next` when reproducibility matters more than following the newest RC — see the release status above for today's exact version.

## Version authority

- `@beemvp/beeui-core`, `@beemvp/beeui-tokens`, `@beemvp/beeui-ui`, and `@beemvp/beeui-cli` release in lockstep.
- The root workspace manifest carries the candidate version.
- `docs/dist-tag-policy.md` is the machine-checked authority for public channel state.
- Package exports and generated references are the authority for public API shape.
- Publication requires the protected GitHub `release` environment and the approved npm release workflow.

## Moving from repository/internal consumption to the public RC

Replace monorepo-relative imports, workspace links, or manually packed release artifacts with the public scoped packages.

Before:

```text
workspace link / local tarball / monorepo-relative package path
```

After:

```bash
npm install @beemvp/beeui-ui@next @beemvp/beeui-core@next @beemvp/beeui-tokens@next
```

Application imports stay on the public package surface:

```ts
import { BeeUIProvider, Button } from '@beemvp/beeui-ui';
```

For source ownership, use the published CLI rather than a repository-local shim:

```bash
npx @beemvp/beeui-cli@next add button
```

## Stability terminology

| Status | Promise | Removal path |
| --- | --- | --- |
| **stable** | Part of the governed public contract. | Deprecate first; remove only through an appropriate major-version path after the compatibility window. |
| **experimental** | Publicly available but not yet covered by the full stability promise. | May change with lighter notice until promoted. |
| **deprecated** | Still available for compatibility while consumers migrate. | Remove only after the documented replacement/window requirements are met. |

Authoring aliases and deprecated compatibility aliases are distinct concepts and must not be conflated in token/API metadata.

## Semver policy for future releases

BeeUI applies semver to its inventoried public surface: package exports/subpaths, typed component contracts, CLI commands and exit-code behavior, governed public tokens, and Registry/config schemas.

| Level | Examples |
| --- | --- |
| **Major** | Removing/renaming a public export; incompatible prop change; removing a CLI command/flag; removing a stable token after its window; incompatible schema change. |
| **Minor** | Adding a component, optional prop, CLI command/flag or token; widening a peer range after verification; promoting an experimental surface to stable. |
| **Patch** | Backward-compatible fixes, docs corrections, packaging fixes that do not change the public contract. |

Prerelease identifiers (`-rc.N`) are opt-in test releases published under `next`. Every `latest` move is owner-authorized: during the `0.86.2` prerelease line the owner moves `latest` to the newest complete, verified RC for all four packages, and once `latest` has moved to the stable `0.86.2` it never returns to a prerelease — see [`docs/dist-tag-policy.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/dist-tag-policy.md).

## Upgrading from 0.86.2-rc.1 to 0.86.2-rc.2

Four changes need action if your app already installed `0.86.2-rc.1` (added to this page after `0.86.2-rc.2` publication, from rc.2 consumer verification findings — see `CHANGELOG.md`'s `[0.86.2-rc.2]` entry for the same list):

1. **`Sheet` native root wiring changed and is now required.** `0.86.2-rc.1`'s guidance was `GestureHandlerRootView` > `BottomSheetModalProvider` > `BeeUIProvider`. On `0.86.2-rc.2`, mount BeeUI's public `SheetProvider` directly below `BeeUIProvider` instead — `BeeUIProvider` > `SheetProvider` > your app — and remove the outer `BottomSheetModalProvider`. `SheetProvider` installs `GestureHandlerRootView` and gorhom's `BottomSheetModalProvider` itself, and deliberately does not reuse an already-present outer one. See [Expo: Sheet on native](/docs/start/expo/#sheet-on-native) or [Bare React Native: Sheet on native](/docs/start/bare-react-native/#sheet-on-native).
2. **Context bridging for Sheet content.** `SheetContent` only sees React contexts mounted above `SheetProvider`. Keep app-wide providers (a query client, i18n, navigation, your own app stores) above `SheetProvider`; a screen-scoped provider that a Sheet's content still needs to read must be passed through `SheetContent`'s `bridgeContexts` prop instead.
3. **`Calendar` day cells are now `role="gridcell"` on Web** (previously `"cell"`). If your Web tests select a calendar day cell by role, change `getByRole('cell')` to `getByRole('gridcell')`. Native `Calendar` cells are unchanged.
4. **Workarounds you can drop:**
   - A per-table row density `className`/style override → `Table density="dense48"`.
   - A wrapping pressable added around a row for navigation → `TableRow onPress`.
   - A hand-built closable tab strip → `TabsList scrollable` with `TabsTrigger closable`, `onClose`, and `closeAccessibilityLabel`.
   - A hover wrapper placed around `DropdownMenuTrigger` for a Web hover affordance → the trigger now carries its own hover styling.
   - Splitting a long `Button` label across two `Text` nodes to avoid clipping at large text sizes → a long label now wraps onto a second line and the button grows to fit it.

## What to check before upgrading between RCs

1. Read `CHANGELOG.md` for the target RC.
2. Check `docs/compatibility-matrix.md` for peer/toolchain changes.
3. Check migration notes for any intentional public-surface change.
4. Upgrade all BeeUI packages together; do not mix RC numbers inside one application.
5. Typecheck and build/export every platform you ship.
6. Re-run source-ownership `diff` before `update` if you own BeeUI source locally.

## Stable promotion

Stable `0.86.2` will be a separate release event. A successful RC does not authorize or imply stable `latest` promotion. The stable package set must be published/verified according to `docs/dist-tag-policy.md` before the owner moves `latest` in a coordinated operation.

For exact current status, follow `docs/dist-tag-policy.md`; do not copy an old prose statement about publication state into new documentation.
