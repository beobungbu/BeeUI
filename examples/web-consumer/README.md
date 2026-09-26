# BeeUI Web consumer starter (#233)

R10.4 — an independent Web reference consumer proving BeeUI works through
the ordinary **Vite + react-native-web** toolchain, with no Expo runtime and
no Showcase internals. Mirrors `scripts/verify-web-consumer.sh`'s dependency
pins and structure, checked in here as a maintained starter rather than a
CI-only ephemeral fixture.

## Packed-tarball consumption

BeeUI's current release candidate is publicly published on npm under the `next` dist-tag
(see `../README.md` for the exact currently published version); a real Web application should install it directly —
see the [Web start guide](https://beeui.beemvp.com/docs/start/web/). This
starter deliberately keeps consuming BeeUI through packed tarballs instead,
to prove the exact package boundary reproduces outside the monorepo:
`setup.sh` packs `@beemvp/beeui-core`, `@beemvp/beeui-tokens`, and
`@beemvp/beeui-ui` with `pnpm pack` and installs those tarballs with
`npm install`.

## Run it

```sh
# from the repo root, once:
pnpm build

cd examples/web-consumer
bash setup.sh
npm run build     # vite build — production bundle
npm run preview   # optional: serve the production build locally
```

## What it demonstrates

`BeeUIProvider`, the semantic theme (`@import '@beemvp/beeui-tokens/theme.css'`),
forms (`Input`/`Checkbox`), anchored overlays (`Popover`/`Select`/`Tooltip`/`Dialog`),
the Web `Sheet` path, `Table`, and `Calendar` — see `src/App.tsx`.

## Acceptance evidence (2026-08-31, base `06bca3a`)

```
$ npm run build
vite v8.2.2 building client environment for production...
✓ 568 modules transformed.
dist/index.html                   0.41 kB │ gzip:   0.27 kB
dist/assets/index-7_H_grO0.css   35.91 kB │ gzip:   7.16 kB
dist/assets/index-BP0kIRsA.js   574.29 kB │ gzip: 178.65 kB
✓ built in 748ms
```
