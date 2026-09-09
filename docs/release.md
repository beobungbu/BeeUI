# BeeUI release contract

This document defines BeeUI release-candidate evidence and separates automated package/compile proof from runtime/device proof. The BeeUI 1.0 product milestone ships on the stable package line `0.86.2` (ADR-015).

## Current distribution model

BeeUI's first public release candidate, **`0.86.2-rc.1`**, is published on npm under the opt-in **`next`** dist-tag. The public lockstep package set is:

- `@beemvp/beeui-core`
- `@beemvp/beeui-tokens`
- `@beemvp/beeui-ui`
- `@beemvp/beeui-cli`

The bootstrap release was produced from exact source SHA
`ddf415b0d665c14e1b154bb02570a906585b4b98` through `.github/workflows/npm-release.yml`. The protected release workflow verified canonical reproducible tarballs before publishing sequentially with provenance.

The stable **`latest`** channel is intentionally not promoted to this RC. Public consumer examples must therefore use `@next` or pin `@0.86.2-rc.1` until stable `0.86.2` has completed its own verification and promotion flow.

```bash
npm install @beemvp/beeui-ui@next @beemvp/beeui-core@next @beemvp/beeui-tokens@next
npx @beemvp/beeui-cli@next --help
```

`docs/dist-tag-policy.md` is the machine-checked authority for channel and publication state.

## Consumption and verification modes

BeeUI now has three supported evidence/consumption paths:

1. **Public package consumption** from npm through the `next` RC channel.
2. **Packed local tarballs** for exact-source verification, clean-consumer CI and testing commits that are not published.
3. **Source ownership** through `@beemvp/beeui-cli`, which copies governed component source into a consumer repository.

Workspace linking remains a monorepo development mechanism and must not be used as proof that the public package boundary works.

## Versioning policy

All four public packages use one lockstep version matching the workspace root.

- prereleases follow `0.86.2-rc.N`;
- the stable version for this product milestone is `0.86.2`;
- package versions must not drift;
- intentional breaking changes require changelog/migration notes;
- packed manifests must not expose unresolved `workspace:*` ranges;
- BeeUI 1.0 is a product milestone name, not npm version `1.0.0`.

## Canonical release artifact rule

`pnpm release:verify` builds and verifies the release package set and records canonical release tarballs under `.artifacts/release-packages`.

The release workflow must publish those exact verified tarballs. A later step must not independently rebuild or repack a second artifact and call it equivalent.

Canonical artifact verification includes:

- package names and lockstep versions;
- public metadata and package exports;
- packed file inventory;
- workspace dependency rewriting;
- deterministic/canonical tarball output;
- clean consumer installation;
- CLI execution from the packed artifact;
- absence of unintended Expo runtime coupling in the package boundary.

## Automated release gates

CI may claim only what its jobs actually prove.

| Gate | Command/job | Environment | Evidence | Blocking |
| --- | --- | --- | --- | --- |
| frozen dependency graph | `pnpm install --frozen-lockfile` | Linux/macOS | successful install | yes |
| TypeScript contract | `pnpm typecheck` | Linux | CI step | yes |
| behavioral contracts | `pnpm test` | Linux | Jest / RNTL / Registry tests | yes |
| package/release contract | `pnpm release:verify` | Linux | canonical tarballs + release verification report | yes |
| docs/public-surface truth | docs/release policy gates | Linux | generated/public docs ownership + policy checks | yes |
| Expo Web/Android/iOS exports | Expo consumer workflow | Linux | Expo export | yes |
| bare RN package install | bare consumer workflow | Linux | public-shape packed packages in fresh RN app | yes |
| bare Android + iOS Metro | bare consumer workflow | Linux | production bundles | yes |
| bare Android native compile | native CI | Linux | APK/native build | yes |
| deterministic Web visual/browser QA | `visual-web` | Linux | canonical pixels + integration tests | yes |
| Expo Showcase iOS compile | `ios-native` | macOS ARM64 | CocoaPods + `xcodebuild` | on main / when scheduled |
| bare RN iOS compile | `ios-native` | macOS ARM64 | fresh consumer + CocoaPods + `xcodebuild` | on main / when scheduled |
| real iOS runtime smoke | `native-runtime-smoke / ios-runtime` | booted Simulator | exact-head Maestro/native evidence | scheduled/manual |
| real Android runtime smoke | `native-runtime-smoke / android-runtime` | Emulator | exact-head Maestro/ADB evidence | scheduled/manual |

Native compilation is not native interaction proof. Browser QA is not native runtime proof.

## Public registry verification

After any registry mutation, release evidence must verify the real registry state rather than infer success from a publish command alone.

For each package, record or verify:

