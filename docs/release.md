# BeeUI release contract

This document defines BeeUI release-candidate evidence and the publication contract. BeeUI 1.0 is a product milestone; the stable npm package line for this milestone is `0.86.2` (ADR-015).

## Current distribution model

BeeUI's newest published release candidate is **`0.86.2-rc.2`**, published under the opt-in npm **`next`** dist-tag. The repository is prepared at candidate **`0.86.2-rc.3`**, which is not published until the owner approves its staged packages. The lockstep release group is:

- `@beemvp/beeui-core`
- `@beemvp/beeui-tokens`
- `@beemvp/beeui-ui`
- `@beemvp/beeui-cli`

Observed registry state on 2026-09-23:

- `next` → `0.86.2-rc.2` for all four packages;
- `latest` → `0.86.2-rc.1` for all four packages;
- stable `0.86.2` is not yet published/promoted.

Use the explicit prerelease channel:

```bash
npm install @beemvp/beeui-ui@next @beemvp/beeui-core@next @beemvp/beeui-tokens@next
npx @beemvp/beeui-cli@next --help
```

During the `0.86.2` prerelease line `latest` follows the newest complete, verified RC once the owner moves it for all four packages (owner decision 2026-09-24, issue #561); the observation above is the last recorded state.

`docs/dist-tag-policy.md` is the machine-checked channel/publication authority. `docs/rc-candidate.md` contains the exact current candidate, publication lineage and observed registry metadata.

## Provenance model

Do not collapse release provenance into one SHA. A release may have distinct identities:

1. **candidate source SHA** — the frozen source tree whose package/runtime contents were reviewed;
2. **release-prep branch SHA** — version/evidence preparation around that candidate;
3. **development integration SHA** — reviewed integration into `development`;
4. **main promotion SHA** — the exact repository state promoted for publication;
5. **workflow `GITHUB_SHA`** — the exact checkout used by the npm release workflow;
6. **published artifact identity** — registry `dist.integrity`, `dist.shasum` and other package metadata.

Artifact integrity proves bytes. It does not by itself prove which Git commit produced those bytes. The Git lineage and workflow identity provide that separate evidence.

### Historical rc.1 bootstrap

`0.86.2-rc.1` was the one-time bootstrap release:

- candidate source SHA: `58d038dfd63267a0760b6eb1b5749e96939edb28`;
- publish workflow SHA: `ddf415b0d665c14e1b154bb02570a906585b4b98`;
- workflow run: `34294238899`, job `bootstrap-rc`.

The temporary bootstrap token was a first-publication exception, not the steady-state mechanism.

### rc.2 publication

`0.86.2-rc.2` used the protected staged path:

- candidate source SHA: `a58d8b83977f364bb141351f86b61e8b477602bd`;
- release-prep head: `3a5b30d85d3b43d707c2d0171a2a672e1541614c`;
- development integration SHA: `292b0a7bc773d76a03c3e86fe44ba64c65f84531`;
- main promotion and workflow SHA: `cd07c671a0814cdcf8a9809fa1c414276acf5bdc`;
- workflow run: `35846285677`, operation `stage-rc`;
- transport: npm Trusted Publishing/OIDC + staged publishing + provenance;
- npm-side owner approval made the staged packages public.

The protected GitHub Environment approval and npm staged-package approval are separate controls.

## Consumption and verification modes

BeeUI has three supported evidence/consumption paths:

1. **Public package consumption** from npm through `next` for the current RC.
2. **Packed local tarballs** for exact-source verification and clean-consumer CI before publication.
3. **Source ownership** through `@beemvp/beeui-cli`, which copies governed component source into a consumer repository.

Workspace linking is a monorepo development mechanism and must not be used as proof that the public package boundary works.

## Versioning policy

All four public packages use one lockstep version.

- prereleases follow `0.86.2-rc.N`;
- stable is `0.86.2`;
- package versions must not drift;
- intentional breaking changes require changelog/migration notes;
- packed manifests must not expose unresolved `workspace:*` ranges;
- BeeUI 1.0 is not npm version `1.0.0`.

## Canonical release artifact rule

`pnpm release:verify` builds and verifies the release package set and records canonical tarballs under `.artifacts/release-packages`.

The release workflow must stage/publish those exact verified tarballs. A later step must not independently rebuild or repack a second artifact and call it equivalent.

Canonical artifact verification includes:

- package names and lockstep versions;
- public metadata and exports;
- packed file inventory;
- workspace dependency rewriting;
- deterministic/canonical tarball output;
- clean consumer installation;
- CLI execution from the packed artifact;
- absence of unintended Expo runtime coupling at the package boundary.

## Automated release gates

CI may claim only what its jobs prove.

| Gate | Command/job | Evidence |
| --- | --- | --- |
| frozen dependency graph | `pnpm install --frozen-lockfile` | successful install |
| TypeScript contract | workspace typecheck gates | compile/type evidence |
| behavioral contracts | workspace test gates | Jest/RNTL/registry tests |
| package/release contract | `pnpm release:verify` | canonical tarballs + clean-consumer verification |
| docs/public-surface truth | docs/release policy gates | generated/public docs ownership + policy checks |
| Expo consumer | Expo consumer workflow | Web/Android/iOS export and scoped native evidence |
| bare RN consumer | bare consumer workflow | package install, Metro/native compile evidence |
| deterministic Web visual/browser QA | `visual-web` | screenshots + browser integration tests |
| required iOS compile | `ios-native` | CocoaPods + `xcodebuild` |
| runtime smoke | native runtime workflows | Simulator/Emulator interaction evidence when actually run |

Native compilation is not native interaction proof. Browser QA is not native runtime proof. A skipped runtime workflow is not a pass.

## Public registry verification

A successful `npm stage publish` proves staging, not public publication. After npm-side approval, observe the real registry state.

For every package record or verify:

- exact public version;
- intended dist-tag target;
- full `dist.integrity`;
- `dist.shasum`;
- `dist.unpackedSize`;
- repository metadata;
- clean registry install rather than a workspace link;
- CLI execution for `@beemvp/beeui-cli`;
- dependency resolution across the lockstep set.

If only part of a release group is public, record **`partial-publication`**. Do not call the release complete until all four package versions exist and the intended dist-tags agree.

The exact observed metadata for the current RC is retained in `docs/rc-candidate.md`.

## Trusted Publishing and secrets

Steady state after the rc.1 bootstrap is npm Trusted Publishing/OIDC through `.github/workflows/npm-release.yml` and the protected GitHub `release` environment.

`NPM_BOOTSTRAP_TOKEN` is historical bootstrap/rollback-only authority if it is retained at all. It is not the normal credential for rc.2 or later staged publication and must not be described as required for the OIDC path.

The current staged flow is:

1. exact release state reaches `main`;
2. owner dispatches the approved operation;
3. protected GitHub Environment approval allows the mutation job to proceed;
4. OIDC stages canonical packages with provenance;
5. owner performs npm-side staged-package approval/proof-of-presence;
6. registry state is observed and recorded;
7. after the complete four-package set is public and verified, the owner moves `latest` for all four packages to that RC with npm 2FA (never from CI), then observes and records the four `latest` tags.

## Runtime and device gates

Compile-only CI and browser QA cannot prove real native interaction.

| Gate | Required environment | Record |
| --- | --- | --- |
| iOS `pageSheet` / `formSheet` presentation and swipe request-close | iOS Simulator/device | exact SHA, OS/device, steps, media/logs, result |
| non-zero safe-area behavior | iOS/Android Simulator/device | device + orientation + result |
| VoiceOver behavior | iOS | representative flows + result |
| TalkBack behavior | Android | representative flows + result |
| focus/keyboard interaction | supported runtime | flow + result |
| Android hardware-back interaction | Android Emulator/device | exact overlay/Dialog flow + result |
| representative native visuals | supported form factors | screenshots/review note |
| RTL / large-text stress | supported runtime | scenario + result |

Runtime-sensitive evidence is classified as exact-head automated, exact-head simulator/device, deterministic-only, or prior-head supporting evidence. Never upgrade one evidence class into another in release notes.

The iOS `pageSheet` / `formSheet` presentation surface remains **EXPERIMENTAL** until the native evidence contract explicitly promotes it.

## Release candidate checklist

A new RC may be staged only when:

1. the version is fresh and lockstep across all four packages;
2. exact-head required release gates are green;
3. `pnpm release:verify` produces canonical reproducible artifacts;
4. docs/public-surface policy checks are green;
5. changelog/migration/support documentation is current;
6. runtime/device limitations are stated honestly;
7. source, integration, promotion and workflow identities are recorded separately;
8. protected release authorization is obtained;
9. registry mutation uses the approved operation and tag;
10. the real public registry package set is verified after npm-side approval;
11. only then does the owner move `latest` for all four packages to the RC and record the observed tags (`docs/dist-tag-policy.md`).

## Stable promotion checklist

Stable `0.86.2` is a separate release event. A successful RC does not imply stable promotion.

Stable requires:

1. exact stable source candidate on `main`;
2. lockstep `0.86.2` across all four packages;
3. fresh release/docs/runtime/visual evidence as required;
4. staged publication under the safe channel;
5. npm-side approval and verification of the complete real registry set;
6. only then, coordinated owner-controlled promotion of `latest`;
7. final verification that all four `latest` tags resolve to `0.86.2`.

## Cross-platform evidence commands

Evidence instructions must work on both GNU/Linux and BSD/macOS. Prefer portable extraction/temporary-directory patterns and avoid documentation that depends on GNU-only `readlink -f`, `sed -i`, or equivalent behavior without a portable alternative.

For tarball manifest inspection, use streaming extraction rather than a GNU-specific temporary-path recipe, for example:

```bash
tar -xOzf package.tgz package/package.json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).version))'
```

## Source of truth

- channel/version/publication policy: `docs/dist-tag-policy.md`
- immutable candidate + registry evidence: `docs/rc-candidate.md`
- release process/evidence: this file
- native compile/runtime evidence: `docs/native-verification.md`, `docs/native-runtime-smoke.md`
- compatibility: `docs/compatibility-matrix.md`
- changelog: `CHANGELOG.md`
- package manifests/exports: package source itself

Future readiness work belongs in `docs/roadmap.md`; do not describe future work as shipped or shipped evidence as a future manual gate.
