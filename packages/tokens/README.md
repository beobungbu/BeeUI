# @beemvp/beeui-tokens

The shared design-token runtime for BeeUI: DTCG-derived color/typography/spacing/motion tokens, the theme registry, runtime overrides, and the Web theme stylesheet consumed directly as `@beemvp/beeui-tokens/theme.css`. Both the centralized `@beemvp/beeui-ui` distribution target and the [`beeui add`](https://github.com/beobungbu/BeeUI/blob/main/docs/registry-cli.md) source-ownership path depend on this contract — see [ADR-011 D1/D5](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/011-distribution-architecture.md).

## Distribution state

**Unpublished:** `@beemvp/beeui-tokens` is not currently available from the public npm registry. Publication remains owner-gated by BeeUI release issue #254. Evaluate the current code from this repository/source-ownership workflow instead of treating the command below as available today.

After publication is explicitly authorized, the intended install shape is:

```bash
npm install @beemvp/beeui-tokens
```

## Usage

The following imports describe the release-ready module contract and work in repository/packed-consumer verification; they do not imply public npm availability.

```ts
import { spacing, resolveMotion, layer } from '@beemvp/beeui-tokens';
import { resolveNativeMotion } from '@beemvp/beeui-tokens/motion-runtime';
```

```css
/* Web: wire the semantic light/dark theme through your global stylesheet. */
@import '@beemvp/beeui-tokens/theme.css';
```

## Package contents

- Compiled ESM + CommonJS output with `.d.ts` type declarations (`dist/`), the release artifact shape; `theme.css` is copied into `dist/module` and `dist/commonjs` verbatim (never bundled through the JS module graph) so `@beemvp/beeui-tokens/theme.css` keeps resolving from a plain CSS import.
- Original TypeScript source and the raw token JSON (`src/`, `tokens.json`), packed alongside `dist/` for the source-ownership path.
- Machine-readable token subpaths: `./tokens.json`, `./tokens.resolver.json`, `./lifecycle.json`.

See the main repository ([github.com/beobungbu/BeeUI](https://github.com/beobungbu/BeeUI)) for the full token/theming documentation and the distribution architecture ([ADR-011](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/011-distribution-architecture.md)).

## License

MIT © Trần Đức Lân
