# @beemvp/beeui-core

Small, framework-light utility surface shared by `@beemvp/beeui-ui`: the class-name merge helper (`cn`), calendar/date primitives, and anchored-overlay/overlay-runtime geometry. It has no styling-engine or React Native version opinions of its own — see [ADR-001](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/001-styling-engine.md).

## Distribution state

**Release candidate:** this README ships with `@beemvp/beeui-core@0.86.2-rc.3`. BeeUI release candidates are published under the explicit `@next` channel; during RC use it (or pin the exact version):

```bash
npm install @beemvp/beeui-core@next
```

During the `0.86.2` prerelease line `latest` follows the newest complete, verified RC only after the BeeUI owner moves it for all four packages, so it lags `next` between an RC publication and that move; stable `0.86.2` moves `latest` at stable promotion. BeeUI therefore documents `@next` as the RC contract, and a bare install is not the recommended RC path.

It is normally installed transitively by `@beemvp/beeui-ui`.

## Package contents

- Compiled ESM + CommonJS output with `.d.ts` type declarations (`dist/`), the release artifact shape.
- Original TypeScript source (`src/`), packed alongside `dist/` for the [`beeui add`](https://github.com/beobungbu/BeeUI/blob/main/docs/registry-cli.md) source-ownership workflow and Metro/Uniwind `@source` scanning.

See the main repository ([github.com/beobungbu/BeeUI](https://github.com/beobungbu/BeeUI)) for full documentation, the component inventory ([`docs/components.md`](https://github.com/beobungbu/BeeUI/blob/main/docs/components.md)), and the distribution architecture ([ADR-011](https://github.com/beobungbu/BeeUI/blob/main/docs/decisions/011-distribution-architecture.md)).

## License

MIT © Trần Đức Lân
