# @beemvp/beeui-core

Small, framework-light utility surface shared by [`@beemvp/beeui-ui`](https://www.npmjs.com/package/@beemvp/beeui-ui): the class-name merge helper (`cn`), calendar-date primitives, and the anchored-overlay/overlay-runtime geometry that powers `Popover`/`DropdownMenu`. It has no styling-engine or React Native version opinions of its own — see [ADR-001](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/001-styling-engine.md).

## Install

```bash
npm install @beemvp/beeui-core
```

`@beemvp/beeui-core` is normally pulled in transitively as a dependency of `@beemvp/beeui-ui`; installing it directly is only needed for the utilities above in isolation.

## Package contents

- Compiled ESM + CommonJS output with `.d.ts` type declarations (`dist/`), the primary published artifact.
- Original TypeScript source (`src/`), packed alongside `dist/` for the [`beeui add`](https://github.com/beobungbu/BeeUI/blob/main/docs/registry-cli.md) source-ownership CLI and Metro/uniwind `@source` scanning.

See the main repository ([github.com/beobungbu/BeeUI](https://github.com/beobungbu/BeeUI)) for full documentation, the component inventory ([`docs/components.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/components.md)), and the distribution architecture ([ADR-011](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/011-distribution-architecture.md)).

## License

MIT © Trần Đức Lân
