# @beemvp/beeui-ui

Typed React Native + Web components built on `@beemvp/beeui-core` and `@beemvp/beeui-tokens`, styled through Uniwind/Tailwind CSS v4. Layout, typography, actions, forms, selection, navigation, disclosure, data-display, feedback, state, and application-pattern coverage — see [`docs/components.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/components.md) for the canonical inventory.

## Distribution state

**Release candidate:** this package currently ships as a release candidate. BeeUI release candidates are published under the explicit `@next` channel; during RC use it (or pin an exact version — see [CHANGELOG.md](https://github.com/beobungbu/BeeUI/blob/main/CHANGELOG.md) for the current candidate):

```bash
npm install @beemvp/beeui-ui@next
```

During the `0.86.2` prerelease line `latest` follows the newest complete, verified RC only after the BeeUI owner moves it for all four packages, so it lags `next` between an RC publication and that move; stable `0.86.2` moves `latest` at stable promotion. BeeUI therefore documents `@next` as the RC contract, and a bare install is not the recommended RC path.

`@beemvp/beeui-core` and `@beemvp/beeui-tokens` are package dependencies released at the same lockstep version.

## Usage

The imports below describe the public RC API and are exercised by repository, packed-consumer, and registry-consumer verification.

```tsx
import { BeeUIProvider, Button, Card, Text } from '@beemvp/beeui-ui';

export function Example() {
  return (
    <BeeUIProvider>
      <Card className="gap-4">
        <Text variant="title">Hello, BeeUI</Text>
        <Button>Continue</Button>
      </Card>
    </BeeUIProvider>
  );
}
```

Every public component also has a granular release-ready subpath export, additive to the barrel above, for consumers who want a smaller bundle (~80% gzip reduction for a single-component import — see [ADR-012](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/012-granular-subpath-exports.md)):

```tsx
import { Button } from '@beemvp/beeui-ui/button';
```

## Package contents

- Compiled ESM + CommonJS output with `.d.ts` type declarations (`dist/`), the release artifact shape, including the platform-selected (`.native`/`.web`) overlay-transport and component files Metro's platform-extension resolution depends on.
- Original TypeScript source (`src/`), packed alongside `dist/` for the [`beeui add`](https://github.com/beobungbu/BeeUI/blob/main/docs/registry-cli.md) source-ownership CLI and Metro/Uniwind `@source` scanning.

See the main repository ([github.com/beobungbu/BeeUI](https://github.com/beobungbu/BeeUI)) for full documentation, architecture decisions, and the AI agent cookbook.

## License

MIT © Trần Đức Lân
