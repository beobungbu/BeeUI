---
title: Showcase & native preview
description: Inspect the real BeeUI Web runtime and run the same Showcase on iOS or Android.
---

# Showcase & native preview

The public **[BeeUI Showcase](/showcase/)** is the same Expo application used by repository
Web/native verification. It is not a docs mock and the docs do not bundle a second React
Native runtime. Component pages deep-link with `?component=<registry-family>`; pattern pages
deep-link with the canonical source identity and the public router resolves it against the
real Pattern Catalog.

## Public Web surface

- **[Component Gallery](/showcase/?section=components)** — interactive public component system.
- **[Pattern Gallery](/showcase/?section=patterns)** — production screen patterns and demo states.
- Generated component/pattern pages use `embed=1` so the same runtime can sit inside docs without duplicate global chrome.
- The public export is hosted under `/showcase/`; Expo's `experiments.baseUrl` is enabled only for this launch build, so existing root-hosted CI/visual exports keep their current contract.

From a BeeUI checkout:

```bash
pnpm --filter @beemvp/beeui-showcase build:web:public
```

This stamps the current Git SHA and writes the subpath-ready static build to
`apps/showcase/dist-public-web/`. The ordinary `build:web` remains the root-hosted CI/export
path.

## Native preview

Run the **same source tree** rather than treating the Web Showcase as native proof:

```bash
# Expo dev server / QR
pnpm --filter @beemvp/beeui-showcase start

# Native local builds
pnpm --filter @beemvp/beeui-showcase ios
pnpm --filter @beemvp/beeui-showcase android

# Bundle-only evidence (not device runtime)
pnpm --filter @beemvp/beeui-showcase bundle:ios
pnpm --filter @beemvp/beeui-showcase bundle:android
```

`start` can load the bundle on a compatible Expo development path; `ios`/`android` invoke
native local builds. Bundle/export/compile evidence proves packaging and resolution, **not**
keyboard, safe area, hardware Back, VoiceOver/TalkBack or visual runtime behavior. Those
claims require the repository's explicit native runtime/device evidence classes.

## Build identity and status

The Showcase application version is aligned to the current BeeUI workspace release label,
and the launch Web export injects `git rev-parse --short HEAD`. The runtime still states
that BeeUI packages/CLI are unpublished; a public Showcase URL does not imply npm
publication.

## Public navigation

Outside embedded mode, Showcase includes lightweight navigation back to BeeUI Docs, Demo
and the landing page. Native keeps its router-free application architecture; opening a
public-site destination uses the system browser rather than introducing a navigation
framework into BeeUI.
