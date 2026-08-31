# @beeui/ui

Typed React Native + Web components built on [`@beeui/core`](https://www.npmjs.com/package/@beeui/core) and [`@beeui/tokens`](https://www.npmjs.com/package/@beeui/tokens), styled through Uniwind/Tailwind CSS v4. Layout, typography, actions, forms, selection, navigation, disclosure, data-display, feedback, state, and application-pattern coverage — see [`docs/components.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/components.md) for the canonical inventory.

## Install

```bash
npm install @beeui/ui
```

`@beeui/core` and `@beeui/tokens` install automatically as dependencies. See [`docs/compatibility-matrix.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/compatibility-matrix.md) for the exact tested `react`/`react-native`/`uniwind`/`tailwindcss` peer ranges.

## Usage

```tsx
import { BeeUIProvider, Button, Card, Text } from '@beeui/ui';

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

Every public component also ships a granular subpath export, additive to the barrel above, for consumers who want a smaller bundle (~80% gzip reduction for a single-component import — see [ADR-012](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/012-granular-subpath-exports.md)):

```tsx
import { Button } from '@beeui/ui/button';
```

## Package contents

- Compiled ESM + CommonJS output with `.d.ts` type declarations (`dist/`), the primary published artifact, including the platform-selected (`.native`/`.web`) overlay-transport and component files Metro's platform-extension resolution depends on.
- Original TypeScript source (`src/`), packed alongside `dist/` for the [`beeui add`](https://github.com/beobungbu/BeeUI/blob/main/docs/registry-cli.md) source-ownership CLI and Metro/uniwind `@source` scanning.

See the main repository ([github.com/beobungbu/BeeUI](https://github.com/beobungbu/BeeUI)) for full documentation, architecture decisions, and the AI agent cookbook.

## License

MIT © Trần Đức Lân
