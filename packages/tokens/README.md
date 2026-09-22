# @beemvp/beeui-tokens

The shared design-token runtime for BeeUI: DTCG-derived color/typography/spacing/motion tokens, the theme registry, runtime overrides, and the Web theme stylesheet consumed directly as `@beemvp/beeui-tokens/theme.css`. Both the centralized `@beemvp/beeui-ui` distribution target and the [`beeui add`](https://github.com/beobungbu/BeeUI/blob/main/docs/registry-cli.md) source-ownership path depend on this contract — see [ADR-011 D1/D5](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/011-distribution-architecture.md).

## Distribution state

**Public release candidate:** `@beemvp/beeui-tokens@0.86.2-rc.1` is published on npm. During RC use the explicit `@next` channel (or pin the exact version):

```bash
npm install @beemvp/beeui-tokens@next
```

The live registry currently also resolves `latest` to this RC, but the bootstrap publish used `--tag next` and the mechanism that also created the observed `latest` value has not been established. BeeUI therefore documents `@next` as the RC contract; a bare install is not the recommended RC path because `latest` moves to stable at the first deliberate stable promotion.

## Usage

The following imports describe the public RC module contract and are exercised by repository, packed-consumer, and registry-consumer verification.

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
