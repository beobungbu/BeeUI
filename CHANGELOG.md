# Changelog

All notable consumer-facing changes to BeeUI are recorded here.

## Unreleased

No unreleased consumer-facing changes are recorded after the first public release candidate yet.

## [0.86.2-rc.1] — 2026-09-09

First public BeeUI release candidate. Published from exact source SHA
`ddf415b0d665c14e1b154bb02570a906585b4b98` through the protected `npm-release` workflow.

### Distribution

- Published `@beemvp/beeui-core`, `@beemvp/beeui-tokens`, `@beemvp/beeui-ui`, and `@beemvp/beeui-cli` in lockstep at `0.86.2-rc.1`.
- Published the RC under npm dist-tag **`next`** with provenance. Stable **`latest`** is intentionally not promoted to this prerelease.
- Public RC install path:

  ```bash
  npm install @beemvp/beeui-ui@next @beemvp/beeui-core@next @beemvp/beeui-tokens@next
  npx @beemvp/beeui-cli@next --help
  ```

- Release artifacts are canonicalized and reproducibility-checked before registry mutation; the release workflow publishes the same verified tarballs rather than rebuilding a second artifact.
- Clean-consumer verification covers package installation, public exports/subpaths, the CLI binary, Expo package consumption, bare React Native consumption, and Web consumption.

### Added

- Production-oriented React Native UI package surface for Expo, bare React Native and Web.
- `@beemvp/beeui-core` engine-neutral utilities and overlay/runtime contracts.
- `@beemvp/beeui-tokens` semantic Theme Tokens v3, responsive/density/motion/typography contracts, generated CSS and token lifecycle metadata.
- `@beemvp/beeui-ui` component package with barrel and granular component subpath exports, dual ESM/CJS output and TypeScript declarations.
- `@beemvp/beeui-cli` source-ownership Registry CLI with `init`, `list`, `add`, `doctor`/`verify`, `diff`, and `update` workflows.
- 37 production-oriented Pattern Gallery screens across authentication/onboarding, dashboard/finance, commerce/social and account/settings domains.
- Production `Select`, provider-scoped Toast, Popover, DropdownMenu, Sheet, Tooltip, Table/DataTable, Calendar, DatePicker and DateTimePicker surfaces alongside the broader component set.
- AI-native discovery surfaces through the `llms.txt` family and agent documentation.
- Maintained Showcase, routed demo application, Expo package consumer, bare React Native consumer and Vite/React Native Web consumer.
- Deterministic Chromium visual/browser QA, accessibility contracts, responsive contracts, benchmark harnesses and native compile/runtime evidence lanes.

### Changed

- The public package format uses built `dist/` output (ESM + CJS + `.d.ts`) while retaining governed source needed by source ownership and styling discovery.
- Package exports define public root and granular subpath boundaries rather than relying on monorepo-relative deep imports.
- Web theme import is `@import '@beemvp/beeui-tokens/theme.css'`.
- Peer ranges are frozen to the tested compatibility line documented in `docs/compatibility-matrix.md`, including React 19 and React Native 0.86.x.
- Release tooling now creates deterministic canonical publish artifacts and prevents duplicate independent repacking after verification.
- CI release-only classification avoids unnecessary native work while retaining fail-closed native verification when classifier/native-sensitive inputs change.

### Fixed

- Removed generated Babel `.d.js` / `.d.js.map` declaration junk from published UI tarballs.
- Fixed release reproducibility drift caused by nondeterministic packed publish-manifest serialization by canonicalizing the safe manifest regions while preserving order-sensitive export conditions.
- Fixed web-delivery gate handling for duplicate check names so a valid successful check is not overwritten by a skipped duplicate.

### Compatibility

The current tested line is documented in `docs/compatibility-matrix.md`. Key release-candidate points include:

- React `>=19 <20`;
- React Native `>=0.86.0 <0.87.0`;
- Tailwind CSS `>=4 <5`;
- Uniwind `>=1.10.1 <2`;
- Expo SDK 57 in the maintained Expo consumer;
- React Native Web 0.21.x in the maintained Web consumer.

Exact tested pins and optional native peer requirements remain machine-checked in the compatibility docs.

### Known limitations

- Native iOS `pageSheet` / `formSheet` presentation remains **EXPERIMENTAL** until the required exact-head runtime evidence promotes it; deterministic contracts/native compilation do not by themselves prove live presentation or swipe behavior.
- Current Web support/evidence is centered on the maintained Vite + React Native Web stack and Chromium browser QA. Do not infer unsupported bundlers, SSR/SSG, Firefox or WebKit coverage from that evidence.
- `0.86.2-rc.1` is a prerelease. Consumers must opt into `next` or pin the exact RC version; stable `latest` is a separate future promotion event.

### Migration notes

This is the first public BeeUI package release, so there is no older public npm version to migrate from. Repository/internal consumers should replace monorepo-relative package access with the documented public package exports and use `@next` while evaluating this RC.

For detailed contracts and evidence, see:

- `docs/dist-tag-policy.md`
- `docs/release.md`
- `docs/compatibility-matrix.md`
- `docs/migration-guide.md`
- `docs/semver-audit.md`
- `docs/registry-cli.md`
- `docs/native-verification.md`
- `docs/native-runtime-smoke.md`

Pre-publication development history remains available in Git history, merged pull requests, issues, changesets and the release-readiness documents that led to this RC.
