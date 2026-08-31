# @beemvp/beeui-docs

The canonical BeeUI public documentation site. Built with [Astro](https://astro.build) +
[Starlight](https://starlight.astro.build): a static, accessibility-first docs framework
with built-in search, dark mode, and responsive navigation. This app is isolated from the
root workspace's React/React Native toolchain — it has no dependency on `@beemvp/beeui-core`,
`@beemvp/beeui-tokens`, or `@beemvp/beeui-ui`.

This is infrastructure only (issue #220): framework, information architecture, and
theming. Final per-component reference content, executable examples, production pattern
docs, and Showcase/native-preview integration land in follow-up issues (#221-#225); pages
without that content say so explicitly.

## Commands

Run from the repository root or this directory.

```bash
pnpm --filter @beemvp/beeui-docs dev        # local dev server
pnpm --filter @beemvp/beeui-docs build      # static build to dist/
pnpm --filter @beemvp/beeui-docs preview    # preview the static build
pnpm --filter @beemvp/beeui-docs typecheck  # astro check
```
