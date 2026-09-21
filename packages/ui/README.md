# @beemvp/beeui-ui

Typed React Native + Web components built on `@beemvp/beeui-core` and `@beemvp/beeui-tokens`, styled through Uniwind/Tailwind CSS v4. Layout, typography, actions, forms, selection, navigation, disclosure, data-display, feedback, state, and application-pattern coverage — see [`docs/components.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/components.md) for the canonical inventory.

## Distribution state

**Public release candidate:** `@beemvp/beeui-ui@0.86.2-rc.1` is published on npm. During RC use the explicit `@next` channel (or pin the exact version):

```bash
npm install @beemvp/beeui-ui@next
```

The live registry currently also resolves `latest` to this RC, but the bootstrap publish used `--tag next` and the mechanism that also created the observed `latest` value has not been established. BeeUI therefore documents `@next` as the RC contract; a bare install is not the recommended RC path because `latest` moves to stable at the first deliberate stable promotion.

`@beemvp/beeui-core` and `@beemvp/beeui-tokens` are package dependencies released at the same lockstep version.

## Usage

The imports below describe the release-ready API and are exercised by repository/packed-consumer tests; they do not imply public npm availability.

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
