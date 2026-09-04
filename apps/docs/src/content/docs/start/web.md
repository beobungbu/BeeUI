---
title: Web
description: Reach a visible BeeUI screen in a standalone Vite plus React Native Web application and verify it with a real production build.
---

This is the path for a browser-only product: a Vite application rendering BeeUI through React Native Web, with no Expo runtime and no Showcase internals. Take this path when the Web is your delivery target rather than a secondary export of a native app.

Choose a different guide if you ship a native app that also has a Web target ([Expo](/docs/start/expo/)) or run React Native without Expo ([Bare React Native](/docs/start/bare-react-native/)).

:::caution[Public distribution is closed]
BeeUI is unpublished, so this page contains no public-registry installation instruction. The commands use `examples/web-consumer`, which packs the real package artifacts locally and installs them into an isolated Vite application.
:::

## Prerequisites

These are the pins `examples/web-consumer/setup.sh` installs, shared with `scripts/verify-web-consumer.sh`. The authoritative machine-checked table is [Compatibility](/docs/compatibility/), and the Web-specific boundary is [Compatibility → Web](/docs/compatibility/web/).

| Dependency | Tested value |
| --- | --- |
| Node.js | `24.13.1` |
| pnpm (for the repository build) | `10.15.0` |
| `react` / `react-dom` | `19.2.3` |
| `react-native` | `0.86.2` |
| `react-native-web` | `0.21.0` |
| `class-variance-authority` | `0.7.1` |
| `react-native-safe-area-context` | `5.7.0` |
| `react-native-teleport` | `1.1.13` |
| `tailwindcss` / `uniwind` | `4.3.3` / `1.10.1` |
| `vite` (dev) | `8.2.2` |
| `vite-plugin-rnw` (dev) | `0.0.12` |
| `@tailwindcss/vite` (dev) | `4.3.3` |

The same optional native peers as the native paths are installed so `Sheet`, `DatePicker` and `DateTimePicker` resolve on Web too.

Two boundaries are worth knowing before you commit. Vite is the only tested Web bundler — Next.js, Webpack and Parcel are not claimed, and neither is server-side rendering or static pre-rendering. Browser evidence is Chromium-only through Playwright; there is no Firefox or WebKit claim. `vite-plugin-rnw` is pre-1.0 and is not a declared peer of BeeUI, so treat its version as a tested point rather than a supported range.

## Starting project state

A clean checkout of this repository with the workspace built. The starter *is* the Vite application: `examples/web-consumer` ships `index.html`, `vite.config.ts`, `src/main.tsx`, `src/global.css` and `src/App.tsx`. Run it first, then port those files into your own Vite app.

## 1. Build the workspace and run the clean consumer

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build

cd examples/web-consumer
bash setup.sh
npm run build
```

`setup.sh` packs `@beemvp/beeui-core`, `@beemvp/beeui-tokens` and `@beemvp/beeui-ui` into real tarballs with `pnpm pack`, installs those plus the runtime and dev dependencies with `npm install --save-exact`, and then fails if `require.resolve('expo')` succeeds — this consumer must stay independent of the Expo path.

`npm run build` is the fixture's `vite build`. To look at the result in a browser:

```bash
npm run preview
```

## 2. Configure Vite for React Native Web

`examples/web-consumer/vite.config.ts`, verbatim. Three plugins, in this order:

```ts
import tailwindcss from '@tailwindcss/vite';
import { uniwind } from 'uniwind/vite';
import { defineConfig } from 'vite';
import { rnw } from 'vite-plugin-rnw';

export default defineConfig({
  plugins: [
    rnw(),
    tailwindcss(),
    uniwind({
      cssEntryFile: './src/global.css',
      dtsFile: './src/uniwind-types.d.ts',
    }),
  ],
});
```

`rnw()` is what maps React Native modules onto React Native Web; without it, imports from `react-native` fail to resolve in a browser build. Note that `cssEntryFile` is `./src/global.css` here, not the repository-root-relative path the native guides use.

## 3. Import the semantic theme once

`examples/web-consumer/src/global.css`, verbatim:

```css
@import 'tailwindcss';
@import 'uniwind';
@import '@beemvp/beeui-tokens/theme.css';

@source '../node_modules/@beemvp/beeui-core/src';
@source '../node_modules/@beemvp/beeui-ui/src';
```

Import it exactly once, from the application entry (`src/main.tsx`):

```tsx
import './global.css';

import * as React from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root was not found.');
}

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

## 4. Mount the provider and render a first screen

```tsx
import {
  BeeUIProvider,
  Button,
  Card,
  Screen,
  Text,
} from '@beemvp/beeui-ui';

export function App() {
  return (
    <BeeUIProvider>
      <Screen>
        <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
          <Card className="gap-4">
            <Text variant="title">BeeUI on Web</Text>
            <Text variant="body">Vite, React Native Web, one provider.</Text>
            <Button>Continue</Button>
          </Card>
        </div>
      </Screen>
    </BeeUIProvider>
  );
}
```

