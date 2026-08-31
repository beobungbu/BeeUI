---
title: Web
description: Run BeeUI on Web through React Native Web.
---

BeeUI targets Web through React Native Web. The same `@beeui/ui` components render on Web
and native from one source tree; Metro produces the Web bundle and Uniwind/Tailwind CSS v4
supplies the styling output. This is exercised in-repo by the BeeUI Showcase's Web export
and a dedicated Playwright visual/accessibility regression app.

## Run the Showcase on Web

The fastest way to see the real component and pattern surface on Web is the BeeUI Showcase
(`apps/showcase`). From the repository root:

```bash
corepack enable
pnpm install --frozen-lockfile

# Iterative development (Metro dev server, Web target)
pnpm --filter @beeui/showcase web

# Deterministic static production export → apps/showcase/dist-web/
pnpm --filter @beeui/showcase build:web
```

`build:web` runs `expo export --platform web` and writes a self-contained `dist-web/`
(an `index.html`, a hashed JS bundle, and the compiled CSS) that deploys to any static
host — there is no server-side runtime. See [Showcase & preview](/showcase/) for the full
build, deploy, and native-preview workflow.

## Wire the Web theme

On Web, BeeUI's semantic tokens are delivered as CSS. Import the token theme once at your
app's CSS entry so the semantic color/typography/spacing variables and light/dark/
high-contrast themes are available to every component:

```css
@import '@beeui/tokens/theme.css';
```

The provider setup is identical to native — wrap your app in `BeeUIProvider` and own your
safe areas explicitly, exactly as shown in [Getting started](/getting-started/).

```tsx
import { BeeUIProvider } from '@beeui/ui';
```

:::note[Unpublished]
The `@beeui/*` packages are not on npm yet. Inside this repository they resolve as
workspace source; the `@import` above is the release-ready Web wiring, not a live install
step. See [CLI & source ownership](/cli/).
:::

See [Compatibility → Web](/compatibility/web/) for the exact Web support contract and what
the Web regression gate proves.