- exact public version;
- intended dist-tag;
- registry integrity/provenance metadata where available;
- repository metadata;
- clean install from the registry rather than a workspace link;
- CLI execution for `@beemvp/beeui-cli`;
- dependency resolution across the full lockstep package set.

For the current RC, the intended consumer channel is `next`. `latest` must remain reserved for an approved stable release.

## Trusted Publisher transition

The first RC used the bootstrap path because npm requires an existing package before Trusted Publisher configuration can be attached.

After the bootstrap:

1. configure Trusted Publisher for all four packages against repository `beobungbu/BeeUI`, workflow `.github/workflows/npm-release.yml`, environment `release`;
2. verify the intended stage-publish permissions;
3. revoke the temporary bootstrap npm token;
4. delete `NPM_BOOTSTRAP_TOKEN` from the GitHub `release` environment;
5. use the OIDC/staged flow for subsequent RC/stable uploads according to `docs/dist-tag-policy.md`.

Do not retain a broad long-lived npm write token as the steady-state release mechanism.

## Runtime and device gates

Compile-only CI and browser QA cannot prove real native interaction.

| Gate | Required environment | Record |
| --- | --- | --- |
| iOS `pageSheet` / `formSheet` actual presentation and swipe request-close | iOS Simulator/device | exact SHA, OS/device, steps, media/logs, result |
| non-zero safe-area behavior | iOS/Android Simulator/device | device + orientation + result |
| VoiceOver behavior | iOS | representative flows + result |
| TalkBack behavior | Android | representative flows + result |
| focus/keyboard interaction | supported runtime | flow + result |
| Android hardware-back interaction | Android Emulator/device | exact overlay/Dialog flow + result |
| representative native visuals | supported form factors | screenshots/review note |
| RTL / large-text stress | supported runtime | scenario + result |

The runtime smoke workflow automates a representative subset of these rows. VoiceOver, TalkBack, physical-device behavior and any unexecuted stress case remain separate evidence unless explicitly run and recorded.

## Evidence classification

Runtime-sensitive release evidence is classified as one of:

- **exact-head automated** — CI/test output tied to the current head;
- **exact-head simulator/device** — runtime interaction performed on the exact head;
- **deterministic-only** — source/Jest/browser contract that intentionally does not claim native interaction;
- **prior-head supporting evidence** — useful history, never represented as exact-current proof.

Release notes must not convert compile/deterministic proof into a claim that safe areas, focus, keyboard, accessibility services, native sheets, hardware-back runtime behavior or native visuals passed.

See `docs/native-runtime-smoke.md` and `docs/native-verification.md` for the detailed native evidence contract.

## iOS `pageSheet` / `formSheet` policy

Native `pageSheet` / `formSheet` presentation remains **EXPERIMENTAL** until release-quality exact-head runtime evidence promotes it. Deterministic tests and native compilation prove implementation/build contracts but not actual presentation, placement or swipe behavior.

The current headless-CI quarantine described by #62 remains a quarantine, not a pass. Do not claim support from a skipped runtime section. `overFullScreen` is unaffected by this limitation.

## Release candidate checklist

A new release candidate may be published only when:

1. the version is fresh and lockstep across all four packages;
2. exact-head automated release gates are green;
3. `pnpm release:verify` produces canonical reproducible artifacts;
4. docs/public-surface policy checks are green;
5. deterministic visual/browser QA is green;
6. changelog and migration notes reflect consumer-visible/breaking changes;
7. required runtime/device evidence is recorded or limitations are stated explicitly;
8. the protected `release` environment receives owner authorization;
9. registry mutation uses the approved workflow and intended dist-tag;
10. the public registry package set is verified after publication.

## Stable promotion checklist

Stable `0.86.2` is a separate release event. Do not equate a successful RC with stable promotion.

Stable requires:

1. exact stable source candidate on `main`;
2. stable package version `0.86.2` across all four packages;
3. fresh release/docs/runtime/visual evidence;
4. stable package publication/staging according to `docs/dist-tag-policy.md`;
5. clean verification of all four real registry packages;
6. only then, coordinated owner-controlled promotion of `latest`;
7. final verification that all four `latest` tags resolve to the same stable version.

## Changelog convention

`CHANGELOG.md` keeps an `Unreleased` section. Entries describe user-visible behavior, dependency/compatibility changes, distribution behavior, release infrastructure affecting consumers and migrations. Pure internal refactors without consumer impact need no entry.

## Source of truth

- channel/version/publication policy: `docs/dist-tag-policy.md`
- release process/evidence: this file
- native compile/runtime evidence: `docs/native-verification.md`, `docs/native-runtime-smoke.md`
- compatibility: `docs/compatibility-matrix.md`
- changelog: `CHANGELOG.md`
- package manifests/exports: package source itself

Future readiness work belongs in `docs/roadmap.md`; do not describe future work as shipped or shipped evidence as a future manual gate.
