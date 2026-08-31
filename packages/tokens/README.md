# @beemvp/beeui-tokens

The shared design-token runtime for BeeUI: DTCG-derived color/typography/spacing/motion tokens, the theme registry, runtime overrides, and the Web theme stylesheet consumed directly as `@beemvp/beeui-tokens/theme.css`. Both the centralized `@beemvp/beeui-ui` install path and the [`beeui add`](https://github.com/beobungbu/BeeUI/blob/main/docs/registry-cli.md) source-ownership CLI depend on it as a resolvable runtime package — see [ADR-011 D1/D5](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/011-distribution-architecture.md).

## Install

```bash
npm install @beemvp/beeui-tokens
```

## Usage

```ts
import { spacing, resolveMotion, layer } from '@beemvp/beeui-tokens';
import { resolveNativeMotion } from '@beemvp/beeui-tokens/motion-runtime';
```

```css
/* Web: wire the semantic light/dark theme through your global stylesheet. */
@import '@beemvp/beeui-tokens/theme.css';
```

## Package contents

- Compiled ESM + CommonJS output with `.d.ts` type declarations (`dist/`), the primary published artifact; `theme.css` is copied into `dist/module` and `dist/commonjs` verbatim (never bundled through the JS module graph) so `@beemvp/beeui-tokens/theme.css` keeps resolving from a plain CSS import.
- Original TypeScript source and the raw token JSON (`src/`, `tokens.json`), packed alongside `dist/` for the source-ownership path.
- Machine-readable token subpaths: `./tokens.json`, `./tokens.resolver.json`, `./lifecycle.json`.

See the main repository ([github.com/beobungbu/BeeUI](https://github.com/beobungbu/BeeUI)) for the full token/theming documentation and the distribution architecture ([ADR-011](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/011-distribution-architecture.md)).

## License

MIT © Trần Đức Lân
