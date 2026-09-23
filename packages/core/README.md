# @beemvp/beeui-core

Small, framework-light utility surface shared by `@beemvp/beeui-ui`: the class-name merge helper (`cn`), calendar/date primitives, and anchored-overlay/overlay-runtime geometry. It has no styling-engine or React Native version opinions of its own — see [ADR-001](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/001-styling-engine.md).

## Distribution state

**Public release candidate:** `@beemvp/beeui-core@0.86.2-rc.2` is published on npm. During RC use the explicit `@next` channel (or pin the exact version):

```bash
npm install @beemvp/beeui-core@next
```

The live registry currently also resolves `latest` to this RC, but the bootstrap publish used `--tag next` and the mechanism that also created the observed `latest` value has not been established. BeeUI therefore documents `@next` as the RC contract; a bare install is not the recommended RC path because `latest` moves to stable at the first deliberate stable promotion.

It is normally installed transitively by `@beemvp/beeui-ui`.

## Package contents

- Compiled ESM + CommonJS output with `.d.ts` type declarations (`dist/`), the release artifact shape.
- Original TypeScript source (`src/`), packed alongside `dist/` for the [`beeui add`](https://github.com/beobungbu/BeeUI/blob/main/docs/registry-cli.md) source-ownership workflow and Metro/Uniwind `@source` scanning.

See the main repository ([github.com/beobungbu/BeeUI](https://github.com/beobungbu/BeeUI)) for full documentation, the component inventory ([`docs/components.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/components.md)), and the distribution architecture ([ADR-011](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/011-distribution-architecture.md)).

## License

MIT © Trần Đức Lân
