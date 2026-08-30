---
title: Web
description: BeeUI's Web support boundary — browser engine, bundlers, and the independent consumer proof.
---

Full detail lives in `docs/web-support-contract.md` in the repository
([#136](https://github.com/beobungbu/BeeUI/issues/136)); this page is the published
summary. It mirrors the rigor `docs/native-verification.md` established for the
[Native contract](/compatibility/native/).

## Two independently wired Web paths

1. **Expo's Metro Web export** (`apps/showcase`, `expo export --platform web`) — the Web
   build BeeUI itself ships and dogfoods. Proved by `ci.yml`'s Web export job plus
   `web-a11y.yml`/`visual-web.yml`'s real-Chromium Playwright runs against that export.
2. **An independent Vite consumer** (`scripts/verify-web-consumer.sh`, wired into
   `web-consumer.yml`) — a non-Showcase, non-monorepo-fallback app. It packs
   `@beeui/core`/`@beeui/tokens`/`@beeui/ui` with `pnpm pack`, scaffolds a fresh Vite +
   `react-native-web` app with no Expo and no workspace symlinks, installs the tarballs
   plus the exact pinned runtime versions from the [compatibility matrix](/compatibility/)
   (`react-native-web@0.21.0`, `react@19.2.3`, `tailwindcss@4.3.3`, `uniwind@1.10.1`),
   wires `vite-plugin-rnw` + `uniwind/vite` + `@tailwindcss/vite`, and renders a fixture
   through `BeeUIProvider` covering `Input`/`Checkbox`, `Dialog`, `Select`, `Tooltip`,
   `Sheet`, `Calendar`, and `Table`.

Both matter: the Showcase proves the Web path BeeUI ships; the independent Vite consumer
proves the package boundary and the Web promise reproduce **outside** this monorepo — the
same bar `scripts/verify-bare-consumer.sh` sets for the [native contract](/compatibility/native/).

## What this proves

- The exact candidate source packs, installs, and resolves through the real package
  boundary into an application this monorepo did not generate.
- `BeeUIProvider` + Uniwind's theme CSS render correctly under a second, independently
  configured bundler (Vite), not only Metro.
- Forms, overlays, `Select`, `Tooltip`, `Sheet`, `Table`, and `Calendar` are interactive
  and keyboard-operable in a real, pinned Chromium instance (Playwright) against a
  production build (`vite build`).
- No `serious`/`critical` axe-core (`@axe-core/playwright`, `wcag2a`/`wcag2aa`/
  `wcag21a`/`wcag21aa`) violation exists in that rendered, interacted-with state.

:::caution[Chromium only]
`visual-web.yml`, `web-a11y.yml`, and `web-consumer.yml` all install **Chromium only** via
Playwright. Firefox and Safari/WebKit are never installed or exercised anywhere in this
repository — BeeUI makes **no claim, implicit or explicit**, about non-Chromium rendering
or interaction correctness.
:::

## What this does not prove

- **Non-Chromium browsers.** See the caution above.
- **Bundlers other than Expo/Metro and Vite.** Next.js, Webpack, Parcel, or any other
  bundler are unverified and unsupported claims.
- **Server-side rendering (SSR) / static site generation.** Both proved paths are
  client-rendered SPAs.
- **Full WCAG conformance.** Automated axe-core coverage catches automatable rule
  violations, not every WCAG success criterion — see `docs/web-accessibility-audit.md`'s
  "Known limitations".
- **Long-term stability of `vite-plugin-rnw`.** It is a pre-1.0 (`0.0.x`) third-party
  package, pinned exactly as the tested RN→RNW aliasing mechanism under Vite, not an
  aspirational range.

## CI wiring

`.github/workflows/web-consumer.yml` runs `scripts/verify-web-consumer.sh all` on every
pull request and on push to `main`, reusing the same pinned Chromium cache
`visual-web.yml`/`web-a11y.yml` provision, and uploads the consumer's `dist/` build
output as a build artifact for the exact head under review.

Run it locally:

```sh
./scripts/verify-web-consumer.sh all
```
