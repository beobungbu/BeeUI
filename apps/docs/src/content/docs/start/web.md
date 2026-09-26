---
title: Web
description: Install the BeeUI release candidate in a Vite + React Native Web application and verify it with a production build.
releaseStatus: true
---

Use this path for a browser-first product built with Vite and React Native Web (see the release status above). Keep using `@next` in the commands below.

**Prerequisites:** Node.js and npm/npx available locally; see the [tested version table](/docs/start/#prerequisites) for the exact React/React DOM/`react-native-web` pins this path expects.

## Create the project

Scaffold a plain Vite + TypeScript project, then replace its generated `vite.config.ts` in the next section — the default `@vitejs/plugin-react` plugin the template adds is not used; `vite-plugin-rnw` already composes its own React transform.

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
```

## Install

Install the BeeUI packages and every runtime peer they declare **in one command**. Installing `@beemvp/beeui-ui` by itself first and the React Native/Web peers afterward, in two separate commands, is the ordering that produces `ERESOLVE: could not resolve ... peer react-native@">=0.86.0 <0.87.0" from @beemvp/beeui-ui@0.86.2-rc.1`:

```bash
npm install @beemvp/beeui-ui@next @beemvp/beeui-core@next @beemvp/beeui-tokens@next \
  react@19.2.3 react-dom@19.2.3 react-native@0.86.2 \
  react-native-web@0.21.0 react-native-safe-area-context@5.7.0 \
  react-native-teleport@1.1.13 tailwindcss@4.3.3 uniwind@1.10.1
npm install -D vite-plugin-rnw@0.0.12 @tailwindcss/vite@4.3.3
```

Pin the exact version from `CHANGELOG.md` instead of `@next` when you need an immutable RC dependency — see the release status above for today's exact version. Check [Compatibility](/docs/compatibility/) before changing the pinned Web stack.

## Styling entry

Create `src/global.css` — the exact path the maintained starter uses — and import it from `src/main.tsx`. `@source` paths are resolved **relative to this file**, so from `src/global.css` the packages one level up in `node_modules` are reached with `../node_modules/...`, not `./node_modules/...`:

```css
@import 'tailwindcss';
@import 'uniwind';
@import '@beemvp/beeui-tokens/theme.css';

@source '../node_modules/@beemvp/beeui-core/src';
@source '../node_modules/@beemvp/beeui-ui/src';
```

## Vite configuration

Replace the generated `vite.config.ts` with exactly this — plugin order matters: React Native Web aliasing first, then Tailwind, then Uniwind pointed at the same CSS entry the styling section created. This is copied from the maintained [`examples/web-consumer/vite.config.ts`](https://github.com/beobungbu/BeeUI/blob/main/examples/web-consumer/vite.config.ts), the executable authority for this stack:

```ts
// vite.config.ts
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

Get it wrong — a different plugin order, or a `cssEntryFile` that does not match the file the previous section created — and the app either fails to resolve `react-native` or builds with no console error but renders **completely unstyled** (no button backgrounds, no borders).

## Application root

The maintained Web starter uses ordinary layout at its root, not `SafeArea`: browsers report no system safe-area insets by default, so wrapping the whole app in `SafeArea` adds nothing there. Add `SafeArea` only around a surface that genuinely consumes browser safe-area insets (a PWA installed to a notched device, for example) — see [Provider & safe area](/docs/start/provider-safe-area/) for the full edge-ownership contract that native platforms need instead.

```tsx
import { BeeUIProvider, Screen, Text } from '@beemvp/beeui-ui';

export function App() {
  return (
    <BeeUIProvider>
      <Screen>
        <Text>BeeUI on Web</Text>
      </Screen>
    </BeeUIProvider>
  );
}
```

## Verify it worked

After `npm run build`, the built CSS under `dist/assets/*.css` must contain BeeUI's semantic color custom properties (`--color-...`) and resolve the `bg-primary` utility to a real declaration. If the built CSS is small and neither is present, the styling entry or the Vite `@source` paths above do not match your project layout — recheck them before touching component code.

## Verify the maintained Web consumer

From `examples/web-consumer`:

```bash
bash setup.sh
npm run build
```

For an application that already has dependencies installed, the normal production verification remains:

```bash
npm run build
npm run preview
```

The clean Web consumer installs the package boundary without monorepo links and produces a Vite + React Native Web production build in CI.

## Current Web evidence boundary

The current maintained Web stack is Vite + React Native Web. Browser integration/visual evidence is Chromium-based. Do not infer Next.js, Webpack, Parcel, SSR or multi-browser support unless the corresponding compatibility page explicitly records it.