Note what is missing: there is no `SafeArea` on the Web path, and the maintained Web starter does not use one. Browsers have no system notch or gesture bar to own, so the outer container is ordinary layout. `BeeUIProvider` still owns the overlay scope and the Toast viewport exactly as it does on native — the same component imports work on both, and platform differences are documented at the behavior-contract level instead of forking the API. See [Provider & safe area](/docs/start/provider-safe-area/).

## 5. Verify

| Checkpoint | Command | Expected result |
| --- | --- | --- |
| Packages built | `pnpm build` at the repository root | exits `0`; `packages/ui/dist` exists |
| Tarballs installed, Expo absent | `bash setup.sh` | ends with `==> Setup complete. Run: npm run build` |
| Production build succeeds | `npm run build` | Vite prints a transformed-module count and `✓ built in …`; `dist/index.html` exists and is non-empty |
| Visible UI | `npm run preview`, then open the printed URL | the card, title and button render with BeeUI styling; the browser console is clean |
| Accessibility sanity | keyboard only — `Tab` to the button, `Enter` to activate; open an overlay and press `Escape` | focus is visible at every stop and `Escape` closes the deepest open overlay |

The starter's recorded acceptance run produced 568 transformed modules, `dist/index.html` at 0.41 kB and a JavaScript bundle around 574 kB, built in under a second. Compare shapes, not exact numbers.

**What this proves, and what it does not.** A passing build is *package-boundary resolution plus Vite/React Native Web production bundling*. It is not a browser interaction result on its own. BeeUI's CI lane runs a richer gate on the same fixture: it serves the production build with `vite preview` and drives it with Playwright Chromium — filling a text input, toggling a checkbox, choosing a `Select` option and asserting it propagates into a `Table` cell, focusing a `Tooltip` trigger by keyboard, opening a `Dialog` and closing it with `Escape`, opening and dismissing a `Sheet`, clicking a `Calendar` day — then runs axe with the `wcag2a`, `wcag2aa`, `wcag21a` and `wcag21aa` tags and fails on any serious or critical violation or any console error. A Web result never substitutes for iOS or Android runtime evidence.

## Common failures

| Symptom | Cause | Fix |
| --- | --- | --- |
| `packages/ui/dist is missing. Run "pnpm build" …` | the packer refuses to pack an unbuilt workspace | run `pnpm build` from the repository root, then re-run `bash setup.sh` |
| `This Web consumer unexpectedly resolves the Expo runtime;` | Expo leaked into the dependency graph, usually from a stale `node_modules` | delete `examples/web-consumer/node_modules` and `.beeui-tarballs`, then re-run `bash setup.sh` |
| `Failed to resolve import "react-native"` during build | `rnw()` is missing from the Vite plugin list, or is ordered after the others | restore the plugin array from step 2 exactly |
| The page renders but every component is unstyled | `./global.css` is not imported from `src/main.tsx`, or the two `@source` lines are missing | import it once at the entry and restore the CSS from step 3 |
| Theme colors are wrong or absent while spacing looks right | `@import '@beemvp/beeui-tokens/theme.css';` is missing, so the semantic token layer never loads | add that import to the CSS entry |
| Uniwind classes work in dev but vanish in the production build | `cssEntryFile` in `vite.config.ts` points at a path that does not exist | set it to `'./src/global.css'`, matching where the file actually is |
| Overlays open in the wrong place or do not trap focus | the application root was mounted without `BeeUIProvider`, or a second unrelated root was created | mount exactly one `BeeUIProvider` at the application root — see [Provider & safe area](/docs/start/provider-safe-area/) |
| `Root container #root was not found.` | `index.html` has no `<div id="root"></div>` | add it, alongside the `<script type="module" src="/src/main.tsx">` tag |

## Next steps

- Browse [Components](/docs/components/) for the generated per-component reference.
- Compose real screens with [Patterns](/docs/patterns/).
- Work through a stuck build in [Troubleshooting](/docs/guides/troubleshooting/).
- Read [Compatibility → Web](/docs/compatibility/web/) for the tested browser and bundler contract, and [Accessibility](/docs/accessibility/) before shipping.

## Source authority

- [`examples/web-consumer`](https://github.com/beobungbu/BeeUI/tree/main/examples/web-consumer) — the independent Vite and React Native Web consumer this page documents.
- [`scripts/verify-web-consumer.sh`](https://github.com/beobungbu/BeeUI/blob/main/scripts/verify-web-consumer.sh) — the CI lane that adds Playwright interaction and axe evidence.
- [`docs/web-support-contract.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/web-support-contract.md) — the Web support and evidence contract.
- [`docs/compatibility-matrix.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/compatibility-matrix.md) — the tested version contract.
