# Web support contract (#136)

BeeUI's automated Web verification proves package/source consumption, theme CSS, the
provider, forms, overlays, `Select`/`Tooltip`, `Sheet`, `Table`, `Calendar`/date controls,
keyboard interaction, automated accessibility, and a production build — on the exact
bundlers/browser this repository actually exercises. This document defines exactly what
that evidence proves and states the boundary honestly, mirroring the rigor
`docs/native-verification.md` established for the React Native/native contract. The
compatibility-matrix-facing summary lives in `docs/compatibility-matrix.md`'s "Web
support contract (#136)" section; this document is the detail behind it.

## Two independently wired Web paths

BeeUI does not have one Web build — it has two, each proved by its own CI gate:

1. **Expo's Metro Web export** (`apps/showcase`) — the Showcase app, `expo export
   --platform web`. Proved by `ci.yml`'s Web export job (bundle/compile evidence) and by
   `web-a11y.yml`/`visual-web.yml`'s real-Chromium Playwright runs against that export
   (browser interaction + automated accessibility evidence — see
   `docs/web-accessibility-audit.md` and `docs/visual-regression.md`).
2. **An independent Vite consumer** (`scripts/verify-web-consumer.sh`) — a
   non-Showcase, non-monorepo-fallback application. Proved by `.github/workflows/web-consumer.yml`.

Both matter for the support claim: the Showcase proves the Web path BeeUI itself ships
and dogfoods; the independent Vite consumer proves the package boundary and the Web
promise are reproducible **outside** this monorepo, the same bar
`scripts/verify-bare-consumer.sh` already set for the native/bare-RN contract (see
`docs/native-verification.md`).

## Independent Web consumer (`scripts/verify-web-consumer.sh`)

The script does **not** copy BeeUI source into the consumer. Instead it:

1. packs `@beemvp/beeui-core`, `@beemvp/beeui-tokens`, and `@beemvp/beeui-ui` with `pnpm pack`;
2. scaffolds a fresh Vite + `react-native-web` app (no Expo, no workspace symlinks);
3. installs the tarballs plus the exact pinned runtime versions
   `docs/compatibility-matrix.md` already claims (`react-native-web@0.21.0`,
   `react@19.2.3`, `tailwindcss@4.3.3`, `uniwind@1.10.1`, and the same optional-native-peer
   set `@beemvp/beeui-ui` declares) through the consumer's normal `node_modules` boundary;
4. wires Web-bundler tooling this repo has not needed before: `vite-plugin-rnw` (aliases
   `react-native` → `react-native-web` and prioritizes `.web.tsx`/`.web.ts` resolution),
   `uniwind/vite` (the Vite-path equivalent of `apps/showcase/metro.config.js`'s
   `uniwind/metro`), and `@tailwindcss/vite`;
5. renders a representative fixture through `BeeUIProvider` covering `Input`/`Checkbox`
   (forms), `Dialog` (overlay + keyboard `Escape` dismissal), `Select` (open/choose/value
   propagation), `Tooltip` (keyboard-focus reveal), `Sheet` (open/dismiss), `Calendar`
   (date-grid keyboard/pointer selection), and `Table` (real table semantics);
6. runs a production build (`vite build`) and asserts non-empty output;
7. serves that production build (`vite preview`) and drives it with a real, pinned
   Chromium build via Playwright (`@playwright/test@1.62.1`, matching
   `apps/visual-regression`'s pin) — clicking, focusing, and keyboard-dismissing the
   surfaces above;
8. runs `@axe-core/playwright@4.13.0` (matching `apps/visual-regression`'s pin) tagged
   `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa` against the rendered page and fails the run on
   any `serious`/`critical` violation.

A run fails if the consumer unexpectedly resolves the Expo runtime — the same
independence guard `verify-bare-consumer.sh` applies for the native contract.

Run it locally:

```sh
./scripts/verify-web-consumer.sh all
```

Or step by step: `prepare` (pack + scaffold + install), `build` (`vite build`), `verify`
(serve + Playwright + axe). Set `BEEUI_WEB_CONSUMER_CLEAN=1` to force a fresh consumer
instead of reusing the cached one at `BEEUI_WEB_CONSUMER_WORK_ROOT` (defaults to
`~/Library/Caches/BeeUI/web-consumer`, mirroring the bare-RN consumer's cache location
convention).

## What this proves

- The exact candidate source packs, installs, and resolves through the real package
  boundary into an application this monorepo did not generate.
- `BeeUIProvider` + Uniwind's theme CSS render correctly under a second, independently
  configured bundler (Vite), not only Metro.
- Forms, overlays, `Select`, `Tooltip`, `Sheet`, `Table`, and `Calendar` are interactive
  and keyboard-operable in a real Chromium instance against a production build.
- No `serious`/`critical` axe-core violation exists in that rendered, interacted-with
  state.
- A production Web build (`vite build`) completes and produces non-empty output.

## What this does not prove

- **Non-Chromium browsers.** Firefox and WebKit/Safari are never installed or exercised
  by any workflow in this repository (`visual-web.yml`, `web-a11y.yml`, and
  `web-consumer.yml` all install Chromium only). BeeUI makes no rendering or interaction
  claim for those engines.
- **Bundlers other than Expo/Metro and Vite.** Next.js, Webpack, Parcel, or any other
  bundler are unverified; per this issue's own instruction, that absence of evidence is
  not converted into a claim.
- **Server-side rendering.** Both proved paths are client-rendered SPAs; BeeUI does not
  claim SSR/SSG correctness.
- **Full WCAG conformance.** Automated axe-core coverage catches automatable rule
  violations, not every WCAG success criterion — see
  `docs/web-accessibility-audit.md`'s "Known limitations".
- **Long-term stability of `vite-plugin-rnw`.** It is a pre-1.0 (`0.0.x`) third-party
  package. It is pinned exactly and is the tested mechanism for RN→RNW aliasing under
  Vite, not an aspirational range; a breaking change on its side requires re-running this
  contract's evidence before trusting a version bump.

## CI wiring

`.github/workflows/web-consumer.yml` runs `scripts/verify-web-consumer.sh all` on every
pull request and on push to `main`, reusing the same pinned Chromium cache
(`~/.cache/ms-playwright`) `visual-web.yml`/`web-a11y.yml` already provision, and uploads
the consumer's `dist/` build output as a build artifact for the exact head under review.
