# @beemvp/beeui-core

Small, framework-light utility surface shared by `@beemvp/beeui-ui`: the class-name merge helper (`cn`), calendar/date primitives, and anchored-overlay/overlay-runtime geometry. It has no styling-engine or React Native version opinions of its own — see [ADR-001](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/001-styling-engine.md).

## Distribution state

**Unpublished:** `@beemvp/beeui-core` is not currently available from the public npm registry. Publication remains owner-gated by issue #254. Evaluate it through the repository/packed-consumer workflow today.

After publication is explicitly authorized, the intended direct-install shape is:

```bash
npm install @beemvp/beeui-core
```

`@beemvp/beeui-core` is normally a dependency of `@beemvp/beeui-ui`; a direct install is intended only for consumers deliberately using the public utilities in isolation.

## Package contents

- Compiled ESM + CommonJS output with `.d.ts` type declarations (`dist/`), the release artifact shape.
- Original TypeScript source (`src/`), packed alongside `dist/` for the [`beeui add`](https://github.com/beobungbu/BeeUI/blob/main/docs/registry-cli.md) source-ownership workflow and Metro/Uniwind `@source` scanning.

See the main repository ([github.com/beobungbu/BeeUI](https://github.com/beobungbu/BeeUI)) for full documentation, the component inventory ([`docs/components.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/components.md)), and the distribution architecture ([ADR-011](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/011-distribution-architecture.md)).

## License

MIT © Trần Đức Lân
